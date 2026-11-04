import { describe, it, expect } from "vitest";
import {
  garimpoScore,
  interpolateFps,
  closestReference,
  closestReferences,
  estimatePerformance,
  describeScorePosition,
  isUpscalingNote,
  SEM_REFERENCIA,
} from "./performance";
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

describe("memória na estimativa (sem dupla contagem, R-07)", () => {
  const gpu = makePart({ slug: "rx-7700-xt", category: "gpu", perf: 142, aesthetics: 50, tdp: 245 }, { store: LOJA_KABUM, price: 2999.9 });
  const cpu = makePart({ slug: "ryzen-5-7600", category: "cpu", perf: 100, aesthetics: 50, socket: "AM5", tdp: 65 }, { store: LOJA_KABUM, price: 1299.9 });
  const ram = (capacityGb?: number) =>
    makePart({ slug: `ram-${capacityGb ?? "x"}`, category: "ram", perf: 100, aesthetics: 45, ramType: "DDR5", capacityGb }, { store: LOJA_KABUM, price: 400 });
  // Score 129 = "PC intermediário forte": as duas referências vizinhas têm 32 GB.
  const semRam = estimatePerformance([gpu, cpu], REFERENCE_BUILDS);

  it("montagem igual à referência 'PC de entrada' (16 GB) devolve os FPS da referência", () => {
    const rtx4060 = makePart({ slug: "rtx-4060", category: "gpu", perf: 100, aesthetics: 50 }, { store: LOJA_KABUM, price: 1 });
    const entrada = REFERENCE_BUILDS.find((r) => r.id === "entrada")!;
    const est = estimatePerformance([rtx4060, cpu, ram(16)], REFERENCE_BUILDS);
    expect(est.score).toBe(entrada.score);
    expect(est.fps).toEqual(entrada.fps);
    expect(est.fps["aaa-pesado"]["1080p"]).toBe(52);
  });

  it("16 GB entre referências de 16 GB não perde nada (dentro da faixa e acima dela)", () => {
    const c16 = REFERENCE_BUILDS.filter((r) => r.ramGb === 16);
    expect(c16.length).toBeGreaterThanOrEqual(3);
    for (const perfGpu of [60, 80, 100, 110, 130]) {
      const g = makePart({ slug: `gpu-${perfGpu}`, category: "gpu", perf: perfGpu, aesthetics: 50 }, { store: LOJA_KABUM, price: 1 });
      const sem = estimatePerformance([g, cpu], c16);
      const com = estimatePerformance([g, cpu, ram(16)], c16);
      expect(com.fps, `gpu ${perfGpu}`).toEqual(sem.fps);
    }
  });

  it("montagem com 16 GB perto de referências de 32 GB perde 8% em AAA pesado (arredondado) e avisa", () => {
    const est = estimatePerformance([gpu, cpu, ram(16)], REFERENCE_BUILDS);
    expect(est.fps["aaa-pesado"]["1080p"]).toBe(Math.round(semRam.fps["aaa-pesado"]["1080p"] * 0.92));
    expect(est.fps["aaa-pesado"]["1440p"]).toBe(Math.round(semRam.fps["aaa-pesado"]["1440p"] * 0.92));
    expect(est.fps["aaa-pesado"]["1080p"]).toBe(66);
    expect(est.fps.esports).toEqual(semRam.fps.esports);
    expect(est.fps["aaa-medio"]).toEqual(semRam.fps["aaa-medio"]);
    const nota = est.notes.find((n) => n.includes("16 GB de memória"));
    expect(nota).toContain("jogos pesados podem engasgar; 32 GB dá folga");
    expect(nota).toContain("descontamos 8%");
  });

  it("referências mistas (16 GB e 32 GB): a penalidade é proporcional ao peso da vizinha de 32 GB", () => {
    // 116 fica no meio de "PC intermediário" (110, 16 GB) e "PC intermediário 2026" (122, 32 GB).
    const gpu116 = makePart({ slug: "gpu-116", category: "gpu", perf: 123, aesthetics: 50 }, { store: LOJA_KABUM, price: 1 });
    const base = estimatePerformance([gpu116, cpu, ram(32)], REFERENCE_BUILDS);
    expect(base.score).toBe(116);
    const est = estimatePerformance([gpu116, cpu, ram(16)], REFERENCE_BUILDS);
    // t = 0,5 → metade dos 8% = fator 0,96.
    expect(est.fps["aaa-pesado"]["1080p"]).toBe(Math.round(base.fps["aaa-pesado"]["1080p"] * 0.96));
    expect(est.fps["aaa-pesado"]["1440p"]).toBe(Math.round(base.fps["aaa-pesado"]["1440p"] * 0.96));
    expect(est.fps.esports).toEqual(base.fps.esports);
  });

  it("menos de 16 GB também é penalizado quando as referências têm mais", () => {
    const est = estimatePerformance([gpu, cpu, ram(8)], REFERENCE_BUILDS);
    expect(est.fps["aaa-pesado"]["1440p"]).toBe(Math.round(semRam.fps["aaa-pesado"]["1440p"] * 0.92));
    expect(est.notes.some((n) => n.startsWith("8 GB de memória"))).toBe(true);
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

  it("referências sem ramGb (dado antigo): não dá para saber se a memória já está contada, então não penaliza", () => {
    const antigas = [ref("a", 80, 200), ref("b", 100, 260), ref("c", 110, 280)];
    const sem = estimatePerformance([gpu, cpu], antigas);
    const com = estimatePerformance([gpu, cpu, ram(16)], antigas);
    expect(com.fps).toEqual(sem.fps);
  });
});

describe("nota de upscaling (R-08)", () => {
  const cpu = makePart({ slug: "ryzen-5-7600", category: "cpu", perf: 100, aesthetics: 50, socket: "AM5", tdp: 65 }, { store: LOJA_KABUM, price: 1299.9 });
  const gpuCom = (upscaling?: ("DLSS" | "FSR" | "XeSS")[]) =>
    makePart({ slug: "gpu-x", category: "gpu", perf: 142, aesthetics: 50, upscaling }, { store: LOJA_KABUM, price: 1799.9 });
  const semNota = estimatePerformance([gpuCom(undefined), cpu], REFERENCE_BUILDS);

  it("placa AMD (só FSR): 'Com FSR, …' e não fala em DLSS", () => {
    const est = estimatePerformance([gpuCom(["FSR"]), cpu], REFERENCE_BUILDS);
    expect(est.fps).toEqual(semNota.fps);
    const notas = est.notes.filter(isUpscalingNote);
    expect(notas).toHaveLength(1);
    expect(notas[0]).toMatch(/^Com FSR, /);
    expect(notas[0]).not.toContain("DLSS");
  });

  it("placa NVIDIA (DLSS e FSR): 'Com DLSS ou FSR, …'", () => {
    const est = estimatePerformance([gpuCom(["DLSS", "FSR"]), cpu], REFERENCE_BUILDS);
    const notas = est.notes.filter(isUpscalingNote);
    expect(notas).toHaveLength(1);
    expect(notas[0]).toMatch(/^Com DLSS ou FSR, /);
    expect(notas[0]).toContain("1440p");
  });

  it("três tecnologias: 'DLSS, FSR ou XeSS'; repetidas contam uma vez", () => {
    expect(estimatePerformance([gpuCom(["DLSS", "FSR", "XeSS"]), cpu], REFERENCE_BUILDS).notes[0]).toMatch(/^Com DLSS, FSR ou XeSS, /);
    expect(estimatePerformance([gpuCom(["FSR", "FSR"]), cpu], REFERENCE_BUILDS).notes[0]).toMatch(/^Com FSR, /);
  });

  it("lista vazia ou ausente não gera nota; isUpscalingNote não confunde outros avisos", () => {
    expect(estimatePerformance([gpuCom([]), cpu], REFERENCE_BUILDS).notes).toEqual([]);
    expect(semNota.notes).toEqual([]);
    expect(isUpscalingNote("O processador pode limitar a placa de vídeo")).toBe(false);
    expect(isUpscalingNote("16 GB de memória: jogos pesados podem engasgar; 32 GB dá folga")).toBe(false);
  });
});

describe("guardas contra dado ruim (LOG-14, LOG-15, TST-02)", () => {
  const gpu = makePart({ slug: "rx-7700-xt", category: "gpu", perf: 142, aesthetics: 50, tdp: 245 }, { store: LOJA_KABUM, price: 2999.9 });
  const cpu = makePart({ slug: "ryzen-5-7600", category: "cpu", perf: 100, aesthetics: 50, socket: "AM5", tdp: 65 }, { store: LOJA_KABUM, price: 1299.9 });
  const semNaN = (fps: ReturnType<typeof interpolateFps>) =>
    Object.values(fps).flatMap((por) => Object.values(por)).every((n) => Number.isFinite(n));

  it("lista de referências vazia: estimativa com nota, sem NaN e sem lançar erro", () => {
    const est = estimatePerformance([gpu, cpu], []);
    expect(est.score).toBe(129);
    expect(est.closest).toBe(SEM_REFERENCIA);
    expect(semNaN(est.fps)).toBe(true);
    expect(est.fps["aaa-medio"]["1080p"]).toBe(0);
    expect(est.notes.some((n) => n.toLowerCase().includes("referência"))).toBe(true);
  });

  it("interpolateFps e closestReference(s) não quebram com lista vazia", () => {
    expect(semNaN(interpolateFps(100, []))).toBe(true);
    expect(closestReference(100, [])).toBe(SEM_REFERENCIA);
    expect(closestReferences(100, [], 3)).toEqual([]);
  });

  it("referências com score zero, negativo ou NaN são ignoradas (sem 0/0)", () => {
    const ruins = [ref("zero", 0, 10), ref("neg", -5, 10), ref("nan", Number.NaN, 10), ...refs];
    expect(semNaN(interpolateFps(0, ruins))).toBe(true);
    expect(interpolateFps(105, ruins)).toEqual(interpolateFps(105, refs));
    expect(closestReferences(1, ruins, 5).map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(estimatePerformance([gpu, cpu], [ref("zero", 0, 10)]).closest).toBe(SEM_REFERENCIA);
  });

  it("duas referências com o mesmo score não geram divisão por zero", () => {
    const iguais = [ref("a", 80, 200), ref("b1", 100, 260), ref("b2", 100, 262), ref("c", 110, 280)];
    expect(semNaN(interpolateFps(100, iguais))).toBe(true);
    expect(semNaN(interpolateFps(95, iguais))).toBe(true);
  });

  it("score zero (montagem sem GPU e CPU) dá FPS zero, não NaN", () => {
    const est = estimatePerformance([], REFERENCE_BUILDS);
    expect(est.score).toBe(0);
    expect(semNaN(est.fps)).toBe(true);
    expect(est.fps.esports["1080p"]).toBe(0);
  });

  it("score NaN ou infinito em interpolateFps vira FPS zero", () => {
    expect(semNaN(interpolateFps(Number.NaN, refs))).toBe(true);
    expect(interpolateFps(Number.NaN, refs).esports["1080p"]).toBe(0);
  });

  it("perf inválido (NaN ou negativo) é tratado como peça ausente, com nota", () => {
    const gpuNaN = makePart({ slug: "gpu-nan", category: "gpu", perf: Number.NaN, aesthetics: 50 }, { store: LOJA_KABUM, price: 1 });
    const est = estimatePerformance([gpuNaN, cpu], REFERENCE_BUILDS);
    expect(Number.isFinite(est.score)).toBe(true);
    expect(est.score).toBe(garimpoScore(0, 100));
    expect(semNaN(est.fps)).toBe(true);
    expect(est.notes.some((n) => n.includes("placa de vídeo") && n.includes("inválido"))).toBe(true);
  });
});

describe("resumo textual da posição no gráfico (A11Y-05)", () => {
  it("entre duas referências", () => {
    expect(describeScorePosition(125, REFERENCE_BUILDS)).toBe(
      "Sua montagem tem índice 125, entre PC intermediário 2026 e PC intermediário forte"
    );
  });

  it("igual a uma referência", () => {
    expect(describeScorePosition(129, REFERENCE_BUILDS)).toBe(
      "Sua montagem tem índice 129, no mesmo nível de PC intermediário forte"
    );
  });

  it("abaixo da menor e acima da maior", () => {
    expect(describeScorePosition(50, REFERENCE_BUILDS)).toBe("Sua montagem tem índice 50, abaixo de Equivalente a console");
    expect(describeScorePosition(300, REFERENCE_BUILDS)).toBe("Sua montagem tem índice 300, acima de PC topo de linha");
  });

  it("sem referências válidas só diz o índice", () => {
    expect(describeScorePosition(129, [])).toBe("Sua montagem tem índice 129");
  });
});

describe("dados de referência", () => {
  it("têm ao menos 10 computadores em ordem crescente de score, sem ids repetidos", () => {
    expect(REFERENCE_BUILDS.length).toBeGreaterThanOrEqual(10);
    const scores = REFERENCE_BUILDS.map((r) => r.score);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
    expect(new Set(REFERENCE_BUILDS.map((r) => r.id)).size).toBe(REFERENCE_BUILDS.length);
  });

  it("cada referência tem memória, fonte e mês de referência das fontes (AAAA-MM)", () => {
    for (const r of REFERENCE_BUILDS) {
      expect(r.ramGb).toBeGreaterThan(0);
      expect(r.source).toBeTruthy();
      expect(r.measuredAt).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it("a fonte diz que é estimativa, admite a parte ilustrativa e não cita mês de coleta que não existe (R-09)", () => {
    for (const r of REFERENCE_BUILDS) {
      expect(r.source).toMatch(/^Estimativa GarimpoPC/);
      expect(r.source).toContain("ilustrativa");
      expect(r.source).toContain("checkfps.io");
      expect(r.source).not.toContain("out/2026");
      // Mês de referência das fontes (não é medição nossa): nunca depois da consulta.
      expect(r.measuredAt! <= "2026-11").toBe(true);
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
