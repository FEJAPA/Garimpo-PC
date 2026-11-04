// Testes do serviço de specs (V2, pacote A1 + correções da onda 2).
//
// Regra do AGENTS.md ("dado ilustrativo nunca vira fato no modo real"):
//   - sem Supabase configurado -> mock (modo de demonstração);
//   - com Supabase, erro ou tabela vazia -> {} (a tela avisa), NUNCA o mock.
// Linha inválida ou incompleta é descartada (e contada no log): uma spec ruim
// faria o Montador montar PC incompatível ou mostrar FPS falso (LOG-02/03/16).

import { afterEach, describe, expect, it, vi } from "vitest";
import { getPartSpecs, rowToPartSpec, type PartSpecRow } from "./specs";
import { PART_SPECS } from "@/models/part-specs";
import type { PartSpec } from "@/models/builder-types";

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

/** Linha de part_specs com todas as colunas opcionais nulas; cada teste preenche o que precisa. */
function linha(extra: Partial<PartSpecRow> & Pick<PartSpecRow, "product">): PartSpecRow {
  return {
    product_id: "uuid-x",
    perf: 100,
    aesthetics: 50,
    tdp: null,
    socket: null,
    ram_type: null,
    form_factor: null,
    case_supports: null,
    wattage: null,
    capacity_gb: null,
    upscaling: null,
    source: null,
    ...extra,
  };
}

/** Linha válida de cada categoria (as mesmas regras do hasRequiredSpec de compatibility.ts). */
const VALIDAS: Record<string, PartSpecRow> = {
  gpu: linha({ tdp: 115, product: { slug: "gpu-ok", category: "gpu" } }),
  cpu: linha({ tdp: 65, socket: "AM5", product: { slug: "cpu-ok", category: "cpu" } }),
  motherboard: linha({
    socket: "AM5",
    ram_type: "DDR5",
    form_factor: "mATX",
    product: { slug: "mobo-ok", category: "motherboard" },
  }),
  ram: linha({ ram_type: "DDR5", capacity_gb: 16, product: { slug: "ram-ok", category: "ram" } }),
  ssd: linha({ capacity_gb: 1000, product: { slug: "ssd-ok", category: "ssd" } }),
  psu: linha({ wattage: 650, product: { slug: "psu-ok", category: "psu" } }),
  case: linha({ case_supports: ["ATX", "mATX"], product: { slug: "case-ok", category: "case" } }),
};

/** Transforma uma spec do mock de volta em linha do banco (para provar que o mock também passa nas regras). */
function linhaDe(s: PartSpec): PartSpecRow {
  return linha({
    perf: s.perf,
    aesthetics: s.aesthetics,
    tdp: s.tdp ?? null,
    socket: s.socket ?? null,
    ram_type: s.ramType ?? null,
    form_factor: s.formFactor ?? null,
    case_supports: s.caseSupports ?? null,
    wattage: s.wattage ?? null,
    capacity_gb: s.capacityGb ?? null,
    upscaling: s.upscaling ?? null,
    source: s.source ?? null,
    product: { slug: s.slug, category: s.category },
  });
}

afterEach(() => {
  fake.client = null;
  vi.restoreAllMocks();
});

describe("getPartSpecs", () => {
  it("devolve o mock sem Supabase (modo de demonstração)", async () => {
    expect(await getPartSpecs()).toEqual(PART_SPECS);
  });

  it("com Supabase, erro na consulta devolve {} e NÃO o mock", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    fake.client = clienteCom({ data: null, error: { message: "falhou" } });
    expect(await getPartSpecs()).toEqual({});
    expect(erro).toHaveBeenCalledTimes(1);
  });

  it("com Supabase, tabela part_specs vazia devolve {} (com aviso) e NÃO o mock", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    fake.client = clienteCom({ data: [], error: null });
    expect(await getPartSpecs()).toEqual({});
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it("com Supabase, data nula sem erro também devolve {}", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fake.client = clienteCom({ data: null, error: null });
    expect(await getPartSpecs()).toEqual({});
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

  it("ignora linhas inválidas ou incompletas e conta quantas no log", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    fake.client = clienteCom({
      data: [
        VALIDAS.gpu,
        linha({ tdp: 65, product: { slug: "categoria-torta", category: "GPU" } }), // categoria desconhecida
        linha({ perf: "abc", tdp: 100, product: { slug: "perf-nan", category: "gpu" } }), // perf não numérico
        linha({ tdp: 100, product: null }), // join vazio (órfã)
      ],
      error: null,
    });
    const specs = await getPartSpecs();
    expect(Object.keys(specs)).toEqual(["gpu-ok"]);
    expect(aviso).toHaveBeenCalledTimes(1);
    const mensagem = String(aviso.mock.calls[0][0]);
    expect(mensagem).toContain("3");
    expect(mensagem).toContain("categoria-torta");
    expect(mensagem).toContain("perf-nan");
  });

  it("não avisa nada quando todas as linhas são válidas", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    fake.client = clienteCom({ data: [VALIDAS.gpu, VALIDAS.cpu], error: null });
    expect(Object.keys(await getPartSpecs()).sort()).toEqual(["cpu-ok", "gpu-ok"]);
    expect(aviso).not.toHaveBeenCalled();
  });

  it("se TODAS as linhas forem inválidas devolve {} (não cai no mock)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fake.client = clienteCom({
      data: [linha({ perf: 0, tdp: 100, product: { slug: "x", category: "gpu" } })],
      error: null,
    });
    expect(await getPartSpecs()).toEqual({});
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
    expect(
      rowToPartSpec(
        linha({
          perf: 85,
          aesthetics: 95,
          case_supports: ["ATX", "mATX", "ITX"],
          product: { slug: "montech-sky-two", category: "case" },
        })
      )
    ).toEqual({
      slug: "montech-sky-two",
      category: "case",
      perf: 85,
      aesthetics: 95,
      caseSupports: ["ATX", "mATX", "ITX"],
    });
    expect(
      rowToPartSpec(
        linha({
          perf: 100,
          aesthetics: 50,
          tdp: 115,
          upscaling: ["DLSS", "FSR"],
          product: { slug: "rtx-4060", category: "gpu" },
        })
      )
    ).toEqual({
      slug: "rtx-4060",
      category: "gpu",
      perf: 100,
      aesthetics: 50,
      tdp: 115,
      upscaling: ["DLSS", "FSR"],
    });
    expect(
      rowToPartSpec(
        linha({
          perf: 130,
          aesthetics: 85,
          ram_type: "DDR5",
          capacity_gb: 32,
          product: { slug: "xpg-lancer-rgb-32gb-ddr5", category: "ram" },
        })
      )?.capacityGb
    ).toBe(32);
    expect(
      rowToPartSpec(
        linha({ aesthetics: 30, wattage: 650, product: { slug: "corsair-cv650", category: "psu" } })
      )?.wattage
    ).toBe(650);
  });

  it("devolve null quando a linha não tem produto (join vazio)", () => {
    expect(rowToPartSpec(linha({ perf: 10, aesthetics: 10, product: null }))).toBeNull();
  });

  describe("linhas válidas", () => {
    it.each(Object.keys(VALIDAS))("aceita uma linha completa de %s", (categoria) => {
      const spec = rowToPartSpec(VALIDAS[categoria]);
      expect(spec).not.toBeNull();
      expect(spec?.category).toBe(categoria);
    });

    it("todas as 20 specs do mock passam nas mesmas regras", () => {
      for (const s of Object.values(PART_SPECS)) {
        expect(rowToPartSpec(linhaDe(s)), s.slug).toEqual(s);
      }
    });

    it("aceita aesthetics nos limites 0 e 100", () => {
      expect(rowToPartSpec({ ...VALIDAS.gpu, aesthetics: 0 })?.aesthetics).toBe(0);
      expect(rowToPartSpec({ ...VALIDAS.gpu, aesthetics: 100 })?.aesthetics).toBe(100);
    });
  });

  describe("categoria", () => {
    it.each(["GPU", "gpu ", "cooler", "", "constructor", "__proto__"])(
      "devolve null para categoria desconhecida: %j",
      (categoria) => {
        expect(rowToPartSpec({ ...VALIDAS.gpu, product: { slug: "x", category: categoria } })).toBeNull();
      }
    );

    it("devolve null quando a categoria da spec difere da do produto", () => {
      expect(rowToPartSpec({ ...VALIDAS.gpu, category: "cpu" })).toBeNull();
    });

    it("aceita quando a categoria da spec é igual à do produto", () => {
      expect(rowToPartSpec({ ...VALIDAS.gpu, category: "gpu" })?.category).toBe("gpu");
    });
  });

  describe("perf (LOG-16)", () => {
    it.each([
      ["texto inválido", "abc"],
      ["vazio", ""],
      ["zero", 0],
      ["negativo", -5],
      ["NaN", NaN],
      ["Infinity", Infinity],
      ["nulo", null as unknown as number],
    ])("devolve null para perf %s", (_nome, perf) => {
      expect(rowToPartSpec({ ...VALIDAS.gpu, perf })).toBeNull();
    });

    it("aceita perf numérico em texto (numeric do Postgres)", () => {
      expect(rowToPartSpec({ ...VALIDAS.gpu, perf: "78.5" })?.perf).toBe(78.5);
    });

    it("SSD só exige perf válido além do básico", () => {
      expect(rowToPartSpec({ ...VALIDAS.ssd, perf: 0 })).toBeNull();
      expect(rowToPartSpec(VALIDAS.ssd)).not.toBeNull();
    });
  });

  describe("aesthetics", () => {
    it.each([
      ["abaixo de 0", -1],
      ["acima de 100", 101],
      ["NaN", NaN],
      ["nulo", null as unknown as number],
    ])("devolve null para aesthetics %s", (_nome, aesthetics) => {
      expect(rowToPartSpec({ ...VALIDAS.gpu, aesthetics })).toBeNull();
    });
  });

  describe("campos obrigatórios por categoria (LOG-02)", () => {
    it("gpu sem tdp (ou tdp 0)", () => {
      expect(rowToPartSpec({ ...VALIDAS.gpu, tdp: null })).toBeNull();
      expect(rowToPartSpec({ ...VALIDAS.gpu, tdp: 0 })).toBeNull();
    });

    it("cpu sem tdp", () => {
      expect(rowToPartSpec({ ...VALIDAS.cpu, tdp: null })).toBeNull();
    });

    it("cpu sem socket", () => {
      expect(rowToPartSpec({ ...VALIDAS.cpu, socket: null })).toBeNull();
    });

    it.each([
      ["socket", { socket: null }],
      ["ramType", { ram_type: null }],
      ["formFactor", { form_factor: null }],
    ])("placa-mãe sem %s", (_nome, falta) => {
      expect(rowToPartSpec({ ...VALIDAS.motherboard, ...falta })).toBeNull();
    });

    it("ram sem ramType", () => {
      expect(rowToPartSpec({ ...VALIDAS.ram, ram_type: null })).toBeNull();
    });

    it("gabinete sem caseSupports, ou com lista vazia", () => {
      expect(rowToPartSpec({ ...VALIDAS.case, case_supports: null })).toBeNull();
      expect(rowToPartSpec({ ...VALIDAS.case, case_supports: [] })).toBeNull();
    });

    it("fonte sem wattage (ou wattage 0)", () => {
      expect(rowToPartSpec({ ...VALIDAS.psu, wattage: null })).toBeNull();
      expect(rowToPartSpec({ ...VALIDAS.psu, wattage: 0 })).toBeNull();
    });

    it("campos obrigatórios de OUTRA categoria não são exigidos (ssd sem socket/tdp é válido)", () => {
      expect(rowToPartSpec(VALIDAS.ssd)).not.toBeNull();
      expect(rowToPartSpec(VALIDAS.ram)).not.toBeNull(); // ram sem tdp/socket
    });
  });
});
