import { describe, it, expect } from "vitest";
import { garimpoScore, interpolateFps, closestReference, closestReferences, estimatePerformance } from "./performance";
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

describe("referências mais próximas (PCs parecidos)", () => {
  it("devolve as n mais próximas, da mais perto para a mais longe", () => {
    expect(closestReferences(112, refs, 3).map((r) => r.id)).toEqual(["c", "b", "a"]);
    expect(closestReferences(89, refs, 2).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("usa n = 3 por padrão", () => {
    const quatro = [...refs, ref("d", 150, 320)];
    expect(closestReferences(140, quatro).map((r) => r.id)).toEqual(["d", "c", "b"]);
  });

  it("empate de distância: a de score menor vem primeiro", () => {
    expect(closestReferences(105, refs, 2).map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("n maior que a lista devolve todas; n = 0 devolve nenhuma; não altera a entrada", () => {
    const copia = [...refs];
    expect(closestReferences(100, refs, 10)).toHaveLength(3);
    expect(closestReferences(100, refs, 0)).toEqual([]);
    expect(refs).toEqual(copia);
  });

  it("a primeira é a mesma de closestReference", () => {
    for (const s of [40, 89, 95, 105, 112, 300]) {
      expect(closestReferences(s, REFERENCE_BUILDS, 3)[0].id).toBe(closestReference(s, REFERENCE_BUILDS).id);
    }
  });
});

describe("estimativa da montagem", () => {
  const gpu = makePart({ slug: "rx-7700-xt", category: "gpu", perf: 142, aesthetics: 50, tdp: 245 }, { store: LOJA_KABUM, price: 2999.9 });
  const cpu = makePart({ slug: "ryzen-5-7600", category: "cpu", perf: 100, aesthetics: 50, socket: "AM5", tdp: 65 }, { store: LOJA_KABUM, price: 1299.9 });

  it("calcula score, comparável e FPS com as referências reais", () => {
    const est = estimatePerformance([gpu, cpu], REFERENCE_BUILDS);
    expect(est.score).toBe(129);
    expect(est.closest.id).toBe("intermediario-plus");
    expect(est.fps["aaa-medio"]["1440p"]).toBe(105);
    expect(est.fps["aaa-pesado"]["1080p"]).toBe(72);
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

describe("memória e upscaling na estimativa", () => {
  const gpu = makePart({ slug: "rx-7700-xt", category: "gpu", perf: 142, aesthetics: 50, tdp: 245 }, { store: LOJA_KABUM, price: 2999.9 });
  const cpu = makePart({ slug: "ryzen-5-7600", category: "cpu", perf: 100, aesthetics: 50, socket: "AM5", tdp: 65 }, { store: LOJA_KABUM, price: 1299.9 });
  const ram = (capacityGb?: number) =>
    makePart({ slug: `ram-${capacityGb ?? "x"}`, category: "ram", perf: 100, aesthetics: 45, ramType: "DDR5", capacityGb }, { store: LOJA_KABUM, price: 400 });
  const semRam = estimatePerformance([gpu, cpu], REFERENCE_BUILDS);

  it("16 GB tira 8% dos FPS de AAA pesado (arredondado) e avisa", () => {
    const est = estimatePerformance([gpu, cpu, ram(16)], REFERENCE_BUILDS);
    expect(est.fps["aaa-pesado"]["1080p"]).toBe(Math.round(semRam.fps["aaa-pesado"]["1080p"] * 0.92));
    expect(est.fps["aaa-pesado"]["1440p"]).toBe(Math.round(semRam.fps["aaa-pesado"]["1440p"] * 0.92));
    expect(est.fps["aaa-pesado"]["1080p"]).toBe(66);
    expect(est.fps.esports).toEqual(semRam.fps.esports);
    expect(est.fps["aaa-medio"]).toEqual(semRam.fps["aaa-medio"]);
    expect(est.notes).toContain("16 GB de memória: jogos pesados podem engasgar; 32 GB dá folga");
  });

  it("menos de 16 GB também é penalizado", () => {
    const est = estimatePerformance([gpu, cpu, ram(8)], REFERENCE_BUILDS);
    expect(est.fps["aaa-pesado"]["1440p"]).toBe(Math.round(semRam.fps["aaa-pesado"]["1440p"] * 0.92));
  });

  it("32 GB não muda nada", () => {
    const est = estimatePerformance([gpu, cpu, ram(32)], REFERENCE_BUILDS);
    expect(est.fps).toEqual(semRam.fps);
    expect(est.notes).toEqual([]);
  });

  it("capacidade desconhecida: sem penalidade e sem nota", () => {
    const est = estimatePerformance([gpu, cpu, ram(undefined)], REFERENCE_BUILDS);
    expect(est.fps).toEqual(semRam.fps);
    expect(est.notes).toEqual([]);
  });

  it("placa com DLSS/FSR ganha nota informativa sem mudar os números", () => {
    const gpuDlss = makePart(
      { slug: "rtx-4060", category: "gpu", perf: 142, aesthetics: 50, upscaling: ["DLSS"] },
      { store: LOJA_KABUM, price: 1799.9 }
    );
    const est = estimatePerformance([gpuDlss, cpu], REFERENCE_BUILDS);
    expect(est.fps).toEqual(semRam.fps);
    expect(est.notes).toContain("Com DLSS/FSR os FPS podem subir bastante em 1440p");
  });

  it("lista de upscaling vazia não gera nota", () => {
    const gpuSem = makePart({ slug: "gpu-x", category: "gpu", perf: 142, aesthetics: 50, upscaling: [] }, { store: LOJA_KABUM, price: 1 });
    expect(estimatePerformance([gpuSem, cpu], REFERENCE_BUILDS).notes).toEqual([]);
  });
});

describe("dados de referência", () => {
  it("têm ao menos 10 computadores em ordem crescente de score, sem ids repetidos", () => {
    expect(REFERENCE_BUILDS.length).toBeGreaterThanOrEqual(10);
    const scores = REFERENCE_BUILDS.map((r) => r.score);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
    expect(new Set(REFERENCE_BUILDS.map((r) => r.id)).size).toBe(REFERENCE_BUILDS.length);
  });

  it("cada referência tem memória, fonte e mês de medição (AAAA-MM)", () => {
    for (const r of REFERENCE_BUILDS) {
      expect(r.ramGb).toBeGreaterThan(0);
      expect(r.source).toBeTruthy();
      expect(r.measuredAt).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it("FPS de cada perfil/resolução nunca cai quando o score sobe", () => {
    for (const p of ["esports", "aaa-medio", "aaa-pesado"] as const) {
      for (const res of ["1080p", "1440p"] as const) {
        const serie = REFERENCE_BUILDS.map((r) => r.fps[p][res]);
        expect([...serie].sort((a, b) => a - b)).toEqual(serie);
      }
    }
  });

  it("scores batem com a fórmula para as peças do catálogo de exemplo", () => {
    // RTX 4060 (100) + Ryzen 5 7600 (100); RTX 4060 Ti (118) + i5-14400F (92); RX 7700 XT (142) + Ryzen 5 7600 (100).
    const porId = Object.fromEntries(REFERENCE_BUILDS.map((r) => [r.id, r.score]));
    expect(porId["entrada"]).toBe(garimpoScore(100, 100));
    expect(porId["intermediario"]).toBe(garimpoScore(118, 92));
    expect(porId["intermediario-plus"]).toBe(garimpoScore(142, 100));
  });
});
