// Testes do serviço de specs (V2, pacote A1).
// Sem Supabase configurado (caso destes testes), o serviço precisa cair no mock
// para o modo de demonstração continuar igual à V1.

import { afterEach, describe, expect, it, vi } from "vitest";
import { getPartSpecs, rowToPartSpec, type PartSpecRow } from "./specs";
import { PART_SPECS } from "@/models/part-specs";

// Cliente falso controlável: por padrão null (= sem Supabase, modo demonstração).
const fake = vi.hoisted(() => ({
  client: null as unknown,
}));
vi.mock("@/models/supabase", () => ({
  getSupabase: () => fake.client,
  isSupabaseConfigured: () => fake.client !== null,
}));

/** Monta um cliente mínimo cujo .from().select() resolve com a resposta dada. */
function clienteCom(resposta: { data: unknown; error: { message: string } | null }) {
  return { from: () => ({ select: () => Promise.resolve(resposta) }) };
}

afterEach(() => {
  fake.client = null;
  vi.restoreAllMocks();
});

describe("getPartSpecs", () => {
  it("devolve o mock sem Supabase", async () => {
    expect(await getPartSpecs()).toEqual(PART_SPECS);
  });

  it("devolve o mock quando o Supabase dá erro", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fake.client = clienteCom({ data: null, error: { message: "falhou" } });
    expect(await getPartSpecs()).toEqual(PART_SPECS);
  });

  it("devolve o mock quando a tabela part_specs está vazia", async () => {
    fake.client = clienteCom({ data: [], error: null });
    expect(await getPartSpecs()).toEqual(PART_SPECS);
  });

  it("usa as linhas do banco quando existem (chaveadas pelo slug)", async () => {
    fake.client = clienteCom({
      data: [
        {
          product_id: "u1",
          perf: "100.0",
          aesthetics: 50,
          tdp: 115,
          socket: null,
          ram_type: null,
          form_factor: null,
          case_supports: null,
          wattage: null,
          capacity_gb: null,
          upscaling: ["DLSS", "FSR"],
          source: "fabricante",
          product: { slug: "rtx-4060", category: "gpu" },
        },
      ],
      error: null,
    });
    expect(await getPartSpecs()).toEqual({
      "rtx-4060": {
        slug: "rtx-4060",
        category: "gpu",
        perf: 100,
        aesthetics: 50,
        tdp: 115,
        upscaling: ["DLSS", "FSR"],
        source: "fabricante",
      },
    });
  });
});

describe("rowToPartSpec", () => {
  it("converte uma linha completa de placa-mãe (snake_case → camelCase)", () => {
    const row: PartSpecRow = {
      product_id: "uuid-1",
      perf: "100.0", // numeric do Postgres chega como string
      aesthetics: 60,
      tdp: null,
      socket: "AM5",
      ram_type: "DDR5",
      form_factor: "mATX",
      case_supports: null,
      wattage: null,
      capacity_gb: null,
      upscaling: null,
      source: "ilustrativo (V1)",
      product: { slug: "b650m-asus", category: "motherboard" },
    };
    expect(rowToPartSpec(row)).toEqual({
      slug: "b650m-asus",
      category: "motherboard",
      perf: 100,
      aesthetics: 60,
      socket: "AM5",
      ramType: "DDR5",
      formFactor: "mATX",
      source: "ilustrativo (V1)",
    });
  });

  it("mapeia gabinete, GPU, RAM e fonte, omitindo campos nulos", () => {
    const base = {
      product_id: "x",
      tdp: null,
      socket: null,
      ram_type: null,
      form_factor: null,
      case_supports: null,
      wattage: null,
      capacity_gb: null,
      upscaling: null,
      source: null,
    };
    expect(
      rowToPartSpec({
        ...base,
        perf: 85,
        aesthetics: 95,
        case_supports: ["ATX", "mATX", "ITX"],
        product: { slug: "montech-sky-two", category: "case" },
      })
    ).toEqual({
      slug: "montech-sky-two",
      category: "case",
      perf: 85,
      aesthetics: 95,
      caseSupports: ["ATX", "mATX", "ITX"],
    });
    expect(
      rowToPartSpec({
        ...base,
        perf: 100,
        aesthetics: 50,
        tdp: 115,
        upscaling: ["DLSS", "FSR"],
        product: { slug: "rtx-4060", category: "gpu" },
      })
    ).toEqual({
      slug: "rtx-4060",
      category: "gpu",
      perf: 100,
      aesthetics: 50,
      tdp: 115,
      upscaling: ["DLSS", "FSR"],
    });
    expect(
      rowToPartSpec({
        ...base,
        perf: 130,
        aesthetics: 85,
        ram_type: "DDR5",
        capacity_gb: 32,
        product: { slug: "xpg-lancer-rgb-32gb-ddr5", category: "ram" },
      })?.capacityGb
    ).toBe(32);
    expect(
      rowToPartSpec({
        ...base,
        perf: 100,
        aesthetics: 30,
        wattage: 650,
        product: { slug: "corsair-cv650", category: "psu" },
      })?.wattage
    ).toBe(650);
  });

  it("devolve null quando a linha não tem produto (join vazio)", () => {
    expect(
      rowToPartSpec({
        product_id: "órfão",
        perf: 10,
        aesthetics: 10,
        tdp: null,
        socket: null,
        ram_type: null,
        form_factor: null,
        case_supports: null,
        wattage: null,
        capacity_gb: null,
        upscaling: null,
        source: null,
        product: null,
      })
    ).toBeNull();
  });
});
