// Pontuação do Montador: como o slider "Desempenho <-> Estética" vira
// (1) a utilidade de cada peça e (2) a divisão do orçamento entre categorias.
// Spec §5.2 e §5.3.

import type { Category } from "@/models/types";
import type { PartSpec } from "@/models/builder-types";

/**
 * Quanto a estética pode pesar em cada categoria (0 a 1). Peças invisíveis
 * (CPU, SSD) são sempre escolhidas só pelo desempenho, mesmo no extremo estético.
 */
export const AESTHETICS_RELEVANCE: Record<Category, number> = {
  case: 1,
  ram: 0.8,
  gpu: 0.6,
  psu: 0.3,
  motherboard: 0.3,
  cpu: 0,
  ssd: 0,
};

/**
 * Utilidade de uma peça (0 a 1), dado o slider (0-100) e o maior `perf` da
 * categoria entre os candidatos (para normalizar).
 *   w = (slider/100) * relevância
 *   utilidade = (1 - w) * perf/maxPerf + w * aesthetics/100
 */
export function partUtility(spec: PartSpec, aesthetics: number, maxPerf: number): number {
  const a = clamp01(aesthetics / 100);
  const w = a * AESTHETICS_RELEVANCE[spec.category];
  const perfNorm = maxPerf > 0 ? spec.perf / maxPerf : 0;
  const aesNorm = clamp01(spec.aesthetics / 100);
  return (1 - w) * perfNorm + w * aesNorm;
}

// Fatias do orçamento alvo nos dois extremos do slider (somam 1 em cada coluna).
const SHARES_PERFORMANCE: Record<Category, number> = {
  gpu: 0.42, cpu: 0.17, motherboard: 0.13, ram: 0.07, ssd: 0.08, psu: 0.08, case: 0.05,
};
const SHARES_AESTHETICS: Record<Category, number> = {
  gpu: 0.3, cpu: 0.14, motherboard: 0.12, ram: 0.09, ssd: 0.07, psu: 0.08, case: 0.2,
};

/** Fração do orçamento alvo reservada a cada categoria, interpolada pelo slider. */
export function categoryShares(aesthetics: number): Record<Category, number> {
  const a = clamp01(aesthetics / 100);
  const out = {} as Record<Category, number>;
  for (const cat of Object.keys(SHARES_PERFORMANCE) as Category[]) {
    out[cat] = SHARES_PERFORMANCE[cat] * (1 - a) + SHARES_AESTHETICS[cat] * a;
  }
  return out;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
