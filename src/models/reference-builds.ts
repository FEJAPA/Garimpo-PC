// Computadores de referência usados para estimar o desempenho de uma montagem
// e desenhar o gráfico de comparáveis (spec §4.3 e §6). V2 (pacote D).
//
// De onde vêm os números (seja honesto ao atualizar):
// - `score` segue a MESMA fórmula da montagem: round(0,7 × GPU + 0,3 × CPU), com
//   os índices de src/models/part-specs.ts (RTX 4060 = 100 entre placas de vídeo;
//   Ryzen 5 7600 = 100 entre processadores). Para peças que não estão no catálogo
//   de exemplo, o índice relativo foi derivado de agregados públicos (ver tabela).
// - `fps` são ESTIMATIVAS GarimpoPC, não medições nossas: partimos de um PC de
//   entrada (RTX 4060 + Ryzen 5 7600) e escalamos pelo índice da placa de vídeo,
//   limitando pelo processador nos jogos leves (onde a CPU manda). Cada perfil é a
//   média aproximada dos jogos de exemplo em GAME_PROFILE_LABELS, no alto/ultra,
//   sem DLSS/FSR e sem geração de quadros.
// - `approxPrice` é a ordem de grandeza do preço do PC completo no Brasil (nov/2026),
//   não uma cotação.
// - `measuredAt` é o mês dos agregados públicos usados (AAAA-MM).
//
// Índices usados (GPU: RTX 4060 = 100 · CPU: Ryzen 5 7600 = 100):
//   GPU  RX 6600 78* · RX 7600 97* · RTX 4060 100* · RTX 4060 Ti 118* · RX 9060 XT 16 GB 132
//        RX 7700 XT 142* · RTX 4070 SUPER 168* · RX 9070 XT 200 · RTX 5070 Ti 215
//        RTX 4080 SUPER 222 · RTX 5080 240 · RTX 5090 305
//   CPU  Ryzen 5 5600 85 · Core i5-14400F 92* · Ryzen 5 7600 100* · Ryzen 7 7700 104
//        Ryzen 7 7800X3D 128 · Ryzen 7 9800X3D 145
//   (* = valor de part-specs.ts; o resto vem dos agregados citados em `source`.)
//
// O mesmo conteúdo está em supabase/seed-references.sql (tabela reference_builds);
// src/services/references.ts lê o banco e usa esta lista como reserva.
// TODO(V2-D): trocar as estimativas por médias medidas por jogo quando houver uma
// fonte aberta e estável (ex.: export de agregador com licença) e atualizar todo mês.

import type { ReferenceBuild } from "./builder-types";

const FONTE_GPU_CPU =
  "estimativa GarimpoPC a partir de agregados públicos: checkfps.io (hierarquia de GPUs, out/2026), " +
  "índice MaxMyBuild sobre dados do Tom's Hardware (GPUs, 2026) e PC4Games/Tom's Hardware (CPUs, 2026)";

const MEDIDO_EM = "2026-10";

export const REFERENCE_BUILDS: ReferenceBuild[] = [
  {
    id: "console",
    name: "Equivalente a console",
    description: "Desempenho na faixa de um console atual. Roda tudo em Full HD no médio/alto.",
    parts: "RX 6600 + Ryzen 5 5600 + 16 GB DDR4",
    approxPrice: 4200,
    score: 80,
    ramGb: 16,
    fps: {
      esports: { "1080p": 235, "1440p": 165 },
      "aaa-medio": { "1080p": 80, "1440p": 57 },
      "aaa-pesado": { "1080p": 41, "1440p": 28 },
    },
    source: FONTE_GPU_CPU,
    measuredAt: MEDIDO_EM,
  },
  {
    id: "entrada-economica",
    name: "PC de entrada econômico",
    description: "Full HD no alto na maioria dos jogos, reaproveitando plataforma DDR4.",
    parts: "RX 7600 + Ryzen 5 5600 + 16 GB DDR4",
    approxPrice: 4900,
    score: 93,
    ramGb: 16,
    fps: {
      esports: { "1080p": 251, "1440p": 191 },
      "aaa-medio": { "1080p": 97, "1440p": 71 },
      "aaa-pesado": { "1080p": 50, "1440p": 35 },
    },
    source: FONTE_GPU_CPU,
    measuredAt: MEDIDO_EM,
  },
  {
    id: "entrada",
    name: "PC de entrada 2025",
    description: "O ponto de partida clássico: Full HD no alto com folga.",
    parts: "RTX 4060 + Ryzen 5 7600 + 16 GB DDR5",
    approxPrice: 5800,
    score: 100,
    ramGb: 16,
    fps: {
      esports: { "1080p": 270, "1440p": 200 },
      "aaa-medio": { "1080p": 102, "1440p": 74 },
      "aaa-pesado": { "1080p": 52, "1440p": 36 },
    },
    source: FONTE_GPU_CPU,
    measuredAt: MEDIDO_EM,
  },
  {
    id: "intermediario",
    name: "PC intermediário",
    description: "Full HD no ultra e 1440p no alto na maioria dos jogos.",
    parts: "RTX 4060 Ti + Core i5-14400F + 16 GB DDR5",
    approxPrice: 6600,
    score: 110,
    ramGb: 16,
    fps: {
      esports: { "1080p": 277, "1440p": 221 },
      "aaa-medio": { "1080p": 115, "1440p": 87 },
      "aaa-pesado": { "1080p": 61, "1440p": 43 },
    },
    source: FONTE_GPU_CPU,
    measuredAt: MEDIDO_EM,
  },
  {
    id: "intermediario-2026",
    name: "PC intermediário 2026",
    description: "16 GB de vídeo e 32 GB de memória: Full HD no ultra e 1440p confortável.",
    parts: "RX 9060 XT 16 GB + Ryzen 5 7600 + 32 GB DDR5",
    approxPrice: 7000,
    score: 122,
    ramGb: 32,
    fps: {
      esports: { "1080p": 298, "1440p": 242 },
      "aaa-medio": { "1080p": 128, "1440p": 98 },
      "aaa-pesado": { "1080p": 68, "1440p": 48 },
    },
    source: FONTE_GPU_CPU,
    measuredAt: MEDIDO_EM,
  },
  {
    id: "intermediario-plus",
    name: "PC intermediário forte",
    description: "Feito para 1440p; Full HD vira passeio.",
    parts: "RX 7700 XT + Ryzen 5 7600 + 32 GB DDR5",
    approxPrice: 7300,
    score: 129,
    ramGb: 32,
    fps: {
      esports: { "1080p": 305, "1440p": 253 },
      "aaa-medio": { "1080p": 134, "1440p": 105 },
      "aaa-pesado": { "1080p": 72, "1440p": 52 },
    },
    source: FONTE_GPU_CPU,
    measuredAt: MEDIDO_EM,
  },
  {
    id: "avancado",
    name: "PC avançado",
    description: "1440p no ultra com taxas altas; começa a encarar 4K.",
    parts: "RTX 4070 SUPER + Ryzen 7 7700 + 32 GB DDR5",
    approxPrice: 9500,
    score: 149,
    ramGb: 32,
    fps: {
      esports: { "1080p": 328, "1440p": 283 },
      "aaa-medio": { "1080p": 151, "1440p": 123 },
      "aaa-pesado": { "1080p": 84, "1440p": 62 },
    },
    source: FONTE_GPU_CPU,
    measuredAt: MEDIDO_EM,
  },
  {
    id: "avancado-plus",
    name: "PC avançado forte",
    description: "1440p no ultra acima de 60 fps até nos jogos pesados.",
    parts: "RX 9070 XT + Ryzen 7 7700 + 32 GB DDR5",
    approxPrice: 10500,
    score: 171,
    ramGb: 32,
    fps: {
      esports: { "1080p": 343, "1440p": 307 },
      "aaa-medio": { "1080p": 163, "1440p": 140 },
      "aaa-pesado": { "1080p": 96, "1440p": 74 },
    },
    source: FONTE_GPU_CPU,
    measuredAt: MEDIDO_EM,
  },
  {
    id: "alto",
    name: "PC de alto desempenho",
    description: "1440p com taxas muito altas; 4K no alto na maioria dos jogos.",
    parts: "RTX 5070 Ti + Ryzen 7 7700 + 32 GB DDR5",
    approxPrice: 12500,
    score: 182,
    ramGb: 32,
    fps: {
      esports: { "1080p": 348, "1440p": 316 },
      "aaa-medio": { "1080p": 167, "1440p": 147 },
      "aaa-pesado": { "1080p": 101, "1440p": 79 },
    },
    source: FONTE_GPU_CPU,
    measuredAt: MEDIDO_EM,
  },
  {
    id: "entusiasta",
    name: "PC entusiasta",
    description: "4K e 1440p em taxas muito altas; sobra para tudo.",
    parts: "RTX 4080 SUPER + Ryzen 7 7800X3D + 32 GB DDR5",
    approxPrice: 15000,
    score: 194,
    ramGb: 32,
    fps: {
      esports: { "1080p": 402, "1440p": 359 },
      "aaa-medio": { "1080p": 192, "1440p": 162 },
      "aaa-pesado": { "1080p": 110, "1440p": 84 },
    },
    source: FONTE_GPU_CPU,
    measuredAt: MEDIDO_EM,
  },
  {
    id: "entusiasta-plus",
    name: "PC entusiasta forte",
    description: "Para monitores de alta taxa em 1440p e 4K no ultra.",
    parts: "RTX 5080 + Ryzen 7 9800X3D + 32 GB DDR5",
    approxPrice: 18500,
    score: 212,
    ramGb: 32,
    fps: {
      esports: { "1080p": 441, "1440p": 395 },
      "aaa-medio": { "1080p": 213, "1440p": 178 },
      "aaa-pesado": { "1080p": 120, "1440p": 91 },
    },
    source: FONTE_GPU_CPU,
    measuredAt: MEDIDO_EM,
  },
  {
    id: "topo",
    name: "PC topo de linha",
    description: "O máximo de hoje: 4K no ultra com folga.",
    parts: "RTX 5090 + Ryzen 7 9800X3D + 64 GB DDR5",
    approxPrice: 32000,
    score: 257,
    ramGb: 64,
    fps: {
      esports: { "1080p": 476, "1440p": 441 },
      "aaa-medio": { "1080p": 234, "1440p": 209 },
      "aaa-pesado": { "1080p": 142, "1440p": 115 },
    },
    source: FONTE_GPU_CPU,
    measuredAt: MEDIDO_EM,
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
