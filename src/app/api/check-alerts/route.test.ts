// Testes da rota de alertas (V2, F-20): é ela que usa a chave service_role, então
// as travas não podem sumir em silêncio.
// - SEG-01: sem CRON_SECRET → 503; token errado → 401 (e o banco nem é aberto).
// - SEG-02: e-mail simulado (sem RESEND_API_KEY) NÃO marca o alerta como avisado.
// - DAD-05: e-mail enviado de verdade desliga o alerta e grava notified_at.
// - R-01: oferta "boa demais" não dispara alerta.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MOCK_PRODUCTS } from "@/models/mock-data";
import type { SendEmailResult } from "@/services/email";

type Consulta = { tabela: string; verbo: string; args: unknown[]; filtros: [string, ...unknown[]][] };

const fake = vi.hoisted(() => ({
  admin: null as unknown,
  getAdmin: 0,
}));
const envio = vi.hoisted(() => ({ sendEmail: vi.fn() }));

vi.mock("@/models/supabase-admin", () => ({
  getAdminSupabase: () => {
    fake.getAdmin++;
    return fake.admin;
  },
}));
vi.mock("@/services/email", async (original) => ({
  ...(await original<typeof import("@/services/email")>()),
  sendEmail: envio.sendEmail,
}));

import { GET } from "./route";

const SEGREDO = "segredo-de-teste";
const RTX = MOCK_PRODUCTS.find((p) => p.slug === "rtx-4060")!;

/**
 * Cliente admin falso: price_alerts devolve `alertas` no select e anota os
 * updates; auth.admin.getUserById devolve um e-mail.
 */
function adminFalso(alertas: unknown[], opts: { erroUpdate?: boolean } = {}) {
  const consultas: Consulta[] = [];
  fake.admin = {
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: { email: `${id}@exemplo.com` } } }) } },
    from(tabela: string) {
      const c: Consulta = { tabela, verbo: "", args: [], filtros: [] };
      consultas.push(c);
      const b: Record<string, unknown> = {};
      for (const verbo of ["select", "update", "insert", "delete"]) {
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
      b.then = (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => {
        const resposta =
          c.verbo === "update"
            ? { data: null, error: opts.erroUpdate ? { message: "falhou" } : null }
            : { data: tabela === "price_alerts" ? alertas : [], error: null };
        return Promise.resolve(resposta).then(ok, erro);
      };
      return b;
    },
  };
  return consultas;
}

/** Alerta de peça da RTX 4060 (o melhor preço honesto hoje é R$ 1.899,90). */
function alertaDaRtx(target_price: number) {
  return { id: "a1", user_id: "u1", target_price, product_id: RTX.id, saved_build_id: null, product: RTX, saved_build: null };
}

function chamar(auth?: string): Promise<Response> {
  const headers = new Headers();
  if (auth !== undefined) headers.set("authorization", auth);
  return GET(new Request("http://localhost/api/check-alerts", { headers }));
}

const updates = (consultas: Consulta[]) => consultas.filter((c) => c.tabela === "price_alerts" && c.verbo === "update");

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  envio.sendEmail.mockReset();
  fake.admin = null;
  fake.getAdmin = 0;
});

describe("check-alerts: segredo (SEG-01)", () => {
  it("sem CRON_SECRET configurado responde 503 e não abre o banco", async () => {
    vi.stubEnv("CRON_SECRET", undefined);
    adminFalso([alertaDaRtx(5000)]);
    const res = await chamar(`Bearer ${SEGREDO}`);
    expect(res.status).toBe(503);
    expect(fake.getAdmin).toBe(0);
    expect(envio.sendEmail).not.toHaveBeenCalled();
  });

  it("CRON_SECRET vazio também conta como não configurado", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await chamar("Bearer ")).status).toBe(503);
  });

  it("token errado, ausente ou sem 'Bearer' responde 401 e não abre o banco", async () => {
    vi.stubEnv("CRON_SECRET", SEGREDO);
    adminFalso([alertaDaRtx(5000)]);
    for (const auth of ["Bearer errado", undefined, SEGREDO, `Bearer ${SEGREDO}x`, `bearer ${SEGREDO}`]) {
      expect((await chamar(auth)).status, String(auth)).toBe(401);
    }
    expect(fake.getAdmin).toBe(0);
    expect(envio.sendEmail).not.toHaveBeenCalled();
  });

  it("token certo passa", async () => {
    vi.stubEnv("CRON_SECRET", SEGREDO);
    adminFalso([]);
    const res = await chamar(`Bearer ${SEGREDO}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ verificados: 0, emails_enviados: 0, simulados: 0, falhas: 0 });
  });
});

describe("check-alerts: marcar como avisado só com e-mail de verdade", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SEGREDO);
  });

  it("e-mail simulado NÃO grava notified_at (SEG-02)", async () => {
    const consultas = adminFalso([alertaDaRtx(2000)]);
    envio.sendEmail.mockResolvedValue({ ok: true, simulated: true } satisfies SendEmailResult);
    const res = await chamar(`Bearer ${SEGREDO}`);
    expect(await res.json()).toMatchObject({ verificados: 1, emails_enviados: 0, simulados: 1 });
    expect(envio.sendEmail).toHaveBeenCalledTimes(1);
    expect(updates(consultas)).toHaveLength(0);
  });

  it("e-mail enviado desliga o alerta e grava notified_at (DAD-05)", async () => {
    const consultas = adminFalso([alertaDaRtx(2000)]);
    envio.sendEmail.mockResolvedValue({ ok: true, simulated: false } satisfies SendEmailResult);
    const res = await chamar(`Bearer ${SEGREDO}`);
    expect(await res.json()).toMatchObject({ emails_enviados: 1, simulados: 0, falhas: 0 });
    const [update] = updates(consultas);
    const campos = update.args[0] as { notified_at: string; is_active: boolean };
    expect(campos.is_active).toBe(false);
    expect(Number.isNaN(Date.parse(campos.notified_at))).toBe(false);
    expect(update.filtros).toContainEqual(["eq", "id", "a1"]);
  });

  it("falha no envio não marca o alerta e conta como falha", async () => {
    const consultas = adminFalso([alertaDaRtx(2000)]);
    envio.sendEmail.mockResolvedValue({ ok: false, simulated: false, error: "caiu" } satisfies SendEmailResult);
    expect(await (await chamar(`Bearer ${SEGREDO}`)).json()).toMatchObject({ emails_enviados: 0, falhas: 1 });
    expect(updates(consultas)).toHaveLength(0);
  });

  it("a oferta suspeita (R$ 1.399,90) não dispara o alerta de R$ 1.500 (R-01)", async () => {
    const consultas = adminFalso([alertaDaRtx(1500)]);
    envio.sendEmail.mockResolvedValue({ ok: true, simulated: false } satisfies SendEmailResult);
    expect(await (await chamar(`Bearer ${SEGREDO}`)).json()).toMatchObject({ verificados: 1, emails_enviados: 0 });
    expect(envio.sendEmail).not.toHaveBeenCalled();
    expect(updates(consultas)).toHaveLength(0);
  });

  it("só lê alertas ativos e ainda não avisados", async () => {
    const consultas = adminFalso([]);
    await chamar(`Bearer ${SEGREDO}`);
    const leitura = consultas.find((c) => c.tabela === "price_alerts" && c.verbo === "select");
    expect(leitura?.filtros).toContainEqual(["eq", "is_active", true]);
    expect(leitura?.filtros).toContainEqual(["is", "notified_at", null]);
  });
});
