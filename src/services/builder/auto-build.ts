// Montagem automática de PC. Spec: docs/superpowers/specs/2026-11-04-montador-de-pc-design.md §5.
//
// Passos (resumo):
//   1. candidatos por categoria (ofertas válidas + spec completa); peças sem spec
//      ou com spec incompleta ficam de fora e viram nota (se nenhuma tem spec,
//      a falha diz isso); oferta "boa demais" só é usada se não houver outra, e
//      aí vira aviso;
//   2. garante que existe UMA montagem compatível que cabe no teto (senão falha);
//   3. passo guloso: divide o alvo em fatias por categoria e escolhe, em cada
//      uma, a opção de maior utilidade que cabe (fatia + sobra acumulada).
//      Processador e placa-mãe são escolhidos JUNTOS, como um par (V2-B2);
//   4. se passou do teto, rebaixa a peça mais cara: entre as opções compatíveis
//      mais baratas, a de MAIOR utilidade que já faz caber (se nenhuma basta,
//      a mais barata, e segue para a próxima peça) (F-02);
//   5. usa sobras e a folga (até o teto) para subir peças na ordem do perfil de
//      uso: jogos GPU → CPU, criação CPU → GPU, trabalho só CPU (S-02), e só
//      quando o ganho de utilidade é >= 10%. Troca que sai mais barata vira
//      "economizando" e não conta como uso da folga (F-04);
//   6. calcula desempenho e pagamento (com o contexto do banco, se vier).
//
// TODO(V2-B): trocar o guloso por uma otimização global (ex.: busca em feixe)
// que considere trocas entre categorias também no rebaixamento (hoje uma peça
// por rodada, sem trocar a fonte junto) e nas subidas (hoje a subida de CPU
// mantém a placa-mãe), e a resolução-alvo.

import type { Category, OfferWithStore, ProductWithOffers, Store } from "@/models/types";
import type {
  BuildContext,
  BuildFailure,
  BuildPart,
  BuildPreferences,
  BuildResult,
  BuildSuccess,
  Candidate,
  PartSpec,
  UsageProfile,
} from "@/models/builder-types";
import { categoryLabel } from "@/models/categories";
import { formatBRL } from "@/lib/currency";
import { normalizeBudget } from "./budget";
import { isTrustedStore, validOffers } from "./trust";
import { suspiciousPrice } from "./suspicious";
import { categoryShares, partUtility, upgradeOrder } from "./scoring";
import { hasRequiredSpec, isCompatible } from "./compatibility";
import { estimatePerformance } from "./performance";
import { buildPaymentSummary } from "./payments";

/** Ordem em que as categorias são escolhidas (fonte por último: depende do consumo). */
export const PICK_ORDER: Category[] = ["gpu", "cpu", "motherboard", "ram", "ssd", "case", "psu"];
/** Ordem de exibição na tela. */
export const DISPLAY_ORDER: Category[] = ["gpu", "cpu", "motherboard", "ram", "ssd", "psu", "case"];
/** Ganho mínimo de utilidade para uma troca "para cima" valer a pena (10%). */
export const MIN_UPGRADE_GAIN = 1.1;

/**
 * Passos do guloso. Processador e placa-mãe formam um passo só: escolher a CPU
 * mais barata sozinha pode obrigar a uma placa-mãe cara (outro socket), e o par
 * inteiro sair mais caro que outro par (V2-B2).
 */
const GREEDY_STEPS: Category[][] = [["gpu"], ["cpu", "motherboard"], ["ram"], ["ssd"], ["case"], ["psu"]];

export type CandidatesByCategory = Record<Category, Candidate[]>;

/** Peças do catálogo deixadas de fora por spec ausente, incompleta ou de outra categoria. */
export type IgnoredParts = { count: number; slugs: string[] };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function emptyCandidates(): CandidatesByCategory {
  return { gpu: [], cpu: [], motherboard: [], ram: [], ssd: [], psu: [], case: [] };
}

/** A oferta mais barata (preço Pix) de uma lista não vazia; empate fica com a primeira. */
function maisBarata(ofertas: OfferWithStore[]): OfferWithStore {
  return ofertas.reduce((melhor, o) => (o.price_pix < melhor.price_pix ? o : melhor));
}

/** Marca de oferta suspeita: id da oferta → motivo (mesmo formato de `flagSuspiciousOffers`). */
export type SuspicionCheck = (product: ProductWithOffers) => Map<string, { reason: string }>;

/**
 * Confiança da loja com cache. Por quê: `isTrustedStore` monta os textos dos
 * motivos (com `toLocaleString`) a cada chamada e custa dezenas de µs; com 150
 * peças por categoria e várias ofertas por peça, isso sozinho passava de 200 ms.
 * A chave é a loja inteira (todos os campos), e não só o id: vindo do banco, cada
 * oferta traz o próprio objeto de loja, e dois objetos com o mesmo id e dados
 * diferentes não podem dividir a resposta.
 */
function makeTrustCache(): (store: Store) => boolean {
  const porObjeto = new WeakMap<Store, boolean>();
  const porConteudo = new Map<string, boolean>();
  return (store) => {
    let v = porObjeto.get(store);
    if (v !== undefined) return v;
    const k = JSON.stringify(store);
    v = porConteudo.get(k);
    if (v === undefined) {
      v = isTrustedStore(store);
      porConteudo.set(k, v);
    }
    porObjeto.set(store, v);
    return v;
  };
}

/**
 * Ofertas válidas e suspeitas de uma peça, com a confiança em cache.
 *
 * Equivale a `validOffers(product, trustedOnly)` + `flagSuspiciousOffers(product)`
 * (C3): parte de `validOffers(product, false)` (estoque, preço, bloqueio), aplica o
 * filtro de confiança e marca, entre as lojas NÃO confiáveis, as que ficam 25% ou
 * mais abaixo da mediana das confiáveis (`suspiciousPrice`). O teste
 * "equivale às regras de trust.ts/suspicious.ts" confere isso no catálogo inteiro.
 * TODO(V2-B): quando `isTrustedStore` ficar barato (cache em trust.ts), voltar a
 * chamar `flagSuspiciousOffers` direto.
 */
function ofertasDaPeca(
  product: ProductWithOffers,
  trustedOnly: boolean,
  confiavel: (store: Store) => boolean
): { validas: OfferWithStore[]; suspeitas: Map<string, { reason: string }> } {
  const todas = validOffers(product, false);
  const validas = trustedOnly ? todas.filter((o) => confiavel(o.store)) : todas;
  const suspeitas = new Map<string, { reason: string }>();
  const precosConfiaveis = todas.filter((o) => confiavel(o.store)).map((o) => o.price_pix);
  if (precosConfiaveis.length > 0) {
    for (const o of todas) {
      if (confiavel(o.store)) continue;
      const flag = suspiciousPrice(o.price_pix, precosConfiaveis);
      if (flag) suspeitas.set(o.id, flag);
    }
  }
  return { validas, suspeitas };
}

/**
 * A oferta que o Montador usa para uma peça (R-01): a válida mais barata que
 * NÃO é suspeita. Se todas as válidas forem suspeitas, usa a mais barata e
 * devolve o motivo, para a montagem avisar a pessoa.
 */
function escolherOferta(
  validas: OfferWithStore[],
  suspeitas: Map<string, { reason: string }>
): { offer: OfferWithStore; suspicious?: { reason: string } } | null {
  if (validas.length === 0) return null;
  const limpas = validas.filter((o) => !suspeitas.has(o.id));
  if (limpas.length > 0) return { offer: maisBarata(limpas) };
  const offer = maisBarata(validas);
  const flag = suspeitas.get(offer.id);
  return flag ? { offer, suspicious: { reason: flag.reason } } : { offer };
}

/**
 * Candidatos por categoria e peças ignoradas. Uma peça entra quando tem spec
 * completa (`hasRequiredSpec`) da MESMA categoria do produto e ao menos uma
 * oferta válida. Peça sem spec (ou com spec ruim) é contada em `ignored`,
 * mesmo que esteja sem estoque, porque o problema é do cadastro, não da loja.
 * `check` (opcional) troca o detector de oferta suspeita; existe para testar o
 * caso "só há ofertas suspeitas", que a regra atual de C3 nunca produz (a loja
 * confiável nunca é marcada), mas que o Montador precisa tratar se a regra mudar.
 */
export function collectCandidates(
  products: ProductWithOffers[],
  specs: Record<string, PartSpec>,
  trustedOnly: boolean,
  check?: SuspicionCheck
): { candidates: CandidatesByCategory; ignored: IgnoredParts } {
  const candidates = emptyCandidates();
  const ignorados = new Set<string>();
  const confiavel = makeTrustCache();
  for (const product of products) {
    const spec = specs[product.slug];
    if (!spec || spec.category !== product.category || !hasRequiredSpec(spec)) {
      ignorados.add(product.slug);
      continue;
    }
    const { validas, suspeitas } = ofertasDaPeca(product, trustedOnly, confiavel);
    const escolha = escolherOferta(validas, check ? check(product) : suspeitas);
    if (!escolha) continue;
    const cand: Candidate = { product, offer: escolha.offer, spec, price: escolha.offer.price_pix };
    if (escolha.suspicious) cand.suspicious = escolha.suspicious;
    candidates[spec.category].push(cand);
  }
  const slugs = [...ignorados];
  return { candidates, ignored: { count: slugs.length, slugs } };
}

/** Candidatos por categoria (ver `collectCandidates`, que também conta as ignoradas). */
export function buildCandidates(
  products: ProductWithOffers[],
  specs: Record<string, PartSpec>,
  trustedOnly: boolean
): CandidatesByCategory {
  return collectCandidates(products, specs, trustedOnly).candidates;
}

const specsOf = (parts: Candidate[]): PartSpec[] => parts.map((p) => p.spec);
const totalOf = (parts: Candidate[]): number => round2(parts.reduce((s, p) => s + p.price, 0));
const compatible = (parts: Candidate[], c: Candidate): boolean => isCompatible(specsOf(parts), c.spec);
const byPrice = (a: Candidate, b: Candidate) => a.price - b.price || a.spec.slug.localeCompare(b.spec.slug);

/** Todas as peças compatíveis entre si (cada uma contra as outras). */
function allCompatible(parts: Candidate[]): boolean {
  return parts.every((p) => compatible(parts.filter((x) => x !== p), p));
}

function sortedByPrice(cands: CandidatesByCategory): CandidatesByCategory {
  const out = emptyCandidates();
  for (const cat of PICK_ORDER) out[cat] = [...cands[cat]].sort(byPrice);
  return out;
}

// ---------------------------------------------------------------------------
// Planejador: a montagem compatível mais barata que contém certas peças fixas.
// ---------------------------------------------------------------------------
//
// Por que não testar todas as combinações: com 150 peças por categoria são
// 150^7 montagens. As regras de compatibility.ts formam uma "árvore" em volta
// do processador, e isso permite achar a mais barata EXATA de forma rápida:
//
//   placa de vídeo ─┐
//                   ├─ fonte (potência depende de gpu + cpu)
//   processador ────┘
//        │ socket
//   placa-mãe ── memória (tipo DDR) e gabinete (formato)
//   SSD: sem regra
//
// Para cada processador: (melhor placa-mãe + memória + gabinete para ele) +
// (melhor placa de vídeo + fonte para ele) + SSD mais barato. Cada pedaço é
// guardado em cache. Se uma regra nova ligar outras categorias (TODO(V2-A):
// comprimento da GPU no gabinete, etc.), este planejador precisa mudar junto;
// até lá, `cheapestCompatibleBuild` confere o resultado com `allCompatible` e
// prefere falhar a devolver peças incompatíveis.

type Fixed = Partial<Record<Category, Candidate>>;
type Plan = { parts: Candidate[]; total: number };
type Branch = { parts: Candidate[]; cost: number };

const chave = (c: Candidate | undefined) => (c ? c.spec.slug : "*");

function makePlanner(cands: CandidatesByCategory) {
  const sorted = sortedByPrice(cands);
  const lista = (cat: Category, fixed: Fixed): Candidate[] => (fixed[cat] ? [fixed[cat]!] : sorted[cat]);

  // Placa-mãe → memória e gabinete mais baratos que servem nela.
  const cacheResto = new Map<string, Branch | null>();
  function restoDaPlaca(m: Candidate, fixed: Fixed): Branch | null {
    const k = `${chave(fixed.ram)}|${chave(fixed.case)}|${m.spec.slug}`;
    if (cacheResto.has(k)) return cacheResto.get(k)!;
    const ram = lista("ram", fixed).find((r) => isCompatible([m.spec], r.spec));
    const gab = lista("case", fixed).find((c) => isCompatible([m.spec], c.spec));
    const out = ram && gab ? { parts: [m, ram, gab], cost: m.price + ram.price + gab.price } : null;
    cacheResto.set(k, out);
    return out;
  }

  // Placas-mãe (com memória e gabinete) ordenadas pelo custo do conjunto.
  const cachePlacas = new Map<string, Branch[]>();
  function placasOrdenadas(fixed: Fixed): Branch[] {
    const k = `${chave(fixed.motherboard)}|${chave(fixed.ram)}|${chave(fixed.case)}`;
    let out = cachePlacas.get(k);
    if (!out) {
      out = lista("motherboard", fixed)
        .map((m) => restoDaPlaca(m, fixed))
        .filter((b): b is Branch => b !== null)
        .sort((a, b) => a.cost - b.cost || a.parts[0].spec.slug.localeCompare(b.parts[0].spec.slug));
      cachePlacas.set(k, out);
    }
    return out;
  }

  // Processador → placa-mãe + memória + gabinete mais baratos para ele.
  const cachePlaca = new Map<string, Branch | null>();
  function melhorPlaca(cpu: Candidate, fixed: Fixed): Branch | null {
    const k = `${chave(fixed.motherboard)}|${chave(fixed.ram)}|${chave(fixed.case)}|${cpu.spec.slug}`;
    if (cachePlaca.has(k)) return cachePlaca.get(k)!;
    // Lista ordenada por custo: a primeira que serve é a mais barata.
    const out = placasOrdenadas(fixed).find((b) => isCompatible([cpu.spec], b.parts[0].spec)) ?? null;
    cachePlaca.set(k, out);
    return out;
  }

  // Processador → placa de vídeo + fonte mais baratas para ele.
  const cacheVideo = new Map<string, Branch | null>();
  function melhorVideoFonte(cpu: Candidate, fixed: Fixed): Branch | null {
    const k = `${chave(fixed.gpu)}|${chave(fixed.psu)}|${cpu.spec.slug}`;
    if (cacheVideo.has(k)) return cacheVideo.get(k)!;
    const fontes = lista("psu", fixed);
    const fonteMin = fontes.length > 0 ? fontes[0].price : 0;
    let best: Branch | null = null;
    for (const g of lista("gpu", fixed)) {
      // GPUs em ordem de preço: daqui para frente nenhuma ganha da melhor achada.
      if (best && g.price + fonteMin >= best.cost) break;
      const psu = fontes.find((p) => isCompatible([g.spec, cpu.spec], p.spec));
      if (psu && (!best || g.price + psu.price < best.cost)) best = { parts: [g, psu], cost: g.price + psu.price };
    }
    cacheVideo.set(k, best);
    return best;
  }

  /**
   * A montagem compatível mais barata que contém as peças `fixed` (ou null).
   * Com `qualquer`, devolve a primeira que fechar (não necessariamente a mais
   * barata): o guloso só precisa saber se ainda DÁ para completar.
   */
  function completar(fixed: Fixed, qualquer = false): Plan | null {
    const ssd = lista("ssd", fixed).find((s) => isCompatible([], s.spec));
    if (!ssd) return null;
    let best: { cpu: Candidate; placa: Branch; video: Branch; total: number } | null = null;
    for (const cpu of lista("cpu", fixed)) {
      if (best && cpu.price >= best.total) break; // ordem de preço: não tem como ganhar
      const placa = melhorPlaca(cpu, fixed);
      if (!placa) continue;
      const video = melhorVideoFonte(cpu, fixed);
      if (!video) continue;
      const total = cpu.price + placa.cost + video.cost + ssd.price;
      if (!best || total < best.total) best = { cpu, placa, video, total };
      if (qualquer) break;
    }
    if (!best) return null;
    const parts = [best.video.parts[0], best.cpu, ...best.placa.parts, ssd, best.video.parts[1]];
    return { parts, total: totalOf(parts) };
  }

  /** Ainda dá para completar uma montagem compatível com estas peças? */
  const podeCompletar = (fixed: Fixed): boolean => completar(fixed, true) !== null;

  return { sorted, completar, podeCompletar };
}

type Planner = ReturnType<typeof makePlanner>;

function fixedOf(parts: Candidate[]): Fixed {
  const out: Fixed = {};
  for (const p of parts) out[p.spec.category] = p;
  return out;
}

/** A montagem compatível mais barata possível (ou null se não existe nenhuma). */
export function cheapestCompatibleBuild(
  cands: CandidatesByCategory
): { parts: BuildPart[]; total: number } | null {
  return cheapestFrom(makePlanner(cands));
}

function cheapestFrom(planner: Planner): { parts: BuildPart[]; total: number } | null {
  const plan = planner.completar({});
  if (!plan || !allCompatible(plan.parts)) return null;
  return { parts: toBuildParts(plan.parts), total: plan.total };
}

function toBuildParts(parts: Candidate[]): BuildPart[] {
  return [...parts]
    .map((p) => ({ ...p, category: p.spec.category }))
    .sort((a, b) => DISPLAY_ORDER.indexOf(a.category) - DISPLAY_ORDER.indexOf(b.category));
}

type Scorer = (c: Candidate) => number;

/** Cria a função de utilidade para o slider, normalizando pelo maior perf de cada categoria. */
function makeScorer(cands: CandidatesByCategory, aesthetics: number): Scorer {
  const maxPerf = {} as Record<Category, number>;
  for (const cat of PICK_ORDER) maxPerf[cat] = Math.max(0, ...cands[cat].map((c) => c.spec.perf));
  return (c) => partUtility(c.spec, aesthetics, maxPerf[c.spec.category]);
}

function sortByUtility(list: Candidate[], utility: Scorer): Candidate[] {
  return [...list].sort(
    (a, b) => utility(b) - utility(a) || a.price - b.price || a.spec.slug.localeCompare(b.spec.slug)
  );
}

/** Nome da categoria para o meio da frase: "Memória RAM" → "memória RAM" (R-16). */
const lower = (cat: Category) => {
  const label = categoryLabel(cat);
  return label.charAt(0).toLowerCase() + label.slice(1);
};

/** Artigo de cada categoria ("a placa de vídeo", "o processador"). */
const ARTIGO: Record<Category, "a" | "o"> = {
  gpu: "a", cpu: "o", motherboard: "a", ram: "a", ssd: "o", psu: "a", case: "o",
};

/** "a", "a e b", "a, b e c". */
function juntarLista(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** Uma opção de um passo do guloso: uma peça ou o par processador + placa-mãe. */
type Option = { parts: Candidate[]; price: number; utility: number; key: string };

/** Passo 3: escolha gulosa por fatias do orçamento alvo. */
function greedyPass(
  cands: CandidatesByCategory,
  planner: Planner,
  utility: Scorer,
  target: number,
  shares: Record<Category, number>
): { parts: Candidate[]; notes: string[] } | null {
  const parts: Candidate[] = [];
  const semFatia: Category[] = [];
  let carry = 0;

  for (const step of GREEDY_STEPS) {
    const fatia = step.reduce((s, cat) => s + shares[cat], 0);
    const allowance = fatia * target + carry;

    // Opções do passo: cada peça, ou cada par CPU + placa-mãe compatível.
    let opcoes: Candidate[][];
    if (step.length === 1) {
      opcoes = cands[step[0]].map((c) => [c]);
    } else {
      opcoes = [];
      for (const cpu of cands.cpu) {
        for (const mobo of cands.motherboard) if (isCompatible([cpu.spec], mobo.spec)) opcoes.push([cpu, mobo]);
      }
    }

    const todas: Option[] = opcoes.map((op) => ({
      parts: op,
      price: totalOf(op),
      // Utilidade do par = média das utilidades, pesada pelas fatias de cada categoria.
      utility:
        fatia > 0
          ? op.reduce((s, c) => s + shares[c.spec.category] * utility(c), 0) / fatia
          : op.reduce((s, c) => s + utility(c), 0) / op.length,
      key: op.map((c) => c.spec.slug).join("+"),
    }));

    // Viável = compatível com o que já foi escolhido e ainda dá para completar a
    // montagem. Só é calculado para as opções que o guloso de fato olha (com
    // 150 × 150 pares, conferir todos custava dezenas de ms à toa).
    const viavel = (o: Option): boolean => {
      const juntas = [...parts, ...o.parts];
      if (!o.parts.every((c) => compatible(juntas.filter((x) => x !== c), c))) return false;
      return planner.podeCompletar(fixedOf(juntas));
    };

    // A de maior utilidade que cabe na fatia + sobra; senão, a viável mais barata.
    todas.sort((a, b) => b.utility - a.utility || a.price - b.price || a.key.localeCompare(b.key));
    let chosen = todas.find((o) => o.price <= allowance && viavel(o));
    if (!chosen) {
      todas.sort((a, b) => a.price - b.price || a.key.localeCompare(b.key));
      chosen = todas.find(viavel);
      if (!chosen) return null;
      semFatia.push(...step);
    }
    carry = allowance - chosen.price;
    parts.push(...chosen.parts);
  }

  // R-16: uma nota só, com as categorias em linguagem de gente.
  const notes =
    semFatia.length > 0
      ? [`Para caber no orçamento, usamos as opções compatíveis mais baratas em: ${juntarLista(semFatia.map(lower))}.`]
      : [];
  return { parts, notes };
}

/**
 * Passo 4: rebaixa até caber no teto (F-02).
 *
 * A cada rodada, pega a peça mais cara que tem opção compatível mais barata e,
 * entre essas opções, fica com a de MAIOR utilidade cuja troca já faz o total
 * caber. Por quê: trocar pela "próxima mais barata" podia escolher uma peça
 * pior e mais cara que outra que também cabia (ex.: gpu-b R$ 2.900 com perf 95
 * no lugar de gpu-c R$ 2.500 com perf 100).
 * Se nenhuma troca dessa peça basta sozinha, usa a mais barata dela (é o
 * máximo que ela pode ajudar) e a rodada seguinte completa com outra peça. O
 * passo 5 ainda pode subir de novo a peça rebaixada com o que sobrar.
 */
function downgradeToCap(
  parts: Candidate[],
  cands: CandidatesByCategory,
  utility: Scorer,
  hardCap: number
): Candidate[] {
  let current = [...parts];
  for (let iter = 0; iter < 100 && totalOf(current) > hardCap; iter++) {
    const total = totalOf(current);
    const porPreco = [...current].sort((a, b) => b.price - a.price);
    let trocou = false;
    for (const peca of porPreco) {
      const others = current.filter((p) => p !== peca);
      const maisBaratas = cands[peca.spec.category].filter((c) => c.price < peca.price && compatible(others, c));
      if (maisBaratas.length === 0) continue;
      const cabem = maisBaratas.filter((c) => round2(total - peca.price + c.price) <= hardCap);
      const escolhida = cabem.length > 0 ? sortByUtility(cabem, utility)[0] : [...maisBaratas].sort(byPrice)[0];
      current = [...others, escolhida];
      trocou = true;
      break;
    }
    if (!trocou) break;
  }
  return current;
}

type Upgrade = { category: Category; from: Candidate; to: Candidate; priceDelta: number; trocouFonte: boolean };

/**
 * Passo 5: sobe peças usando sobras e folga, só com ganho >= 10%, na ordem do
 * perfil de uso (`upgradeOrder`, S-02): no "Trabalho" a folga nunca vai para a
 * placa de vídeo.
 */
function upgradePass(
  parts: Candidate[],
  planner: Planner,
  utility: Scorer,
  hardCap: number,
  usage: UsageProfile | undefined
): { parts: Candidate[]; upgrades: Upgrade[] } {
  let current = [...parts];
  const upgrades: Upgrade[] = [];

  for (const cat of upgradeOrder(usage)) {
    const atual = current.find((p) => p.spec.category === cat);
    if (!atual) continue;
    const semPsu = current.filter((p) => p !== atual && p.spec.category !== "psu");
    const psuAtual = current.find((p) => p.spec.category === "psu");
    // LOG-06: com utilidade atual zero, "10% a mais" seria zero e qualquer troca
    // passaria. Exigimos então utilidade estritamente maior.
    const uAtual = utility(atual);
    const minimo = uAtual > 0 ? uAtual * MIN_UPGRADE_GAIN : Number.MIN_VALUE;

    for (const cand of sortByUtility(planner.sorted[cat], utility)) {
      if (utility(cand) < minimo) break; // lista ordenada: daqui para baixo ninguém ganha 10%
      if (cand.spec.slug === atual.spec.slug || !compatible(semPsu, cand)) continue;

      const novas = [...semPsu, cand];
      const psu =
        psuAtual && compatible(novas, psuAtual)
          ? psuAtual
          : planner.sorted.psu.find((c) => compatible(novas, c));
      if (!psu) continue;

      const tentativa = [...novas, psu];
      if (totalOf(tentativa) <= hardCap) {
        upgrades.push({
          category: cat,
          from: atual,
          to: cand,
          priceDelta: round2(totalOf(tentativa) - totalOf(current)),
          trocouFonte: psu !== psuAtual,
        });
        current = tentativa;
        break;
      }
    }
  }
  return { parts: current, upgrades };
}

/** Ganho de desempenho em % (perf da spec), ou null se não dá para calcular (LOG-06). */
function ganhoPct(from: Candidate, to: Candidate): number | null {
  const de = from.spec.perf;
  const para = to.spec.perf;
  if (!Number.isFinite(de) || !Number.isFinite(para) || de <= 0) return null;
  return Math.round((para / de - 1) * 100);
}

/**
 * Nota de uma troca, com o preço DELA (R-17) e o ganho real de desempenho.
 * F-04: uma troca pode sair MAIS BARATA (ex.: GPU melhor e mais barata que só
 * cabia com outra fonte). Aí a nota diz "economizando", nunca "por mais -R$".
 */
function notaDaTroca(u: Upgrade): string {
  const pct = ganhoPct(u.from, u.to);
  const fonte = u.trocouFonte ? ", já contando a troca da fonte" : "";
  let ganho = "";
  if (pct !== null && pct > 0) ganho = ` (+${pct}% de desempenho)`;
  else if (pct === 0) ganho = " (mesmo desempenho, visual melhor)";
  else if (pct !== null) ganho = ` (visual melhor, ${Math.abs(pct)}% menos desempenho)`;
  const preco =
    u.priceDelta > 0
      ? `por mais ${formatBRL(u.priceDelta)}`
      : u.priceDelta < 0
        ? `economizando ${formatBRL(-u.priceDelta)}`
        : "pelo mesmo preço";
  return `Subimos ${ARTIGO[u.category]} ${lower(u.category)}: ${u.from.product.name} → ${u.to.product.name}, ${preco}${fonte}${ganho}.`;
}

/** R-01: cada peça que veio de oferta "boa demais" gera um aviso (nunca passa em silêncio). */
export function suspicionNotes(parts: BuildPart[]): string[] {
  return parts
    .filter((p) => p.suspicious)
    .map(
      (p) =>
        `Atenção: ${ARTIGO[p.category]} ${lower(p.category)} veio de uma oferta com preço bom demais na loja ${p.offer.store.name} — confira antes de pagar.`
    );
}

function fail(reason: string): BuildFailure {
  return { ok: false, reason };
}

/**
 * Monta um PC completo para as preferências dadas.
 * `ctx` (opcional, V2): referências de desempenho e tabelas de juros vindas do
 * banco. Sem ele, valem os dados de demonstração de performance.ts/payments.ts.
 */
export function autoBuild(
  products: ProductWithOffers[],
  specs: Record<string, PartSpec>,
  prefs: BuildPreferences,
  ctx?: BuildContext
): BuildResult {
  const budget = normalizeBudget(prefs.budget);
  const { candidates: cands, ignored } = collectCandidates(products, specs, prefs.trustedOnly);

  // 1) Toda categoria precisa de ao menos um candidato. S-10: se faltou porque
  // nenhuma peça (ou nenhuma da categoria) tem spec, dizer isso; mandar
  // desligar o filtro de lojas seria a dica errada.
  const semSpec = new Set(ignored.slugs);
  const todasSemSpec = (lista: ProductWithOffers[]) => lista.length > 0 && lista.every((p) => semSpec.has(p.slug));
  if (todasSemSpec(products)) {
    return fail("Nenhuma peça do catálogo tem especificação técnica cadastrada; não dá para montar agora.");
  }
  for (const cat of PICK_ORDER) {
    if (cands[cat].length === 0) {
      if (todasSemSpec(products.filter((p) => p.category === cat))) {
        const nenhuma = ARTIGO[cat] === "a" ? "Nenhuma" : "Nenhum";
        return fail(`${nenhuma} ${lower(cat)} do catálogo tem especificação técnica cadastrada; não dá para montar agora.`);
      }
      const dica = prefs.trustedOnly ? " Desative “Só lojas confiáveis” ou tente mais tarde." : " Tente mais tarde.";
      return fail(`Não há ${lower(cat)} disponível com os filtros atuais.${dica}`);
    }
  }

  // 2) Existe alguma montagem compatível que caiba no teto?
  const planner = makePlanner(cands);
  const cheapest = cheapestFrom(planner);
  if (!cheapest) {
    return fail("Não encontramos uma combinação compatível de peças no catálogo atual.");
  }
  if (cheapest.total > budget.hardCap) {
    return fail(
      `Orçamento insuficiente: a montagem mais barata compatível custa ${formatBRL(cheapest.total)}. Suba o teto${
        prefs.trustedOnly ? " ou desative “Só lojas confiáveis”" : ""
      }.`
    );
  }

  // 3) Passo guloso dentro do alvo.
  const utility = makeScorer(cands, prefs.aesthetics);
  const shares = categoryShares(prefs.aesthetics, prefs.usage);
  const greedy = greedyPass(cands, planner, utility, budget.target, shares);
  const notes: string[] = greedy?.notes ?? [];
  let parts: Candidate[] = greedy && allCompatible(greedy.parts) ? greedy.parts : cheapest.parts;

  // 4) Garantia do teto.
  if (totalOf(parts) > budget.hardCap) {
    parts = downgradeToCap(parts, cands, utility, budget.hardCap);
    if (totalOf(parts) > budget.hardCap) {
      parts = cheapest.parts;
      notes.push("Para caber no teto, usamos a montagem compatível mais barata.");
    }
  }

  // 5) Sobras e folga: subir GPU/CPU (na ordem do perfil) quando vale a pena.
  const totalAntes = totalOf(parts);
  const up = upgradePass(parts, planner, utility, budget.hardCap, prefs.usage);
  parts = up.parts;
  const totalPix = totalOf(parts);

  for (const u of up.upgrades) notes.push(notaDaTroca(u));
  // F-04: só troca que custou dinheiro pode ter usado a folga.
  const trocasPagas = up.upgrades.filter((u) => u.priceDelta > 0);
  const excessoAntes = Math.max(0, round2(totalAntes - budget.target));
  const excessoDepois = Math.max(0, round2(totalPix - budget.target));
  if (trocasPagas.length === 0 && excessoDepois > 0) {
    notes.push(`A montagem ficou ${formatBRL(excessoDepois)} acima do alvo, mas dentro do teto.`);
  } else if (trocasPagas.length > 0) {
    if (excessoAntes > 0) {
      notes.push(`Antes das trocas, as peças já passavam ${formatBRL(excessoAntes)} do alvo (dentro do teto).`);
    }
    if (excessoDepois > excessoAntes) {
      // Parte do preço das trocas pode ter vindo da sobra dentro do alvo; a folga
      // é só o que passou do alvo. Ex.: troca de R$ 1.100, sobra de R$ 300,70 →
      // "usaram R$ 799,30 da folga; o resto veio do que sobrou dentro do alvo".
      const daFolga = round2(excessoDepois - excessoAntes);
      const custoTrocas = round2(trocasPagas.reduce((soma, u) => soma + u.priceDelta, 0));
      const resto = custoTrocas > daFolga ? "; o resto veio do que sobrou dentro do alvo" : "";
      notes.push(`No total, as trocas usaram ${formatBRL(daFolga)} da folga (acima do alvo, dentro do teto)${resto}.`);
    }
  }

  const buildParts = toBuildParts(parts);

  const avisos = suspicionNotes(buildParts);

  // LOG-04: a pessoa precisa saber que parte do catálogo ficou de fora.
  if (ignored.count > 0) {
    notes.push(
      ignored.count === 1
        ? "1 peça do catálogo foi ignorada por falta de especificação técnica."
        : `${ignored.count} peças do catálogo foram ignoradas por falta de especificação técnica.`
    );
  }

  const payment = buildPaymentSummary(buildParts, ctx?.installmentTables);
  const upgrades: NonNullable<BuildSuccess["upgrades"]> = up.upgrades.map((u) => ({
    category: u.category,
    from: u.from.product.name,
    to: u.to.product.name,
    priceDelta: u.priceDelta,
    // Sem perf de origem válido não há percentual honesto; 0 = "não informado".
    perfGainPct: ganhoPct(u.from, u.to) ?? 0,
  }));

  return {
    ok: true,
    parts: buildParts,
    totalPix,
    // S-09: o "ou R$ X parcelado" do cabeçalho tem de ser um parcelado que existe
    // (o mais barato com mais de 1 parcela); o preço a prazo somado pode não ser.
    totalInstallment: payment.bestInstallment?.total ?? payment.installmentTotal,
    budget,
    // LOG-05: só "usou a folga" se uma troca foi feita E o total passou do alvo.
    // F-04: troca que economizou (ou não mudou o preço) não conta.
    usedWiggleRoom: trocasPagas.length > 0 && totalPix > budget.target,
    leftover: round2(budget.hardCap - totalPix),
    notes: [...avisos, ...notes],
    upgrades,
    ignored,
    performance: estimatePerformance(buildParts, ctx?.references),
    payment,
  };
}
