import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { REFERENCE_BUILDS } from "@/models/reference-builds";

// O cliente do Supabase é trocado por um falso em cada teste.
const supabaseFalso = vi.hoisted(() => ({ atual: null as unknown }));
vi.mock("@/models/supabase", () => ({
  getSupabase: () => supabaseFalso.atual,
  isSupabaseConfigured: () => supabaseFalso.atual !== null,
}));

import { getReferenceBuilds, mapReferenceRow, type ReferenceBuildRow } from "./references";

/** Cliente falso que responde a from().select().order() com o resultado dado. */
function clienteQueResponde(resultado: { data: unknown; error: { message: string } | null }) {
  const order = vi.fn().mockResolvedValue(resultado);
  const select = vi.fn(() => ({ order }));
  const from = vi.fn(() => ({ select }));
  return { from, select, order };
}

const linha: ReferenceBuildRow = {
  id: "entrada",
  name: "PC de entrada",
  description: "Full HD no alto",
  parts: "RTX 4060 + Ryzen 5 7600 + 16 GB DDR5",
  approx_price: "5800.00",
  score: "100.0",
  fps: {
    esports: { "1080p": 270, "1440p": 200 },
    "aaa-medio": { "1080p": 102, "1440p": 74 },
    "aaa-pesado": { "1080p": 52, "1440p": 36 },
  },
  ram_gb: 16,
  source: "estimativa a partir de checkfps.io",
  measured_at: "2026-10-01",
};

describe("mapReferenceRow", () => {
  it("converte snake_case do banco para ReferenceBuild (números, AAAA-MM)", () => {
    expect(mapReferenceRow(linha)).toEqual({
      id: "entrada",
      name: "PC de entrada",
      description: "Full HD no alto",
      parts: "RTX 4060 + Ryzen 5 7600 + 16 GB DDR5",
      approxPrice: 5800,
      score: 100,
      fps: linha.fps,
      ramGb: 16,
      source: "estimativa a partir de checkfps.io",
      measuredAt: "2026-10",
    });
  });

  it("campos opcionais nulos viram ausentes e texto nulo vira vazio", () => {
    const r = mapReferenceRow({ ...linha, description: null, parts: null, approx_price: null, ram_gb: null, source: null, measured_at: null });
    expect(r.description).toBe("");
    expect(r.parts).toBe("");
    expect(r.approxPrice).toBe(0);
    expect(r).not.toHaveProperty("ramGb");
    expect(r).not.toHaveProperty("source");
    expect(r).not.toHaveProperty("measuredAt");
  });

  it("aceita fps em texto JSON", () => {
    expect(mapReferenceRow({ ...linha, fps: JSON.stringify(linha.fps) }).fps).toEqual(linha.fps);
  });

  it("rejeita score zero, negativo, infinito ou que não é número (LOG-14: evita 0/0 na interpolação)", () => {
    for (const score of [0, "0", -5, "-1.5", "abc", Number.NaN, Number.POSITIVE_INFINITY, ""]) {
      expect(() => mapReferenceRow({ ...linha, score }), `score ${String(score)}`).toThrow(/score inválido/);
    }
  });

  it("rejeita fps incompleto ou com número inválido (NaN, infinito, zero, negativo, texto)", () => {
    const fpsBom = linha.fps as Record<string, Record<string, unknown>>;
    const comEsportsFullHd = (valor: unknown) => ({
      ...fpsBom,
      esports: { ...fpsBom.esports, "1080p": valor },
    });
    for (const valor of [Number.NaN, Number.POSITIVE_INFINITY, 0, -10, "270", null, undefined]) {
      expect(() => mapReferenceRow({ ...linha, fps: comEsportsFullHd(valor) }), `fps ${String(valor)}`).toThrow(/fps inválido/);
    }
    expect(() => mapReferenceRow({ ...linha, fps: { esports: { "1080p": 1, "1440p": 1 } } })).toThrow(/fps inválido/);
    expect(() => mapReferenceRow({ ...linha, fps: null })).toThrow(/fps inválido/);
    expect(() => mapReferenceRow({ ...linha, fps: "{não é json" })).toThrow(/fps inválido/);
  });

  it("ram_gb e preço que não são números válidos não viram NaN", () => {
    const r = mapReferenceRow({ ...linha, ram_gb: "abc", approx_price: "abc" });
    expect(r).not.toHaveProperty("ramGb");
    expect(r.approxPrice).toBe(0);
    expect(mapReferenceRow({ ...linha, ram_gb: 0 })).not.toHaveProperty("ramGb");
  });
});

describe("getReferenceBuilds", () => {
  beforeEach(() => {
    supabaseFalso.atual = null;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("sem Supabase configurado devolve a lista local", async () => {
    expect(await getReferenceBuilds()).toBe(REFERENCE_BUILDS);
  });

  it("com erro no banco devolve a lista local", async () => {
    supabaseFalso.atual = clienteQueResponde({ data: null, error: { message: "falhou" } });
    expect(await getReferenceBuilds()).toBe(REFERENCE_BUILDS);
  });

  it("com tabela vazia devolve a lista local", async () => {
    supabaseFalso.atual = clienteQueResponde({ data: [], error: null });
    expect(await getReferenceBuilds()).toBe(REFERENCE_BUILDS);
  });

  it("com dados lê reference_builds, mapeia e ordena por score", async () => {
    const cliente = clienteQueResponde({
      data: [
        { ...linha, id: "b", score: 150 },
        { ...linha, id: "a", score: 80 },
      ],
      error: null,
    });
    supabaseFalso.atual = cliente;
    const refs = await getReferenceBuilds();
    expect(cliente.from).toHaveBeenCalledWith("reference_builds");
    expect(cliente.order).toHaveBeenCalledWith("score", { ascending: true });
    expect(refs.map((r) => r.id)).toEqual(["a", "b"]);
    expect(refs[0].approxPrice).toBe(5800);
  });

  it("descarta linhas com fps inválido e cai na lista local se nada sobrar", async () => {
    supabaseFalso.atual = clienteQueResponde({ data: [{ ...linha, fps: { esports: {} } }], error: null });
    expect(await getReferenceBuilds()).toBe(REFERENCE_BUILDS);
  });

  it("descarta linhas com score zero e mantém as boas", async () => {
    supabaseFalso.atual = clienteQueResponde({
      data: [
        { ...linha, id: "ruim", score: 0 },
        { ...linha, id: "boa", score: 90 },
      ],
      error: null,
    });
    expect((await getReferenceBuilds()).map((r) => r.id)).toEqual(["boa"]);
  });

  it("se só sobrar score inválido, cai na lista local", async () => {
    supabaseFalso.atual = clienteQueResponde({ data: [{ ...linha, score: -1 }], error: null });
    expect(await getReferenceBuilds()).toBe(REFERENCE_BUILDS);
  });
});

// Os seeds SQL são texto, mas os testes guardam o que importa neles: a lista do código
// e o seed-references.sql não podem divergir, e o seed-builder.sql não pode voltar a
// gravar referências antigas por cima (R-10).
describe("seeds SQL das referências", () => {
  const ler = (nome: string) => readFileSync(fileURLToPath(new URL(`../../supabase/${nome}`, import.meta.url)), "utf-8");
  const sqlTexto = (t: string) => t.replace(/'/g, "''");

  it("seed-builder.sql não grava mais reference_builds (a fonte é seed-references.sql)", () => {
    expect(ler("seed-builder.sql")).not.toMatch(/insert\s+into\s+public\.reference_builds/i);
  });

  it("seed-references.sql não tem o TODO velho sobre ram_gb", () => {
    expect(ler("seed-references.sql")).not.toContain("TODO(V2-D)");
  });

  it("seed-references.sql traz as mesmas referências, fontes e mês da lista do código", () => {
    const sql = ler("seed-references.sql");
    for (const r of REFERENCE_BUILDS) {
      expect(sql, r.id).toContain(`('${r.id}', '${sqlTexto(r.name)}', '${sqlTexto(r.description)}', '${sqlTexto(r.parts)}', ${r.approxPrice}, ${r.score},`);
      expect(sql, `source de ${r.id}`).toContain(`'${sqlTexto(r.source!)}'`);
      expect(sql, `data de ${r.id}`).toContain(`'${r.measuredAt}-01'::date`);
      expect(sql, `fps/ram de ${r.id}`).toContain(`, ${r.score}, '${JSON.stringify(r.fps)}'::jsonb, ${r.ramGb},`);
    }
    // Nenhum mês de coleta que a fonte não tem.
    expect(sql).not.toContain("out/2026");
  });
});
