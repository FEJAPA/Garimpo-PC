// Testes das actions da conta (V2, F-20): as regras de segurança que a RLS do
// banco também confere, mas que não podem sumir do código em silêncio.
// - saveBuild: limite de 50 montagens, oferta precisa ser da peça (product_id) e
//   o preço gravado é o do banco, não o do formulário.
// - reactivateAlert / deleteAlert / deleteSavedBuild: sempre com `.eq("user_id")`.
// - createAlert / createBuildAlert: se o alerta já existe, ATUALIZA (T-8).

import { afterEach, describe, expect, it, vi } from "vitest";
import { formatBRL } from "@/lib/format";

type Resposta = { data?: unknown; error?: { message: string } | null; count?: number | null };
type Consulta = {
  tabela: string;
  verbo: string;
  args: unknown[];
  filtros: [string, ...unknown[]][];
};

const fake = vi.hoisted(() => ({
  user: null as { id: string; email?: string } | null,
  client: null as unknown,
}));

vi.mock("@/models/supabase-server", () => ({
  getServerSupabase: async () => fake.client,
  getCurrentUser: async () => fake.user,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
// redirect() do Next interrompe a action lançando um erro; aqui guardamos o destino.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { createAlert, createBuildAlert, deleteAlert, deleteSavedBuild, reactivateAlert, saveBuild } from "./actions";

/**
 * Cliente falso encadeável (como em products.test.ts): `from(tabela)` devolve um
 * construtor que anota o verbo (select/insert/update/delete) e os filtros (eq,
 * is, in...). Ao ser aguardado, pergunta a `responder` o que o "banco" devolve.
 */
function clienteFalso(responder: (c: Consulta) => Resposta = () => ({ data: null, error: null })) {
  const consultas: Consulta[] = [];
  const client = {
    from(tabela: string) {
      const c: Consulta = { tabela, verbo: "", args: [], filtros: [] };
      consultas.push(c);
      const b: Record<string, unknown> = {};
      for (const verbo of ["select", "insert", "update", "delete", "upsert"]) {
        b[verbo] = (...args: unknown[]) => {
          if (!c.verbo) {
            c.verbo = verbo;
            c.args = args;
          }
          return b;
        };
      }
      for (const filtro of ["eq", "is", "in", "gt", "order", "limit"]) {
        b[filtro] = (...args: unknown[]) => {
          c.filtros.push([filtro, ...args]);
          return b;
        };
      }
      const resolver = () => Promise.resolve({ data: null, error: null, count: null, ...responder(c) });
      b.maybeSingle = resolver;
      b.single = resolver;
      b.then = (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => resolver().then(ok, erro);
      return b;
    },
  };
  fake.client = client;
  return consultas;
}

/** O valor do filtro `.eq(coluna, valor)` de uma consulta (undefined se não houver). */
function eq(c: Consulta | undefined, coluna: string): unknown {
  return c?.filtros.find((f) => f[0] === "eq" && f[1] === coluna)?.[2];
}

async function destinoDe(promessa: Promise<unknown>): Promise<string | null> {
  try {
    await promessa;
    return null;
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("REDIRECT:")) return msg.slice("REDIRECT:".length);
    throw e;
  }
}

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

const DONO = { id: "u-dono", email: "dono@exemplo.com" };

afterEach(() => {
  fake.user = null;
  fake.client = null;
  vi.restoreAllMocks();
});

// --- saveBuild ---------------------------------------------------------------

const PREFS = { budget: { target: 5000, hardCap: 5500 }, trustedOnly: true, aesthetics: 50 };
/** O navegador manda preços de referência; o servidor confere no banco. */
const PARTES_DO_FORM = [
  { productId: "p-gpu", offerId: "o-gpu", price: 1 },
  { productId: "p-cpu", offerId: "o-cpu", price: 1 },
];
const OFERTAS_DO_BANCO = [
  { id: "o-gpu", product_id: "p-gpu", store_id: "kabum", price_pix: "1899.90", product: { slug: "rtx-4060" } },
  { id: "o-cpu", product_id: "p-cpu", store_id: "pichau", price_pix: 999.9, product: { slug: "ryzen-5600" } },
];

function formMontagem(partes: unknown = PARTES_DO_FORM): FormData {
  return form({ name: "PC da sala", prefs: JSON.stringify(PREFS), parts: JSON.stringify(partes) });
}

/** Banco falso do saveBuild: contagem de montagens, ofertas e o insert. */
function bancoDoSave(opts: { count?: number; ofertas?: unknown[] } = {}) {
  return clienteFalso((c) => {
    if (c.tabela === "saved_builds" && c.verbo === "select") return { count: opts.count ?? 0 };
    if (c.tabela === "offers") return { data: opts.ofertas ?? OFERTAS_DO_BANCO };
    return { error: null };
  });
}

describe("saveBuild (F-20)", () => {
  it("sem login, não toca no banco", async () => {
    const consultas = bancoDoSave();
    const res = await saveBuild(formMontagem());
    expect(res.ok).toBe(false);
    expect(consultas).toHaveLength(0);
  });

  it("grava com o preço do banco (não o do formulário) e o dono da sessão", async () => {
    fake.user = DONO;
    const consultas = bancoDoSave();
    const res = await saveBuild(formMontagem());
    expect(res.ok).toBe(true);

    const contagem = consultas.find((c) => c.tabela === "saved_builds" && c.verbo === "select");
    expect(eq(contagem, "user_id")).toBe(DONO.id);

    const insert = consultas.find((c) => c.tabela === "saved_builds" && c.verbo === "insert");
    const linha = insert?.args[0] as { user_id: string; total_pix: number; parts: { price: number; slug?: string }[] };
    expect(linha.user_id).toBe(DONO.id);
    expect(linha.parts.map((p) => p.price)).toEqual([1899.9, 999.9]);
    expect(linha.parts[0].slug).toBe("rtx-4060");
    expect(linha.total_pix).toBe(2899.8);
  });

  it("recusa oferta que não é da peça informada (product_id diferente)", async () => {
    fake.user = DONO;
    const trocada = [{ ...OFERTAS_DO_BANCO[0], product_id: "p-outra-peca" }, OFERTAS_DO_BANCO[1]];
    const consultas = bancoDoSave({ ofertas: trocada });
    const res = await saveBuild(formMontagem());
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/oferta da montagem mudou/);
    expect(consultas.some((c) => c.verbo === "insert")).toBe(false);
  });

  it("recusa oferta que sumiu do banco ou ficou com preço inválido", async () => {
    fake.user = DONO;
    bancoDoSave({ ofertas: [OFERTAS_DO_BANCO[0]] });
    expect((await saveBuild(formMontagem())).ok).toBe(false);

    const consultas = bancoDoSave({ ofertas: [{ ...OFERTAS_DO_BANCO[0], price_pix: 0 }, OFERTAS_DO_BANCO[1]] });
    expect((await saveBuild(formMontagem())).ok).toBe(false);
    expect(consultas.some((c) => c.verbo === "insert")).toBe(false);
  });

  it("limite de 50 montagens: com 50 recusa, com 49 ainda salva", async () => {
    fake.user = DONO;
    let consultas = bancoDoSave({ count: 50 });
    const cheio = await saveBuild(formMontagem());
    expect(cheio.ok).toBe(false);
    expect(cheio.message).toContain("50 montagens");
    expect(consultas.some((c) => c.verbo === "insert")).toBe(false);

    consultas = bancoDoSave({ count: 49 });
    expect((await saveBuild(formMontagem())).ok).toBe(true);
    expect(consultas.some((c) => c.verbo === "insert")).toBe(true);
  });

  it("se a contagem falhar, não salva (não dá para conferir o limite)", async () => {
    fake.user = DONO;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const consultas = clienteFalso((c) =>
      c.tabela === "saved_builds" && c.verbo === "select" ? { error: { message: "timeout" } } : {},
    );
    expect((await saveBuild(formMontagem())).ok).toBe(false);
    expect(consultas.some((c) => c.verbo === "insert")).toBe(false);
  });
});

// --- Dono nas ações de /conta --------------------------------------------------

describe("ações de /conta exigem o dono (F-20)", () => {
  it("reactivateAlert sem login manda para /entrar e não toca no banco", async () => {
    const consultas = clienteFalso();
    expect(await destinoDe(reactivateAlert(form({ id: "a1" })))).toBe("/entrar?next=%2Fconta");
    expect(consultas).toHaveLength(0);
  });

  it("reactivateAlert só mexe no alerta com o id E o user_id da sessão", async () => {
    fake.user = DONO;
    const consultas = clienteFalso();
    expect(await destinoDe(reactivateAlert(form({ id: "a1" })))).toBeNull();
    const update = consultas.find((c) => c.tabela === "price_alerts" && c.verbo === "update");
    expect(update?.args[0]).toEqual({ is_active: true, notified_at: null });
    expect(eq(update, "id")).toBe("a1");
    expect(eq(update, "user_id")).toBe(DONO.id);
  });

  it("reactivateAlert com erro do banco volta com código, não com texto", async () => {
    fake.user = DONO;
    vi.spyOn(console, "error").mockImplementation(() => {});
    clienteFalso(() => ({ error: { message: "permission denied" } }));
    expect(await destinoDe(reactivateAlert(form({ id: "a1" })))).toBe("/conta?aviso=erro-reativar-alerta");
  });

  it("deleteAlert e deleteSavedBuild também filtram por user_id", async () => {
    fake.user = DONO;
    const consultas = clienteFalso();
    await deleteAlert(form({ id: "a1" }));
    await deleteSavedBuild(form({ id: "m1" }));
    const [alerta, montagem] = consultas.filter((c) => c.verbo === "delete");
    expect([alerta.tabela, eq(alerta, "id"), eq(alerta, "user_id")]).toEqual(["price_alerts", "a1", DONO.id]);
    expect([montagem.tabela, eq(montagem, "id"), eq(montagem, "user_id")]).toEqual(["saved_builds", "m1", DONO.id]);
  });
});

// --- Alertas: criar ou atualizar ------------------------------------------------

describe("createAlert: um alerta ativo por peça", () => {
  /** Banco falso: a peça existe e, se `existente`, já há um alerta ativo dela. */
  function bancoDoAlerta(existente: { id: string } | null) {
    return clienteFalso((c) => {
      if (c.tabela === "products") return { data: { id: "p-rtx" } };
      if (c.tabela === "price_alerts" && c.verbo === "select") return { data: existente };
      return { error: null };
    });
  }

  it("sem alerta ativo da peça, cria um novo com o dono da sessão", async () => {
    fake.user = DONO;
    const consultas = bancoDoAlerta(null);
    const res = await createAlert(form({ slug: "rtx-4060", target_price: "1500" }));
    expect(res).toEqual({ ok: true, message: "Alerta criado! Avisaremos quando o preço cair." });
    const insert = consultas.find((c) => c.verbo === "insert");
    expect(insert?.args[0]).toEqual({ user_id: DONO.id, product_id: "p-rtx", target_price: 1500 });
  });

  it("com alerta ativo da mesma peça, atualiza o valor em vez de criar outro", async () => {
    fake.user = DONO;
    const consultas = bancoDoAlerta({ id: "a-velho" });
    const res = await createAlert(form({ slug: "rtx-4060", target_price: "1.450,50" }));
    expect(res).toEqual({ ok: true, message: `Alerta atualizado para ${formatBRL(1450.5)}.` });

    const busca = consultas.find((c) => c.tabela === "price_alerts" && c.verbo === "select");
    expect(eq(busca, "user_id")).toBe(DONO.id);
    expect(eq(busca, "product_id")).toBe("p-rtx");
    expect(eq(busca, "is_active")).toBe(true);

    expect(consultas.some((c) => c.verbo === "insert")).toBe(false);
    const update = consultas.find((c) => c.verbo === "update");
    expect((update?.args[0] as { target_price: number }).target_price).toBe(1450.5);
    expect(eq(update, "id")).toBe("a-velho");
    expect(eq(update, "user_id")).toBe(DONO.id);
  });
});

describe("createBuildAlert: um alerta por montagem (T-8)", () => {
  function bancoDaMontagem(opts: { montagem: { id: string } | null; existente: { id: string } | null }) {
    return clienteFalso((c) => {
      if (c.tabela === "saved_builds") return { data: opts.montagem };
      if (c.tabela === "price_alerts" && c.verbo === "select") return { data: opts.existente };
      return { error: null };
    });
  }

  it("montagem de outra pessoa (ou que não existe): não cria nada", async () => {
    fake.user = DONO;
    const consultas = bancoDaMontagem({ montagem: null, existente: null });
    const res = await createBuildAlert(form({ saved_build_id: "m-alheia", target_price: "5000" }));
    expect(res.ok).toBe(false);
    const busca = consultas.find((c) => c.tabela === "saved_builds");
    expect(eq(busca, "id")).toBe("m-alheia");
    expect(eq(busca, "user_id")).toBe(DONO.id);
    expect(consultas.some((c) => c.verbo === "insert" || c.verbo === "update")).toBe(false);
  });

  it("primeiro alerta da montagem: cria e diz “Alerta criado”", async () => {
    fake.user = DONO;
    const consultas = bancoDaMontagem({ montagem: { id: "m1" }, existente: null });
    const res = await createBuildAlert(form({ saved_build_id: "m1", target_price: "5000" }));
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/^Alerta criado/);
    expect(consultas.find((c) => c.verbo === "insert")?.args[0]).toEqual({
      user_id: DONO.id,
      saved_build_id: "m1",
      target_price: 5000,
    });
  });

  it("alerta já existente: troca o valor e diz “Alerta atualizado”", async () => {
    fake.user = DONO;
    const consultas = bancoDaMontagem({ montagem: { id: "m1" }, existente: { id: "a1" } });
    const res = await createBuildAlert(form({ saved_build_id: "m1", target_price: "4800" }));
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/^Alerta atualizado/);
    expect(consultas.some((c) => c.verbo === "insert")).toBe(false);
    const update = consultas.find((c) => c.verbo === "update");
    expect(update?.args[0]).toEqual({ target_price: 4800, is_active: true, notified_at: null });
    expect(eq(update, "user_id")).toBe(DONO.id);
  });
});
