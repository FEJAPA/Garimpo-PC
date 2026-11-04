// Estimativa de desempenho da montagem, comparada com computadores de
// referência. Spec §6.
//
// V2 (pacote D): "PCs parecidos" (closestReferences), penalidade de memória SEM dupla
// contagem (R-07), nota de upscaling montada a partir da própria placa (R-08) e guardas
// contra dado ruim vindo do banco (LOG-14/15).
// TODO(V2-D): usar benchmarks reais por jogo (hoje são estimativas; ver
// docs/METODOLOGIA-DESEMPENHO.md).

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

/** Tabela só de zeros: o que devolvemos quando não há base para estimar (nunca NaN). */
function fpsZerado(): FpsTable {
  return mapFps(() => 0);
}

/**
 * Placeholder de "não há computador de referência". Existe porque `PerformanceEstimate.closest`
 * é obrigatório; a tela reconhece este objeto (por identidade ou pelo id) e não mostra
 * comparações nem FPS.
 */
export const SEM_REFERENCIA: ReferenceBuild = {
  id: "sem-referencia",
  name: "Sem referência",
  description: "",
  parts: "",
  approxPrice: 0,
  score: 0,
  fps: fpsZerado(),
};

export const NOTA_SEM_REFERENCIAS =
  "Não há computadores de referência disponíveis agora; sem eles não dá para estimar os FPS.";

/**
 * Referências usáveis: score finito e MAIOR que zero (a escala proporcional divide pelo
 * score; zero daria 0/0 = NaN) e FPS finitos. Dado ruim vindo do banco é ignorado aqui,
 * além de já ser barrado em mapReferenceRow.
 */
function referenciasValidas(refs: ReferenceBuild[]): ReferenceBuild[] {
  return refs.filter(
    (r) =>
      Number.isFinite(r.score) &&
      r.score > 0 &&
      PROFILES.every((p) => RESOLUTIONS.every((res) => Number.isFinite(r.fps?.[p]?.[res])))
  );
}

/** Uma referência usada na interpolação, com o peso dela (a soma dos pesos é 1). */
type Vizinha = { ref: ReferenceBuild; peso: number };

/**
 * Quais referências entram na conta de um score e com que peso. Entre duas referências,
 * o peso é linear (t e 1 − t); fora da faixa, só a da ponta entra, com escala proporcional.
 * `ordenadas` precisa ser não vazia, válida e em ordem crescente de score.
 */
function vizinhasDoScore(score: number, ordenadas: ReferenceBuild[]): { vizinhas: Vizinha[]; escala: number } {
  const menor = ordenadas[0];
  const maior = ordenadas[ordenadas.length - 1];

  if (score <= menor.score) return { vizinhas: [{ ref: menor, peso: 1 }], escala: score / menor.score };
  if (score >= maior.score) return { vizinhas: [{ ref: maior, peso: 1 }], escala: score / maior.score };

  for (let i = 0; i < ordenadas.length - 1; i++) {
    const a = ordenadas[i];
    const b = ordenadas[i + 1];
    if (score >= a.score && score <= b.score) {
      const intervalo = b.score - a.score;
      // Duas referências com o mesmo score: intervalo zero. Fica com a primeira (sem 0/0).
      const t = intervalo > 0 ? (score - a.score) / intervalo : 0;
      return {
        vizinhas: [
          { ref: a, peso: 1 - t },
          { ref: b, peso: t },
        ],
        escala: 1,
      };
    }
  }
  return { vizinhas: [{ ref: maior, peso: 1 }], escala: 1 }; // inalcançável; segurança
}

function ordenarValidas(refs: ReferenceBuild[]): ReferenceBuild[] {
  return referenciasValidas(refs).sort((a, b) => a.score - b.score);
}

function fpsDasVizinhas(vizinhas: Vizinha[], escala: number): FpsTable {
  return mapFps((p, r) => escala * vizinhas.reduce((soma, v) => soma + v.peso * v.ref.fps[p][r], 0));
}

/**
 * FPS estimado para um score: interpolação linear entre as duas referências
 * vizinhas; fora da faixa, escala proporcional à referência da ponta.
 * Sem referências válidas ou com score que não é número, devolve zeros (nunca NaN).
 */
export function interpolateFps(score: number, refs: ReferenceBuild[]): FpsTable {
  const ordenadas = ordenarValidas(refs);
  if (ordenadas.length === 0 || !Number.isFinite(score)) return fpsZerado();
  const { vizinhas, escala } = vizinhasDoScore(Math.max(0, score), ordenadas);
  return fpsDasVizinhas(vizinhas, escala);
}

/** A referência cujo score está mais perto. Sem referências válidas: SEM_REFERENCIA. */
export function closestReference(score: number, refs: ReferenceBuild[]): ReferenceBuild {
  return closestReferences(score, refs, 1)[0] ?? SEM_REFERENCIA;
}

/**
 * As `n` referências de score mais próximo, da mais perto para a mais longe
 * ("PCs parecidos com o seu"). Empate de distância: a de score menor primeiro.
 * Ignora referências inválidas (ver referenciasValidas). Não altera a lista recebida.
 */
export function closestReferences(score: number, refs: ReferenceBuild[], n = 3): ReferenceBuild[] {
  if (n <= 0) return [];
  return referenciasValidas(refs)
    .sort((a, b) => Math.abs(a.score - score) - Math.abs(b.score - score) || a.score - b.score)
    .slice(0, n);
}

/**
 * Frase curta com a posição da montagem entre as referências, para o texto alternativo
 * do gráfico: "Sua montagem tem índice 129, entre PC intermediário e PC intermediário forte".
 * Sem ponto final (quem usa acrescenta o que quiser depois).
 */
export function describeScorePosition(score: number, refs: ReferenceBuild[]): string {
  const base = `Sua montagem tem índice ${score}`;
  const ordenadas = ordenarValidas(refs);
  if (ordenadas.length === 0 || !Number.isFinite(score)) return base;

  const igual = ordenadas.find((r) => r.score === score);
  if (igual) return `${base}, no mesmo nível de ${igual.name}`;

  const menor = ordenadas[0];
  const maior = ordenadas[ordenadas.length - 1];
  if (score < menor.score) return `${base}, abaixo de ${menor.name}`;
  if (score > maior.score) return `${base}, acima de ${maior.name}`;

  const abaixo = [...ordenadas].reverse().find((r) => r.score < score) ?? menor;
  const acima = ordenadas.find((r) => r.score > score) ?? maior;
  return `${base}, entre ${abaixo.name} e ${acima.name}`;
}

// ---------------------------------------------------------------------------
// Memória (R-07)
// ---------------------------------------------------------------------------

/** Memória até este tamanho (GB) é considerada apertada para jogos pesados. */
const RAM_APERTADA_GB = 16;
/** Fator aplicado aos FPS de "aaa-pesado" quando a memória é MENOR que a das referências (−8%). */
const FATOR_RAM_APERTADA = 0.92;

/**
 * Regra de memória, sem dupla contagem: os FPS de cada referência já embutem a memória
 * dela (ex.: o "PC de entrada" tem 16 GB e seus números já são os de 16 GB). Então só
 * descontamos o que falta entre a montagem e as referências usadas na interpolação:
 *   - a montagem precisa ter memória apertada (≤ 16 GB) e MENOS que a referência;
 *   - cada vizinha de 32 GB conta com o peso dela na interpolação (vizinhas mistas dão um
 *     desconto proporcional: 50% de peso em 32 GB → −4%);
 *   - referência sem `ramGb` (dado antigo): não dá para saber se a memória já está contada,
 *     então não penaliza (preferimos não inventar desconto).
 * Devolve o fator multiplicativo (1 = sem desconto).
 */
function fatorDeMemoria(ramGb: number, vizinhas: Vizinha[]): number {
  if (ramGb > RAM_APERTADA_GB) return 1;
  const peso = vizinhas
    .filter((v) => v.ref.ramGb !== undefined && v.ref.ramGb > ramGb)
    .reduce((soma, v) => soma + v.peso, 0);
  const pesoLimitado = Math.min(1, Math.max(0, peso));
  if (pesoLimitado >= 1) return FATOR_RAM_APERTADA; // evita ruído de ponto flutuante no caso comum
  return 1 - (1 - FATOR_RAM_APERTADA) * pesoLimitado;
}

function notaDeMemoria(ramGb: number, fator: number): string {
  const base = `${ramGb} GB de memória: jogos pesados podem engasgar; 32 GB dá folga`;
  const desconto = Math.round((1 - fator) * 100);
  // Só avisa do desconto quando ele existe (e arredonda para pelo menos 1%).
  return desconto >= 1 ? `${base}. Já descontamos ${desconto}% dos FPS de jogos AAA pesados.` : base;
}

// ---------------------------------------------------------------------------
// Upscaling (R-08)
// ---------------------------------------------------------------------------

const TECNOLOGIAS_UPSCALING = ["DLSS", "FSR", "XeSS"] as const;

/** "FSR" · "DLSS ou FSR" · "DLSS, FSR ou XeSS". */
function listaEmPortugues(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} ou ${itens[itens.length - 1]}`;
}

/**
 * Nota informativa de upscaling, montada a partir do que a placa realmente suporta
 * ("Com FSR, …" para AMD; "Com DLSS ou FSR, …" para NVIDIA). Sem tecnologia: null.
 */
function notaDeUpscaling(tecnologias: readonly string[] | undefined): string | null {
  const unicas = [...new Set(tecnologias ?? [])];
  if (unicas.length === 0) return null;
  return `Com ${listaEmPortugues(unicas)}, os FPS podem subir bastante em 1440p. As estimativas não contam esse ganho.`;
}

/** A nota é a de upscaling? A tela usa isto para mostrá-la como linha informativa (R-08). */
export function isUpscalingNote(nota: string): boolean {
  return new RegExp(`^Com (${TECNOLOGIAS_UPSCALING.join("|")})\\b`).test(nota);
}

// ---------------------------------------------------------------------------
// Estimativa completa
// ---------------------------------------------------------------------------

/**
 * Índice de desempenho de uma peça escolhida. Valor que não é número (NaN, texto vindo
 * do banco) ou é negativo vale como "peça ausente" (0), com nota: melhor admitir que a
 * estimativa é parcial do que mostrar o FPS de outra referência sem avisar (LOG-16).
 */
function perfDaPeca(peca: BuildPart | undefined, deQuem: string, notes: string[]): number {
  if (!peca) return 0;
  const perf = peca.spec.perf;
  if (typeof perf !== "number" || !Number.isFinite(perf) || perf < 0) {
    notes.push(`O índice de desempenho ${deQuem} está inválido; a estimativa é parcial.`);
    return 0;
  }
  return perf;
}

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

  const gpuPerf = perfDaPeca(gpu, "da placa de vídeo", notes);
  const cpuPerf = perfDaPeca(cpu, "do processador", notes);
  if (gpu && cpu && cpuPerf < 0.5 * gpuPerf) {
    notes.push(
      "O processador pode limitar a placa de vídeo (gargalo): em jogos leves a taxa de quadros tende a ficar abaixo do esperado."
    );
  }

  const score = garimpoScore(gpuPerf, cpuPerf);

  // Guarda (LOG-15): sem nenhuma referência válida não há com o que comparar.
  const ordenadas = ordenarValidas(refs);
  if (ordenadas.length === 0) {
    notes.push(NOTA_SEM_REFERENCIAS);
    return { score, closest: SEM_REFERENCIA, fps: fpsZerado(), notes };
  }

  const { vizinhas, escala } = vizinhasDoScore(Math.max(0, score), ordenadas);
  const fps = fpsDasVizinhas(vizinhas, escala);

  // Memória: capacidade ausente = desconhecida (sem penalidade e sem nota).
  const ram = parts.find((p) => p.category === "ram");
  const ramGb = ram?.spec.capacityGb;
  if (ramGb !== undefined && Number.isFinite(ramGb) && ramGb > 0 && ramGb <= RAM_APERTADA_GB) {
    const fator = fatorDeMemoria(ramGb, vizinhas);
    if (fator < 1) {
      for (const r of RESOLUTIONS) fps["aaa-pesado"][r] = Math.round(fps["aaa-pesado"][r] * fator);
    }
    notes.push(notaDeMemoria(ramGb, fator));
  }

  // Upscaling: só informa; os números continuam sem DLSS/FSR.
  const upscaling = notaDeUpscaling(gpu?.spec.upscaling);
  if (upscaling) notes.push(upscaling);

  return {
    score,
    closest: closestReference(score, ordenadas),
    fps,
    notes,
  };
}
