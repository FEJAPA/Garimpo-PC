// Estimativa de desempenho da montagem, comparada com computadores de
// referência. Spec §6.
//
// V2 (pacote D): "PCs parecidos" (closestReferences), penalidade de memória
// (≤ 16 GB tira 8% nos AAA pesados) e nota de upscaling (DLSS/FSR).
// TODO(V2-D): usar benchmarks reais por jogo e destacar a resolução-alvo
// escolhida pela pessoa (BuildPreferences.resolution) na tela.

import type {
  BuildPart,
  GameProfile,
  PerformanceEstimate,
  ReferenceBuild,
  Resolution,
} from "@/models/builder-types";
import { REFERENCE_BUILDS } from "@/models/reference-builds";

const PROFILES: GameProfile[] = ["esports", "aaa-medio", "aaa-pesado"];
const RESOLUTIONS: Resolution[] = ["1080p", "1440p"];

/** Índice GarimpoPC: 70% placa de vídeo, 30% processador. */
export function garimpoScore(gpuPerf: number, cpuPerf: number): number {
  return Math.round(0.7 * gpuPerf + 0.3 * cpuPerf);
}

type FpsTable = Record<GameProfile, Record<Resolution, number>>;

function mapFps(fn: (profile: GameProfile, res: Resolution) => number): FpsTable {
  const out = {} as FpsTable;
  for (const p of PROFILES) {
    out[p] = {} as Record<Resolution, number>;
    for (const r of RESOLUTIONS) out[p][r] = Math.round(fn(p, r));
  }
  return out;
}

/**
 * FPS estimado para um score: interpolação linear entre as duas referências
 * vizinhas; fora da faixa, escala proporcional à referência da ponta.
 */
export function interpolateFps(score: number, refs: ReferenceBuild[]): FpsTable {
  const ordenadas = [...refs].sort((a, b) => a.score - b.score);
  const menor = ordenadas[0];
  const maior = ordenadas[ordenadas.length - 1];

  if (score <= menor.score) return mapFps((p, r) => (menor.fps[p][r] * score) / menor.score);
  if (score >= maior.score) return mapFps((p, r) => (maior.fps[p][r] * score) / maior.score);

  for (let i = 0; i < ordenadas.length - 1; i++) {
    const a = ordenadas[i];
    const b = ordenadas[i + 1];
    if (score >= a.score && score <= b.score) {
      const t = (score - a.score) / (b.score - a.score);
      return mapFps((p, r) => a.fps[p][r] + t * (b.fps[p][r] - a.fps[p][r]));
    }
  }
  return mapFps((p, r) => maior.fps[p][r]); // inalcançável; segurança
}

/** A referência cujo score está mais perto. */
export function closestReference(score: number, refs: ReferenceBuild[]): ReferenceBuild {
  return refs.reduce((melhor, r) =>
    Math.abs(r.score - score) < Math.abs(melhor.score - score) ? r : melhor
  );
}

/**
 * As `n` referências de score mais próximo, da mais perto para a mais longe
 * ("PCs parecidos com o seu"). Empate de distância: a de score menor primeiro.
 * Não altera a lista recebida.
 */
export function closestReferences(score: number, refs: ReferenceBuild[], n = 3): ReferenceBuild[] {
  if (n <= 0) return [];
  return [...refs]
    .sort((a, b) => Math.abs(a.score - score) - Math.abs(b.score - score) || a.score - b.score)
    .slice(0, n);
}

/** Memória até este tamanho perde FPS em jogos pesados. */
const RAM_APERTADA_GB = 16;
/** Fator aplicado aos FPS de "aaa-pesado" com memória apertada (−8%). */
const FATOR_RAM_APERTADA = 0.92;

export const NOTA_RAM_16GB = "16 GB de memória: jogos pesados podem engasgar; 32 GB dá folga";
export const NOTA_UPSCALING = "Com DLSS/FSR os FPS podem subir bastante em 1440p";

/** Estimativa completa para as peças escolhidas. */
export function estimatePerformance(
  parts: BuildPart[],
  refs: ReferenceBuild[] = REFERENCE_BUILDS
): PerformanceEstimate {
  const gpu = parts.find((p) => p.category === "gpu");
  const cpu = parts.find((p) => p.category === "cpu");
  const notes: string[] = [];

  if (!gpu) notes.push("A montagem não tem placa de vídeo; a estimativa é parcial.");
  if (!cpu) notes.push("A montagem não tem processador; a estimativa é parcial.");

  const gpuPerf = gpu?.spec.perf ?? 0;
  const cpuPerf = cpu?.spec.perf ?? 0;
  if (gpu && cpu && cpuPerf < 0.5 * gpuPerf) {
    notes.push(
      "O processador pode limitar a placa de vídeo (gargalo): em jogos leves a taxa de quadros tende a ficar abaixo do esperado."
    );
  }

  const score = garimpoScore(gpuPerf, cpuPerf);
  const fps = interpolateFps(score, refs);

  // Memória: capacidade ausente = desconhecida (sem penalidade e sem nota).
  const ram = parts.find((p) => p.category === "ram");
  const ramGb = ram?.spec.capacityGb;
  if (ramGb !== undefined && ramGb <= RAM_APERTADA_GB) {
    for (const r of RESOLUTIONS) fps["aaa-pesado"][r] = Math.round(fps["aaa-pesado"][r] * FATOR_RAM_APERTADA);
    notes.push(NOTA_RAM_16GB);
  }

  // Upscaling: só informa; os números continuam sem DLSS/FSR.
  if (gpu?.spec.upscaling?.length) notes.push(NOTA_UPSCALING);

  return {
    score,
    closest: closestReference(score, refs),
    fps,
    notes,
  };
}
