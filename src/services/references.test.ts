import { describe, it, expect, vi, beforeEach } from "vitest";
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
});
