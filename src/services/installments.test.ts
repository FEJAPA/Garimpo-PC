import { describe, it, expect, vi, beforeEach } from "vitest";

// O teste não pode depender de um banco de verdade: trocamos getSupabase por
// um dublê que cada caso configura.
const getSupabaseMock = vi.fn();
vi.mock("@/models/supabase", () => ({
  getSupabase: () => getSupabaseMock(),
  isSupabaseConfigured: () => getSupabaseMock() !== null,
}));

import { getInstallmentTables, groupInstallmentRows } from "./installments";
import { INSTALLMENT_TABLES } from "@/models/installment-tables";

/** Cliente falso que responde a `.from(...).select(...)` com o resultado dado. */
function clienteFalso(resultado: { data: unknown; error: { message: string } | null }) {
  return { from: () => ({ select: async () => resultado }) };
}

describe("getInstallmentTables", () => {
  beforeEach(() => {
    getSupabaseMock.mockReset();
  });

  it("sem Supabase devolve o mock", async () => {
    getSupabaseMock.mockReturnValue(null);
    expect(await getInstallmentTables()).toEqual(INSTALLMENT_TABLES);
  });

  it("com Supabase agrupa as linhas por loja, em ordem de parcelas", async () => {
    getSupabaseMock.mockReturnValue(
      clienteFalso({
        data: [
          { store_id: "kabum", count: 12, factor: "1.0600" },
          { store_id: "kabum", count: 10, factor: "1.0000" },
          { store_id: "pichau", count: 12, factor: 1 },
        ],
        error: null,
      })
    );
    expect(await getInstallmentTables()).toEqual({
      kabum: [
        { count: 10, factor: 1 },
        { count: 12, factor: 1.06 },
      ],
      pichau: [{ count: 12, factor: 1 }],
    });
  });

  // Com banco de verdade, NÃO misturamos os juros ilustrativos do mock com
  // ofertas reais: sem tabela, vale o preço parcelado da própria oferta (V1).
  it("se o banco der erro, devolve vazio (vale o parcelado das ofertas)", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});
    getSupabaseMock.mockReturnValue(clienteFalso({ data: null, error: { message: "tabela não existe" } }));
    expect(await getInstallmentTables()).toEqual({});
    expect(espiao).toHaveBeenCalled();
    espiao.mockRestore();
  });

  it("se o banco não tiver nenhuma linha, devolve vazio", async () => {
    getSupabaseMock.mockReturnValue(clienteFalso({ data: [], error: null }));
    expect(await getInstallmentTables()).toEqual({});
  });
});

describe("groupInstallmentRows", () => {
  it("ignora linhas inválidas (parcelas < 1 ou fator < 1)", () => {
    expect(
      groupInstallmentRows([
        { store_id: "x", count: 0, factor: 1 },
        { store_id: "x", count: 3, factor: 0.5 },
        { store_id: "x", count: 6, factor: "abc" },
        { store_id: "x", count: 10, factor: 1.05 },
      ])
    ).toEqual({ x: [{ count: 10, factor: 1.05 }] });
  });
});

describe("mock de tabelas de juros", () => {
  it("cada tabela está em ordem crescente de parcelas e com fator >= 1", () => {
    for (const tabela of Object.values(INSTALLMENT_TABLES)) {
      expect(tabela.length).toBeGreaterThan(0);
      for (let i = 0; i < tabela.length; i++) {
        expect(tabela[i].factor).toBeGreaterThanOrEqual(1);
        if (i > 0) expect(tabela[i].count).toBeGreaterThan(tabela[i - 1].count);
      }
    }
  });
});
