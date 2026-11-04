// Tipos do Montador de PC (montagem automática, desempenho e pagamento).
// A especificação completa está em docs/superpowers/specs/2026-11-04-montador-de-pc-design.md.

import type { Category, OfferWithStore, ProductWithOffers, Store } from "./types";

/** Orçamento: quanto a pessoa quer gastar (alvo) e o máximo absoluto (teto). */
export type BudgetPlan = {
  /** Orçamento alvo, em reais. Ex.: 6000. */
  target: number;
  /** Teto: nunca é ultrapassado. Ex.: 7000. Sempre >= target depois de normalizar. */
  hardCap: number;
};

/** Preferências que a pessoa escolhe na tela /montar. */
export type BuildPreferences = {
  budget: BudgetPlan;
  /** Só considerar ofertas de lojas confiáveis (oficial e nota >= 4.5). */
  trustedOnly: boolean;
  /** Balanço do slider: 0 = máximo desempenho, 100 = máxima estética. */
  aesthetics: number;
  /** V2 (pacote B): perfil de uso; ausente = "jogos". */
  usage?: UsageProfile;
  /** V2 (pacote D): resolução-alvo para destacar na tabela de FPS; ausente = "1080p". */
  resolution?: Resolution;
};

/** Perfil de uso (V2, pacote B): muda as fatias do orçamento. */
export type UsageProfile = "jogos" | "trabalho" | "criacao";

export type Socket = "AM4" | "AM5" | "LGA1700";
export type RamType = "DDR4" | "DDR5";
export type FormFactor = "ATX" | "mATX" | "ITX";

/** Especificação técnica de uma peça, chaveada pelo slug do produto. */
export type PartSpec = {
  slug: string;
  category: Category;
  /** Índice de desempenho relativo dentro da categoria (RTX 4060 = 100 entre GPUs). */
  perf: number;
  /** Contribuição visual da peça, de 0 a 100 (vidro, ARGB, branco...). */
  aesthetics: number;
  /** Consumo em watts (gpu, cpu), para dimensionar a fonte. */
  tdp?: number;
  socket?: Socket;
  ramType?: RamType;
  formFactor?: FormFactor;
  caseSupports?: FormFactor[];
  /** Potência nominal da fonte em watts. */
  wattage?: number;
  /** Capacidade em GB (ram, ssd). V2 (pacote D) usa para a penalidade de 16 GB. */
  capacityGb?: number;
  /** Tecnologias de upscaling da GPU (V2, pacote D). */
  upscaling?: ("DLSS" | "FSR" | "XeSS")[];
  /** De onde veio o número (V2, pacote A): fabricante, benchmark agregado, etc. */
  source?: string;
};

/** Um candidato: produto + a melhor oferta válida + sua especificação. */
export type Candidate = {
  product: ProductWithOffers;
  offer: OfferWithStore;
  spec: PartSpec;
  /** Menor preço Pix entre as ofertas válidas (é o preço da oferta escolhida). */
  price: number;
  /** V2 (pacote C): oferta "boa demais" em relação às lojas confiáveis. */
  suspicious?: { reason: string };
};

/** Uma peça escolhida na montagem. */
export type BuildPart = Candidate & { category: Category };

export type GameProfile = "esports" | "aaa-medio" | "aaa-pesado";
export type Resolution = "1080p" | "1440p";

/** Computador de referência usado para estimar o desempenho (ver reference-builds.ts). */
export type ReferenceBuild = {
  id: string;
  name: string;
  description: string;
  /** Peças principais, em texto, para a pessoa entender a comparação. */
  parts: string;
  /** Preço aproximado em reais (ilustrativo na V1). */
  approxPrice: number;
  /** Índice GarimpoPC da referência. */
  score: number;
  /** FPS médio estimado por perfil de jogo e resolução. */
  fps: Record<GameProfile, Record<Resolution, number>>;
  /** Memória da referência em GB (V2, pacote D). */
  ramGb?: number;
  /** Fonte dos benchmarks (V2, pacote D). */
  source?: string;
  /** Mês de referência das fontes consultadas (AAAA-MM); nada foi medido pela GarimpoPC. */
  measuredAt?: string;
};

/** Resultado da avaliação de confiança de uma loja (V2, pacote C). */
export type StoreTrust = {
  trusted: boolean;
  /** Motivos em linguagem simples, ex.: "Loja oficial", "Nota 4,8". */
  reasons: string[];
};

/** Fator de juros para um número de parcelas (V2, pacote E): total = pix * factor. */
export type InstallmentRate = { count: number; factor: number };

export type PerformanceEstimate = {
  /** Índice GarimpoPC: round(0.7 * gpu.perf + 0.3 * cpu.perf). */
  score: number;
  /** Referência com o score mais próximo. */
  closest: ReferenceBuild;
  /** FPS estimado da montagem por perfil e resolução. */
  fps: Record<GameProfile, Record<Resolution, number>>;
  /** Avisos (gargalo de CPU, etc.). */
  notes: string[];
};

/** Resumo de pagamento por loja (cada loja é um pagamento separado). */
export type StorePayment = {
  store: Store;
  items: number;
  pixTotal: number;
  installmentTotal: number;
  /** Máximo de parcelas que a loja oferece nas ofertas usadas (1 se não parcela). */
  installmentCount: number;
  /** Tabela de juros da loja, quando conhecida (V2, pacote E). */
  interestTable?: InstallmentRate[];
  /**
   * Menor número de parcelas anunciado pelas ofertas desta loja (rodada final, S-03): até ele
   * vale o preço a prazo da oferta; a tabela de juros só decide acima disso.
   */
  offersInstallmentCount?: number;
};

export type PaymentSummary = {
  pixTotal: number;
  installmentTotal: number;
  /**
   * Máximo de parcelas selecionável: menor máximo entre as lojas (V1, sem tabela de
   * juros) ou MAIOR entre as lojas quando há tabela (cada loja limita a sua, V2-E).
   */
  maxInstallments: number;
  /** Quanto se economiza pagando tudo no Pix (V2-E: em relação ao parcelado mais barato com n > 1). */
  pixSavings: number;
  /** V2 (pacote E): o plano parcelado mais barato com mais de 1 parcela, base de `pixSavings`. */
  bestInstallment?: { count: number; total: number };
  stores: StorePayment[];
};

export type InstallmentPlan = {
  count: number;
  /** Parcela "de manchete" (primeira faixa). Ver `schedule` para o valor real de cada faixa. */
  monthly: number;
  total: number;
  /**
   * V2 (pacote E): faixas de parcelas quando as lojas têm prazos diferentes, ex.:
   * [{ count: 10, monthly: 586.17 }, { count: 2, monthly: 551.49 }]. A soma de count × monthly = total.
   */
  schedule?: { count: number; monthly: number }[];
};

/** Contexto opcional da montagem (V2): dados vindos do banco, com fallback para o mock. */
export type BuildContext = {
  references?: ReferenceBuild[];
  installmentTables?: Record<string, InstallmentRate[]>;
};

/** Uma montagem salva pela pessoa (V2, pacote G). */
export type SavedBuild = {
  id: string;
  name: string;
  prefs: BuildPreferences;
  parts: { productId: string; offerId: string; price: number }[];
  totalPix: number;
  createdAt: string;
};

export type BuildSuccess = {
  ok: true;
  parts: BuildPart[];
  totalPix: number;
  totalInstallment: number;
  budget: BudgetPlan;
  /** true quando o total ficou acima do alvo (mas sempre <= teto). */
  usedWiggleRoom: boolean;
  /** hardCap - totalPix. */
  leftover: number;
  /** Explicações em linguagem simples (uso da folga, peça fora da fatia, etc.). */
  notes: string[];
  /** V2 (pacote B): trocas feitas com sobras/folga. */
  upgrades?: { category: Category; from: string; to: string; priceDelta: number; perfGainPct: number }[];
  /** V2 (pacote B): peças do catálogo ignoradas por especificação ausente ou inválida. */
  ignored?: { count: number; slugs: string[] };
  performance: PerformanceEstimate;
  payment: PaymentSummary;
};

export type BuildFailure = {
  ok: false;
  reason: string;
};

export type BuildResult = BuildSuccess | BuildFailure;
