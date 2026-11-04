// Especificações técnicas das peças do catálogo, chaveadas pelo slug (spec §4.2).
//
// `perf` é um índice RELATIVO dentro da categoria (RTX 4060 = 100 entre placas de
// vídeo; Ryzen 5 7600 = 100 entre processadores). `aesthetics` (0-100) diz o
// quanto a peça contribui para o visual. Os valores da V1 são ILUSTRATIVOS, na
// ordem de grandeza dos reviews públicos, mas não medidos por nós.
//
// V2-A: o app lê as specs por src/services/specs.ts (tabela part_specs quando o
// Supabase existe; esta lista é o fallback do modo de demonstração).
// `capacityGb` (ram, ssd) e `upscaling` (gpu) são fatos de catálogo dos modelos.
// TODO(V2-A): alimentar part_specs com dados reais (fabricante + benchmarks
// agregados) via scripts/collect-specs.mjs e cobrir todo o catálogo coletado.
// Uma peça sem spec simplesmente não entra na montagem.

import type { PartSpec } from "./builder-types";

// Origem honesta dos números da V1: estimativas nossas, não medições.
// Specs vindas do banco (part_specs) trazem a própria fonte na coluna `source`.
const FONTE = "ilustrativo (V1)";

const LISTA: PartSpec[] = [
  // --- Placas de vídeo (índice: RTX 4060 = 100) ---
  { slug: "rx-6600", category: "gpu", perf: 78, aesthetics: 40, tdp: 132, upscaling: ["FSR"], source: FONTE },
  { slug: "rx-7600", category: "gpu", perf: 97, aesthetics: 45, tdp: 165, upscaling: ["FSR"], source: FONTE },
  { slug: "rtx-4060", category: "gpu", perf: 100, aesthetics: 50, tdp: 115, upscaling: ["DLSS", "FSR"], source: FONTE },
  { slug: "rtx-4060-ti", category: "gpu", perf: 118, aesthetics: 55, tdp: 160, upscaling: ["DLSS", "FSR"], source: FONTE },
  { slug: "rx-7700-xt", category: "gpu", perf: 142, aesthetics: 50, tdp: 245, upscaling: ["FSR"], source: FONTE },
  { slug: "rtx-4070-super", category: "gpu", perf: 168, aesthetics: 60, tdp: 220, upscaling: ["DLSS", "FSR"], source: FONTE },

  // --- Processadores (índice: Ryzen 5 7600 = 100) ---
  { slug: "ryzen-5-7600", category: "cpu", perf: 100, aesthetics: 50, socket: "AM5", tdp: 65, source: FONTE },
  { slug: "core-i5-14400f", category: "cpu", perf: 92, aesthetics: 50, socket: "LGA1700", tdp: 110, source: FONTE },

  // --- Placas-mãe (índice de recursos: B650M = 100) ---
  { slug: "b650m-asus", category: "motherboard", perf: 100, aesthetics: 60, socket: "AM5", ramType: "DDR5", formFactor: "mATX", source: FONTE },
  { slug: "a620m-asrock", category: "motherboard", perf: 80, aesthetics: 35, socket: "AM5", ramType: "DDR5", formFactor: "mATX", source: FONTE },
  { slug: "b760m-gigabyte", category: "motherboard", perf: 95, aesthetics: 45, socket: "LGA1700", ramType: "DDR5", formFactor: "mATX", source: FONTE },

  // --- Memória (índice: 16 GB 5600 = 100) ---
  { slug: "corsair-vengeance-16gb-ddr5", category: "ram", perf: 100, aesthetics: 45, ramType: "DDR5", capacityGb: 16, source: FONTE },
  { slug: "xpg-lancer-rgb-32gb-ddr5", category: "ram", perf: 130, aesthetics: 85, ramType: "DDR5", capacityGb: 32, source: FONTE },

  // --- Armazenamento (índice: 1 TB Gen3 = 100) ---
  { slug: "kingston-nv2-1tb", category: "ssd", perf: 100, aesthetics: 30, capacityGb: 1000, source: FONTE },
  { slug: "wd-black-sn770-2tb", category: "ssd", perf: 140, aesthetics: 30, capacityGb: 2000, source: FONTE },

  // --- Fontes (índice: 650 W Bronze = 100) ---
  { slug: "corsair-cv650", category: "psu", perf: 100, aesthetics: 30, wattage: 650, source: FONTE },
  { slug: "msi-mag-a750gl", category: "psu", perf: 125, aesthetics: 55, wattage: 750, source: FONTE },

  // --- Gabinetes (índice de fluxo de ar/qualidade) ---
  { slug: "gabinete-gamemax-h605", category: "case", perf: 70, aesthetics: 65, caseSupports: ["ATX", "mATX", "ITX"], source: FONTE },
  { slug: "montech-sky-two", category: "case", perf: 85, aesthetics: 95, caseSupports: ["ATX", "mATX", "ITX"], source: FONTE },
  { slug: "rise-mode-galaxy", category: "case", perf: 50, aesthetics: 30, caseSupports: ["mATX", "ITX"], source: FONTE },
];

/** Specs por slug. */
export const PART_SPECS: Record<string, PartSpec> = Object.fromEntries(LISTA.map((s) => [s.slug, s]));

/** Spec de um slug, ou undefined se a peça ainda não foi catalogada. */
export function getPartSpec(slug: string): PartSpec | undefined {
  return PART_SPECS[slug];
}
