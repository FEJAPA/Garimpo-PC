import { describe, it, expect } from "vitest";
import { garimpoScore, interpolateFps, closestReference, estimatePerformance } from "./performance";
import { REFERENCE_BUILDS } from "@/models/reference-builds";
import { makePart, LOJA_KABUM } from "./test-fixtures";
import type { ReferenceBuild } from "@/models/builder-types";

function ref(id: string, score: number, esports1080: number): ReferenceBuild {
  return {
    id, name: id, description: "", parts: "", approxPrice: 0, score,
    fps: {
      esports: { "1080p": esports1080, "1440p": esports1080 / 2 },
      "aaa-medio": { "1080p": 100, "1440p": 50 },
      "aaa-pesado": { "1080p": 50, "1440p": 25 },
    },
  };
}
const refs = [ref("a", 80, 200), ref("b", 100, 260), ref("c", 110, 280)];

describe("índice GarimpoPC", () => {
  it("é 0,7 x GPU + 0,3 x CPU, arredondado", () => {
    expect(garimpoScore(100, 100)).toBe(100);
    expect(garimpoScore(142, 100)).toBe(129);
    expect(garimpoScore(168, 92)).toBe(145);
  });
});

describe("interpolação de FPS", () => {
  it("interpola linearmente entre as duas referências vizinhas", () => {
    expect(interpolateFps(105, refs).esports["1080p"]).toBe(270);
    expect(interpolateFps(90, refs).esports["1080p"]).toBe(230);
  });

  it("acerta em cheio uma referência", () => {
    expect(interpolateFps(100, refs).esports["1080p"]).toBe(260);
  });

  it("abaixo da menor referência escala proporcionalmente", () => {
    expect(interpolateFps(40, refs).esports["1080p"]).toBe(100);
  });

  it("acima da maior referência escala proporcionalmente", () => {
    expect(interpolateFps(220, refs).esports["1080p"]).toBe(560);
  });
});

describe("referência mais próxima", () => {
  it("escolhe a de score mais perto", () => {
    expect(closestReference(112, refs).id).toBe("c");
    expect(closestReference(89, refs).id).toBe("a");
  });
});

describe("estimativa da montagem", () => {
  const gpu = makePart({ slug: "rx-7700-xt", category: "gpu", perf: 142, aesthetics: 50, tdp: 245 }, { store: LOJA_KABUM, price: 2999.9 });
  const cpu = makePart({ slug: "ryzen-5-7600", category: "cpu", perf: 100, aesthetics: 50, socket: "AM5", tdp: 65 }, { store: LOJA_KABUM, price: 1299.9 });

  it("calcula score, comparável e FPS com as referências reais", () => {
    const est = estimatePerformance([gpu, cpu], REFERENCE_BUILDS);
    expect(est.score).toBe(129);
    expect(est.closest.id).toBe("intermediario-plus");
    expect(est.fps["aaa-medio"]["1440p"]).toBe(100);
    expect(est.notes).toEqual([]);
  });

  it("avisa quando o processador pode limitar a placa (cpu < 50% da gpu)", () => {
    const cpuFraco = makePart({ slug: "cpu-fraco", category: "cpu", perf: 60, aesthetics: 50 }, { store: LOJA_KABUM, price: 500 });
    const est = estimatePerformance([gpu, cpuFraco], REFERENCE_BUILDS);
    expect(est.notes.some((n) => n.toLowerCase().includes("processador"))).toBe(true);
  });

  it("sem GPU ou CPU, usa 0 no que falta e avisa", () => {
    const est = estimatePerformance([gpu], REFERENCE_BUILDS);
    expect(est.score).toBe(99);
    expect(est.notes.length).toBeGreaterThan(0);
  });
});

describe("dados de referência", () => {
  it("têm 6 computadores em ordem crescente de score", () => {
    expect(REFERENCE_BUILDS).toHaveLength(6);
    const scores = REFERENCE_BUILDS.map((r) => r.score);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
  });
});
