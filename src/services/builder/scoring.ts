// Pontuação do Montador: como o slider "Desempenho <-> Estética" vira
// (1) a utilidade de cada peça e (2) a divisão do orçamento entre categorias.
// Spec §5.2 e §5.3.

import type { Category } from "@/models/types";
import type { PartSpec, UsageProfile } from "@/models/builder-types";

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

/**
 * Ajuste das fatias por perfil de uso (V2-B3), somado depois da interpolação do
 * slider. Cada linha soma ZERO, então as fatias continuam somando 1:
 *   - jogos: a tabela acima, sem ajuste (a placa de vídeo manda nos FPS);
 *   - trabalho (planilhas, programação, muitas abas): gpu −0,12, cpu +0,05,
 *     ram +0,03, ssd +0,04 (−0,12 + 0,12 = 0);
 *   - criação (edição de vídeo/foto, 3D): gpu −0,06, cpu +0,05, ram +0,04,
 *     ssd −0,03 (−0,09 + 0,09 = 0). A GPU ainda importa (render/encode), e o
 *     SSD perde um pouco porque a capacidade extra costuma vir de HD/externo.
 * A menor fatia ajustada é a do SSD na criação com slider 100 (0,07 − 0,03 = 0,04),
 * então nenhuma fica negativa.
 */
const USAGE_ADJUST: Record<UsageProfile, Partial<Record<Category, number>>> = {
  jogos: {},
  trabalho: { gpu: -0.12, cpu: 0.05, ram: 0.03, ssd: 0.04 },
  criacao: { gpu: -0.06, cpu: 0.05, ram: 0.04, ssd: -0.03 },
};

/**
 * Fração do orçamento alvo reservada a cada categoria, interpolada pelo slider
 * e ajustada pelo perfil de uso (ausente = "jogos").
 */
export function categoryShares(aesthetics: number, usage: UsageProfile = "jogos"): Record<Category, number> {
  const a = clamp01(aesthetics / 100);
  const ajuste = USAGE_ADJUST[usage] ?? {};
  const out = {} as Record<Category, number>;
  for (const cat of Object.keys(SHARES_PERFORMANCE) as Category[]) {
    out[cat] = SHARES_PERFORMANCE[cat] * (1 - a) + SHARES_AESTHETICS[cat] * a + (ajuste[cat] ?? 0);
  }
  return out;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
