// Testes da camada de peças (V2, pacote G: "preço de hoje às HH:MM", R-12,
// SEG-05 e LOG-13). Sem Supabase o serviço usa o mock; com um cliente falso
// conferimos a junção com o último ponto do histórico.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attachRecordedAt,
  dayInSaoPaulo,
  getPriceHistory,
  getProductBySlug,
  getProducts,
  lastRecordedByOffer,
  normalizeProduct,
  normalizeStore,
  sanitizeSearchTerm,
  searchProducts,
} from "./products";
import { MOCK_HISTORY, MOCK_PRODUCTS } from "@/models/mock-data";
import type { ProductWithOffers, Store } from "@/models/types";

/** Teto padrão do PostgREST por resposta (o coletor também cita: DAD-02). */
const MAX_LINHAS_POSTGREST = 1000;

// Cliente falso controlável: por padrão null (= sem Supabase, modo demonstração).
const fake = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/models/supabase", () => ({
  getSupabase: () => fake.client,
  isSupabaseConfigured: () => fake.client !== null,
}));

/**
 * Cliente mínimo: `from(tabela)` devolve um construtor encadeável (select, eq,
 * in, order, or, maybeSingle...) que, ao ser aguardado, resolve com a resposta
 * configurada para aquela tabela. Guarda os filtros `in` para conferirmos e,
 * como o banco, aplica `in(coluna, valores)` às linhas da resposta. Também imita
 * o PostgREST: no máximo 1.000 linhas por resposta, e `range(de, ate)` escolhe a página.
 */
function clienteFalso(respostas: Record<string, { data: unknown; error: { message: string } | null }>) {
  const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
  const client = {
    from(tabela: string) {
      let resposta = respostas[tabela] ?? { data: [], error: null };
      const builder: Record<string, unknown> = {};
      let pagina: [number, number] = [0, Infinity];
      for (const metodo of ["select", "eq", "in", "order", "or", "limit", "range"]) {
        builder[metodo] = (...args: unknown[]) => {
          chamadas.push({ tabela, metodo, args });
          if (metodo === "range") pagina = args as [number, number];
          if (metodo === "in" && Array.isArray(resposta.data)) {
            const [coluna, valores] = args as [string, unknown[]];
            resposta = {
              ...resposta,
              data: (resposta.data as Record<string, unknown>[]).filter((linha) => valores.includes(linha[coluna])),
            };
          }
          return builder;
        };
      }
      builder.maybeSingle = () => {
        const d = resposta.data;
        return Promise.resolve({ data: Array.isArray(d) ? (d[0] ?? null) : d, error: resposta.error });
      };
      builder.then = (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => {
        const [de, ate] = pagina;
        const final = Array.isArray(resposta.data)
          ? { ...resposta, data: resposta.data.slice(de, Math.min(ate + 1, de + MAX_LINHAS_POSTGREST)) }
          : resposta;
        return Promise.resolve(final).then(ok, erro);
      };
      return builder;
    },
  };
  return { client, chamadas };
}

afterEach(() => {
  fake.client = null;
  vi.restoreAllMocks();
});

const lojaTexto = {
  id: "l1",
  name: "Loja",
  rating: "4.8",
  rating_count: "1200",
  is_official: true,
  url: null,
  reclame_aqui_score: "5.4",
  years_active: "7",
  blocked: null,
} as unknown as Store;

describe("normalizeStore (R-12)", () => {
  it("converte numeric que chega como texto e blocked nulo", () => {
    expect(normalizeStore(lojaTexto)).toEqual({
      id: "l1",
      name: "Loja",
      rating: 4.8,
      rating_count: 1200,
      is_official: true,
      url: null,
      reclame_aqui_score: 5.4,
      years_active: 7,
      blocked: false,
    });
  });

  it("mantém null quando o dado não é conhecido e não inventa número de lixo", () => {
    const s = normalizeStore({ ...lojaTexto, reclame_aqui_score: null, years_active: "abc" } as unknown as Store);
    expect(s.reclame_aqui_score).toBeNull();
    expect(s.years_active).toBeNull();
  });

  it("blocked vira boolean de verdade", () => {
    expect(normalizeStore({ ...lojaTexto, blocked: "true" } as unknown as Store).blocked).toBe(true);
    expect(normalizeStore({ ...lojaTexto, blocked: true }).blocked).toBe(true);
  });
});

describe("normalizeProduct", () => {
  it("normaliza a loja e os preços de cada oferta", () => {
    const p = normalizeProduct({
      ...MOCK_PRODUCTS[0],
      offers: [{ ...MOCK_PRODUCTS[0].offers[0], price_pix: "1899.90", store: lojaTexto }],
    } as unknown as ProductWithOffers);
    expect(p.offers[0].price_pix).toBe(1899.9);
    expect(p.offers[0].store.rating).toBe(4.8);
  });

  it("aguenta offers ausente", () => {
    const p = normalizeProduct({ ...MOCK_PRODUCTS[0], offers: undefined } as unknown as ProductWithOffers);
    expect(p.offers).toEqual([]);
  });
});

describe("recorded_at (G3)", () => {
  it("lastRecordedByOffer pega a data mais recente de cada oferta", () => {
    expect(
      lastRecordedByOffer([
        { offer_id: "a", recorded_at: "2026-06-01T12:00:00Z" },
        { offer_id: "a", recorded_at: "2026-06-15T12:00:00Z" },
        { offer_id: "b", recorded_at: "2026-05-01T12:00:00Z" },
      ]),
    ).toEqual({ a: "2026-06-15T12:00:00Z", b: "2026-05-01T12:00:00Z" });
  });

  it("attachRecordedAt preenche a oferta e usa null quando não há leitura", () => {
    const [p] = attachRecordedAt([MOCK_PRODUCTS[0]], { [MOCK_PRODUCTS[0].offers[0].id]: "2026-06-15T12:00:00Z" });
    expect(p.offers[0].recorded_at).toBe("2026-06-15T12:00:00Z");
    expect(p.offers[1].recorded_at).toBeNull();
    // Não muta o mock original.
    expect(MOCK_PRODUCTS[0].offers[0].recorded_at).toBeUndefined();
  });

  it("no mock, getProducts e getProductBySlug trazem a última data de MOCK_HISTORY", async () => {
    const lista = await getProducts();
    const oferta = lista.find((p) => p.slug === "rtx-4060")!.offers.find((o) => o.id === "o-4060-kabum")!;
    const ultima = MOCK_HISTORY["o-4060-kabum"].at(-1)!.recorded_at;
    expect(oferta.recorded_at).toBe(ultima);

    const peca = await getProductBySlug("rtx-4060");
    expect(peca!.offers.find((o) => o.id === "o-4060-kabum")!.recorded_at).toBe(ultima);
    expect(lista).toHaveLength(MOCK_PRODUCTS.length);
  });

  it("com Supabase, junta o max(recorded_at) da view offer_last_seen", async () => {
    const { client, chamadas } = clienteFalso({
      products: {
        data: [
          {
            ...MOCK_PRODUCTS[0],
            offers: MOCK_PRODUCTS[0].offers.map((o) => ({ ...o, store: { ...o.store, rating: "4.8" } })),
          },
        ],
        error: null,
      },
      offer_last_seen: {
        data: [{ offer_id: "o-4060-kabum", recorded_at: "2026-11-04T06:05:00Z" }],
        error: null,
      },
    });
    fake.client = client;

    const [p] = await getProducts();
    expect(p.offers.find((o) => o.id === "o-4060-kabum")!.recorded_at).toBe("2026-11-04T06:05:00Z");
    expect(p.offers.find((o) => o.id === "o-4060-pichau")!.recorded_at).toBeNull();
    expect(p.offers[0].store.rating).toBe(4.8);
    const filtro = chamadas.find((c) => c.tabela === "offer_last_seen" && c.metodo === "in");
    expect(filtro?.args[0]).toBe("offer_id");
  });

  it("se a view falhar, o catálogo continua (recorded_at fica null)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = clienteFalso({
      products: { data: [MOCK_PRODUCTS[0]], error: null },
      offer_last_seen: { data: null, error: { message: "relation does not exist" } },
    });
    fake.client = client;
    const peca = await getProductBySlug("rtx-4060");
    expect(peca!.offers.every((o) => o.recorded_at === null)).toBe(true);
  });
});

describe("sanitizeSearchTerm (SEG-05)", () => {
  it("remove os caracteres que mudam o filtro .or() do PostgREST", () => {
    expect(sanitizeSearchTerm("RTX 4060, 8GB")).toBe("rtx 4060 8gb");
    expect(sanitizeSearchTerm("a),id.eq.(1")).toBe("a id.eq. 1");
    expect(sanitizeSearchTerm(`100% "real"*`)).toBe("100 real");
    expect(sanitizeSearchTerm("  ,(),  ")).toBe("");
  });

  it("no banco, a busca com vírgula não quebra o filtro", async () => {
    const { client, chamadas } = clienteFalso({ products: { data: [], error: null }, offer_last_seen: { data: [], error: null } });
    fake.client = client;
    await searchProducts("RTX 4060, 8GB");
    const or = chamadas.find((c) => c.metodo === "or");
    expect(String(or?.args[0])).toBe("name.ilike.%rtx 4060 8gb%,brand.ilike.%rtx 4060 8gb%");
  });
});

describe("dayInSaoPaulo (LOG-13)", () => {
  it("usa o dia de Brasília, não o de UTC", () => {
    expect(dayInSaoPaulo("2026-06-15T01:30:00Z")).toBe("2026-06-14");
    expect(dayInSaoPaulo("2026-06-15T12:00:00Z")).toBe("2026-06-15");
  });

  it("getPriceHistory agrupa pelo dia de Brasília", async () => {
    const hist = await getPriceHistory(MOCK_PRODUCTS[0]);
    expect(hist.length).toBeGreaterThan(0);
    expect(hist.at(-1)!.date).toBe("2026-06-15");
  });
});

describe("getPriceHistory honesto (V2, S-17)", () => {
  // A RTX 4060 do mock tem uma oferta "boa demais" (Promo Center a R$ 1.399,90).
  const rtx = MOCK_PRODUCTS.find((p) => p.slug === "rtx-4060")!;
  const SUSPEITA = "o-4060-promocenter";

  /** Menor preço de cada dia só das ofertas honestas (Kabum e Pichau), direto do mock. */
  function minimoHonesto(): Map<string, number> {
    const m = new Map<string, number>();
    for (const id of ["o-4060-kabum", "o-4060-pichau"]) {
      for (const p of MOCK_HISTORY[id]) {
        const dia = dayInSaoPaulo(p.recorded_at);
        m.set(dia, Math.min(m.get(dia) ?? Infinity, p.price_pix));
      }
    }
    return m;
  }

  it("no mock, o preço suspeito (R$ 1.399,90) não entra no menor preço do dia", async () => {
    expect(rtx.offers.some((o) => o.id === SUSPEITA && o.price_pix === 1399.9)).toBe(true);
    MOCK_HISTORY[SUSPEITA] = [{ recorded_at: "2026-06-15T12:00:00Z", price_pix: 1399.9 }];
    try {
      const hist = await getPriceHistory(rtx);
      expect(hist.some((p) => p.price === 1399.9)).toBe(false);
      expect(hist.at(-1)).toEqual({ date: "2026-06-15", price: minimoHonesto().get("2026-06-15") });
    } finally {
      delete MOCK_HISTORY[SUSPEITA];
    }
  });

  it("com Supabase, só pede o histórico das ofertas honestas (sem suspeita nem loja bloqueada)", async () => {
    const bloqueada: Store = { ...rtx.offers[0].store, id: "golpe", name: "Loja do Golpe", blocked: true };
    const peca: ProductWithOffers = {
      ...rtx,
      offers: [
        ...rtx.offers,
        { ...rtx.offers[0], id: "o-4060-golpe", store_id: "golpe", price_pix: 999, store: bloqueada },
      ],
    };
    const ponto = (offer_id: string, price_pix: number) => ({ offer_id, recorded_at: "2026-06-15T12:00:00Z", price_pix });
    const { client, chamadas } = clienteFalso({
      price_history: {
        data: [ponto("o-4060-kabum", 1899.9), ponto("o-4060-pichau", 1929.9), ponto(SUSPEITA, 1399.9), ponto("o-4060-golpe", 999)],
        error: null,
      },
    });
    fake.client = client;

    const hist = await getPriceHistory(peca);
    const filtro = chamadas.find((c) => c.tabela === "price_history" && c.metodo === "in");
    expect(filtro?.args[0]).toBe("offer_id");
    expect(filtro?.args[1]).toEqual(["o-4060-kabum", "o-4060-pichau"]);
    expect(hist).toEqual([{ date: "2026-06-15", price: 1899.9 }]);
  });

  it("sem nenhuma oferta honesta, devolve vazio sem consultar o banco", async () => {
    const { client, chamadas } = clienteFalso({});
    fake.client = client;
    const semOfertas: ProductWithOffers = { ...rtx, offers: rtx.offers.map((o) => ({ ...o, in_stock: false })) };
    expect(await getPriceHistory(semOfertas)).toEqual([]);
    expect(chamadas.some((c) => c.tabela === "price_history")).toBe(false);
  });
});

describe("getPriceHistory pagina o histórico (DAD-02)", () => {
  const rtx = MOCK_PRODUCTS.find((p) => p.slug === "rtx-4060")!;

  /** `n` dias seguidos de leitura da Kabum, do mais novo para o mais antigo (como a consulta pede). */
  function pontosDiarios(n: number) {
    const fim = Date.parse("2026-11-04T12:00:00Z");
    return Array.from({ length: n }, (_, i) => ({
      offer_id: "o-4060-kabum",
      recorded_at: new Date(fim - i * 86_400_000).toISOString(),
      price_pix: 1800 + (i % 7),
    }));
  }

  it("com mais de 1.000 linhas, busca a segunda página e mantém os pontos mais recentes", async () => {
    const { client, chamadas } = clienteFalso({ price_history: { data: pontosDiarios(1500), error: null } });
    fake.client = client;

    const hist = await getPriceHistory(rtx);
    expect(hist).toHaveLength(1500);
    expect(hist.at(-1)!.date).toBe("2026-11-04");
    expect(hist[0].date).toBe(dayInSaoPaulo(new Date(Date.parse("2026-11-04T12:00:00Z") - 1499 * 86_400_000).toISOString()));

    const paginas = chamadas.filter((c) => c.tabela === "price_history" && c.metodo === "range").map((c) => c.args);
    expect(paginas).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    // Do mais novo para o mais antigo: se um dia faltar página, somem os pontos velhos, não os de hoje.
    const ordem = chamadas.find((c) => c.tabela === "price_history" && c.metodo === "order");
    expect(ordem?.args).toEqual(["recorded_at", { ascending: false }]);
  });

  it("com exatamente 1.000 linhas, confere a página seguinte (vazia) e para", async () => {
    const { client, chamadas } = clienteFalso({ price_history: { data: pontosDiarios(1000), error: null } });
    fake.client = client;
    expect(await getPriceHistory(rtx)).toHaveLength(1000);
    expect(chamadas.filter((c) => c.tabela === "price_history" && c.metodo === "range")).toHaveLength(2);
  });

  it("erro em qualquer página devolve vazio (a tela não mostra um gráfico pela metade)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = clienteFalso({ price_history: { data: null, error: { message: "timeout" } } });
    fake.client = client;
    expect(await getPriceHistory(rtx)).toEqual([]);
  });
});
