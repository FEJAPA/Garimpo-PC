// Especificações técnicas das peças do catálogo, chaveadas pelo slug (spec §4.2).
//
// `perf` é um índice RELATIVO dentro da categoria (RTX 4060 = 100 entre placas de
// vídeo; Ryzen 5 7600 = 100 entre processadores). `aesthetics` (0-100) diz o
// quanto a peça contribui para o visual. Os valores da V1 são ILUSTRATIVOS, na
// ordem de grandeza dos reviews públicos, mas não medidos por nós.
//
// TODO(V2-A): mover para a tabela part_specs (supabase/schema-builder.sql),
// alimentar com dados reais (fabricante + benchmarks agregados) e cobrir todo o
// catálogo coletado. Uma peça sem spec simplesmente não entra na montagem.

import type { PartSpec } from "./builder-types";

const LISTA: PartSpec[] = [
  // --- Placas de vídeo (índice: RTX 4060 = 100) ---
  { slug: "rx-6600", category: "gpu", perf: 78, aesthetics: 40, tdp: 132 },
  { slug: "rx-7600", category: "gpu", perf: 97, aesthetics: 45, tdp: 165 },
  { slug: "rtx-4060", category: "gpu", perf: 100, aesthetics: 50, tdp: 115 },
  { slug: "rtx-4060-ti", category: "gpu", perf: 118, aesthetics: 55, tdp: 160 },
  { slug: "rx-7700-xt", category: "gpu", perf: 142, aesthetics: 50, tdp: 245 },
  { slug: "rtx-4070-super", category: "gpu", perf: 168, aesthetics: 60, tdp: 220 },

  // --- Processadores (índice: Ryzen 5 7600 = 100) ---
  { slug: "ryzen-5-7600", category: "cpu", perf: 100, aesthetics: 50, socket: "AM5", tdp: 65 },
  { slug: "core-i5-14400f", category: "cpu", perf: 92, aesthetics: 50, socket: "LGA1700", tdp: 110 },

  // --- Placas-mãe (índice de recursos: B650M = 100) ---
  { slug: "b650m-asus", category: "motherboard", perf: 100, aesthetics: 60, socket: "AM5", ramType: "DDR5", formFactor: "mATX" },
  { slug: "a620m-asrock", category: "motherboard", perf: 80, aesthetics: 35, socket: "AM5", ramType: "DDR5", formFactor: "mATX" },
  { slug: "b760m-gigabyte", category: "motherboard", perf: 95, aesthetics: 45, socket: "LGA1700", ramType: "DDR5", formFactor: "mATX" },

  // --- Memória (índice: 16 GB 5600 = 100) ---
  { slug: "corsair-vengeance-16gb-ddr5", category: "ram", perf: 100, aesthetics: 45, ramType: "DDR5" },
  { slug: "xpg-lancer-rgb-32gb-ddr5", category: "ram", perf: 130, aesthetics: 85, ramType: "DDR5" },

  // --- Armazenamento (índice: 1 TB Gen3 = 100) ---
  { slug: "kingston-nv2-1tb", category: "ssd", perf: 100, aesthetics: 30 },
  { slug: "wd-black-sn770-2tb", category: "ssd", perf: 140, aesthetics: 30 },

  // --- Fontes (índice: 650 W Bronze = 100) ---
  { slug: "corsair-cv650", category: "psu", perf: 100, aesthetics: 30, wattage: 650 },
  { slug: "msi-mag-a750gl", category: "psu", perf: 125, aesthetics: 55, wattage: 750 },

  // --- Gabinetes (índice de fluxo de ar/qualidade) ---
  { slug: "gabinete-gamemax-h605", category: "case", perf: 70, aesthetics: 65, caseSupports: ["ATX", "mATX", "ITX"] },
  { slug: "montech-sky-two", category: "case", perf: 85, aesthetics: 95, caseSupports: ["ATX", "mATX", "ITX"] },
  { slug: "rise-mode-galaxy", category: "case", perf: 50, aesthetics: 30, caseSupports: ["mATX", "ITX"] },
];

/** Specs por slug. */
export const PART_SPECS: Record<string, PartSpec> = Object.fromEntries(LISTA.map((s) => [s.slug, s]));

/** Spec de um slug, ou undefined se a peça ainda não foi catalogada. */
export function getPartSpec(slug: string): PartSpec | undefined {
  return PART_SPECS[slug];
}
