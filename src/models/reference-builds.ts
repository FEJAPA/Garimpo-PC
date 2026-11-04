// Computadores de referência usados para estimar o desempenho de uma montagem
// e desenhar o gráfico de comparáveis (spec §4.3 e §6).
//
// ATENÇÃO: os números abaixo são ESTIMATIVAS ILUSTRATIVAS, escolhidas para a
// V1 ter o que mostrar. Eles seguem a ordem de grandeza conhecida das peças,
// mas não vêm de benchmark medido.
// TODO(V2-D): substituir por médias de benchmarks reais e agregados (com fonte
// e data), guardar na tabela reference_builds (supabase/schema-builder.sql) e
// atualizar periodicamente.

import type { ReferenceBuild } from "./builder-types";

export const REFERENCE_BUILDS: ReferenceBuild[] = [
  {
    id: "console",
    name: "Equivalente a console",
    description: "Desempenho na faixa de um console atual. Roda tudo em Full HD no médio.",
    parts: "RX 6600 + Ryzen 5 5600 + 16 GB",
    approxPrice: 4200,
    score: 80,
    fps: {
      esports: { "1080p": 200, "1440p": 140 },
      "aaa-medio": { "1080p": 90, "1440p": 60 },
      "aaa-pesado": { "1080p": 45, "1440p": 30 },
    },
  },
  {
    id: "entrada",
    name: "PC de entrada 2025",
    description: "O ponto de partida clássico: Full HD no alto com folga.",
    parts: "RTX 4060 + Ryzen 5 7600 + 16 GB DDR5",
    approxPrice: 5800,
    score: 100,
    fps: {
      esports: { "1080p": 260, "1440p": 180 },
      "aaa-medio": { "1080p": 110, "1440p": 75 },
      "aaa-pesado": { "1080p": 58, "1440p": 38 },
    },
  },
  {
    id: "intermediario",
    name: "PC intermediário",
    description: "Full HD no ultra e 1440p no alto na maioria dos jogos.",
    parts: "RTX 4060 Ti + Core i5-14400F + 16 GB DDR5",
    approxPrice: 6600,
    score: 110,
    fps: {
      esports: { "1080p": 280, "1440p": 200 },
      "aaa-medio": { "1080p": 125, "1440p": 85 },
      "aaa-pesado": { "1080p": 65, "1440p": 44 },
    },
  },
  {
    id: "intermediario-plus",
    name: "PC intermediário forte",
    description: "Feito para 1440p; Full HD vira passeio.",
    parts: "RX 7700 XT + Ryzen 5 7600 + 32 GB DDR5",
    approxPrice: 7200,
    score: 129,
    fps: {
      esports: { "1080p": 300, "1440p": 230 },
      "aaa-medio": { "1080p": 145, "1440p": 100 },
      "aaa-pesado": { "1080p": 78, "1440p": 54 },
    },
  },
  {
    id: "avancado",
    name: "PC avançado",
    description: "1440p no ultra com taxas altas; começa a encarar 4K.",
    parts: "RTX 4070 SUPER + Ryzen 7 7700 + 32 GB DDR5",
    approxPrice: 9500,
    score: 150,
    fps: {
      esports: { "1080p": 320, "1440p": 260 },
      "aaa-medio": { "1080p": 170, "1440p": 120 },
      "aaa-pesado": { "1080p": 95, "1440p": 66 },
    },
  },
  {
    id: "entusiasta",
    name: "PC entusiasta",
    description: "4K e 1440p em taxas muito altas; sobra para tudo.",
    parts: "RTX 4080 SUPER + Ryzen 7 7800X3D + 32 GB DDR5",
    approxPrice: 15000,
    score: 199,
    fps: {
      esports: { "1080p": 360, "1440p": 320 },
      "aaa-medio": { "1080p": 220, "1440p": 165 },
      "aaa-pesado": { "1080p": 130, "1440p": 95 },
    },
  },
];

/** Nomes em português dos perfis de jogo e resoluções, para as telas. */
export const GAME_PROFILE_LABELS = {
  esports: { label: "Jogos leves / eSports", examples: "Valorant, CS2, LoL, Fortnite (competitivo)" },
  "aaa-medio": { label: "Jogos AAA médios", examples: "GTA V, Elden Ring, Forza Horizon 5" },
  "aaa-pesado": { label: "Jogos AAA pesados", examples: "Cyberpunk 2077, Alan Wake 2, Starfield" },
} as const;

export const RESOLUTION_LABELS = {
  "1080p": "Full HD (1080p)",
  "1440p": "Quad HD (1440p)",
} as const;
