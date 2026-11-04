// Montagem automática de PC. Spec: docs/superpowers/specs/2026-11-04-montador-de-pc-design.md §5.
//
// Passos (resumo):
//   1. candidatos por categoria (ofertas válidas + spec conhecida);
//   2. garante que existe UMA montagem compatível que cabe no teto (senão falha);
//   3. passo guloso: divide o alvo em fatias por categoria e escolhe, em cada
//      uma, a peça de maior utilidade que cabe (fatia + sobra acumulada);
//   4. se passou do teto, rebaixa a categoria mais cara até caber;
//   5. usa sobras e a folga (até o teto) para subir GPU e depois CPU, só quando
//      o ganho de utilidade é >= 10%;
//   6. calcula desempenho e pagamento.
//
// TODO(V2-B): trocar o guloso por uma otimização global (ex.: busca em feixe ou
// knapsack por categoria) que considere trocas entre categorias (CPU+placa-mãe
// como um par, etc.), perfis de uso (jogos/trabalho/criação) e resolução-alvo.

import type { Category, ProductWithOffers } from "@/models/types";
import type {
  BuildFailure,
  BuildPart,
  BuildPreferences,
  BuildResult,
  Candidate,
  PartSpec,
} from "@/models/builder-types";
import { categoryLabel } from "@/models/categories";
import { formatBRL } from "@/lib/format";
import { normalizeBudget } from "./budget";
import { cheapestOffer } from "./trust";
import { categoryShares, partUtility } from "./scoring";
import { isCompatible } from "./compatibility";
import { estimatePerformance } from "./performance";
import { buildPaymentSummary } from "./payments";

/** Ordem em que as categorias são escolhidas (fonte por último: depende do consumo). */
export const PICK_ORDER: Category[] = ["gpu", "cpu", "motherboard", "ram", "ssd", "case", "psu"];
/** Ordem de exibição na tela. */
export const DISPLAY_ORDER: Category[] = ["gpu", "cpu", "motherboard", "ram", "ssd", "psu", "case"];
/** Ganho mínimo de utilidade para uma troca "para cima" valer a pena (10%). */
export const MIN_UPGRADE_GAIN = 1.1;

export type CandidatesByCategory = Record<Category, Candidate[]>;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function emptyCandidates(): CandidatesByCategory {
  return { gpu: [], cpu: [], motherboard: [], ram: [], ssd: [], psu: [], case: [] };
}

/** Candidatos por categoria: produtos com spec e com uma oferta válida (a mais barata). */
export function buildCandidates(
  products: ProductWithOffers[],
  specs: Record<string, PartSpec>,
  trustedOnly: boolean
): CandidatesByCategory {
  const out = emptyCandidates();
  for (const product of products) {
    const spec = specs[product.slug];
    if (!spec) continue;
    const offer = cheapestOffer(product, trustedOnly);
    if (!offer) continue;
    out[spec.category].push({ product, offer, spec, price: offer.price_pix });
  }
  return out;
}

const specsOf = (parts: Candidate[]): PartSpec[] => parts.map((p) => p.spec);
const totalOf = (parts: Candidate[]): number => round2(parts.reduce((s, p) => s + p.price, 0));
const compatible = (parts: Candidate[], c: Candidate): boolean => isCompatible(specsOf(parts), c.spec);
const byPrice = (a: Candidate, b: Candidate) => a.price - b.price || a.spec.slug.localeCompare(b.spec.slug);

/** Diz se ainda dá para completar a montagem com as categorias restantes. */
function canComplete(parts: Candidate[], remaining: Category[], cands: CandidatesByCategory): boolean {
  const acc = [...parts];
  for (const cat of PICK_ORDER.filter((c) => remaining.includes(c))) {
    const opt = [...cands[cat]].sort(byPrice).find((c) => compatible(acc, c));
    if (!opt) return false;
    acc.push(opt);
  }
  return true;
}

/** A montagem compatível mais barata possível (ou null se não existe nenhuma). */
export function cheapestCompatibleBuild(
  cands: CandidatesByCategory
): { parts: BuildPart[]; total: number } | null {
  let best: { parts: Candidate[]; total: number } | null = null;
  const resto: Category[] = ["motherboard", "ram", "ssd", "case", "psu"];

  for (const cpu of cands.cpu) {
    for (const gpu of cands.gpu) {
      const parts: Candidate[] = [gpu, cpu];
      let ok = true;
      for (const cat of resto) {
        const opt = [...cands[cat]].sort(byPrice).find((c) => compatible(parts, c));
        if (!opt) {
          ok = false;
          break;
        }
        parts.push(opt);
      }
      if (!ok) continue;
      const total = totalOf(parts);
      if (!best || total < best.total) best = { parts, total };
    }
  }
  return best ? { parts: toBuildParts(best.parts), total: best.total } : null;
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

const lower = (cat: Category) => categoryLabel(cat).toLowerCase();

/** Passo 3: escolha gulosa por fatias do orçamento alvo. */
function greedyPass(
  cands: CandidatesByCategory,
  utility: Scorer,
  target: number,
  aesthetics: number
): { parts: Candidate[]; notes: string[] } | null {
  const shares = categoryShares(aesthetics);
  const parts: Candidate[] = [];
  const notes: string[] = [];
  let carry = 0;

  for (let i = 0; i < PICK_ORDER.length; i++) {
    const cat = PICK_ORDER[i];
    const remaining = PICK_ORDER.slice(i + 1);
    const allowance = shares[cat] * target + carry;
    const viable = cands[cat].filter((c) => compatible(parts, c) && canComplete([...parts, c], remaining, cands));
    if (viable.length === 0) return null;

    const sorted = sortByUtility(viable, utility);
    let chosen = sorted.find((c) => c.price <= allowance);
    if (!chosen) {
      chosen = [...viable].sort(byPrice)[0];
      notes.push(
        `Nenhuma opção de ${lower(cat)} coube na fatia prevista (${formatBRL(Math.max(0, allowance))}); usamos a compatível mais barata.`
      );
    }
    carry = allowance - chosen.price;
    parts.push(chosen);
  }
  return { parts, notes };
}

/** Passo 4: rebaixa a categoria mais cara até caber no teto. */
function downgradeToCap(parts: Candidate[], cands: CandidatesByCategory, hardCap: number): Candidate[] {
  let current = [...parts];
  for (let iter = 0; iter < 100 && totalOf(current) > hardCap; iter++) {
    const porPreco = [...current].sort((a, b) => b.price - a.price);
    let trocou = false;
    for (const peca of porPreco) {
      const others = current.filter((p) => p !== peca);
      const maisBaratas = cands[peca.spec.category]
        .filter((c) => c.price < peca.price && compatible(others, c))
        .sort((a, b) => b.price - a.price); // a próxima mais barata primeiro
      if (maisBaratas.length > 0) {
        current = [...others, maisBaratas[0]];
        trocou = true;
        break;
      }
    }
    if (!trocou) break;
  }
  return current;
}

/** Passo 5: sobe GPU e depois CPU usando sobras e folga, só com ganho >= 10%. */
function upgradePass(
  parts: Candidate[],
  cands: CandidatesByCategory,
  utility: Scorer,
  hardCap: number
): { parts: Candidate[]; upgrades: { category: Category; from: Candidate; to: Candidate }[] } {
  let current = [...parts];
  const upgrades: { category: Category; from: Candidate; to: Candidate }[] = [];

  for (const cat of ["gpu", "cpu"] as Category[]) {
    const atual = current.find((p) => p.spec.category === cat);
    if (!atual) continue;
    const semPsu = current.filter((p) => p !== atual && p.spec.category !== "psu");
    const psuAtual = current.find((p) => p.spec.category === "psu");
    const minimo = utility(atual) * MIN_UPGRADE_GAIN;

    for (const cand of sortByUtility(cands[cat], utility)) {
      if (utility(cand) < minimo) break; // lista ordenada: daqui para baixo ninguém ganha 10%
      if (cand.spec.slug === atual.spec.slug || !compatible(semPsu, cand)) continue;

      const novas = [...semPsu, cand];
      const psu =
        psuAtual && compatible(novas, psuAtual)
          ? psuAtual
          : [...cands.psu].sort(byPrice).find((c) => compatible(novas, c));
      if (!psu) continue;

      const tentativa = [...novas, psu];
      if (totalOf(tentativa) <= hardCap) {
        upgrades.push({ category: cat, from: atual, to: cand });
        current = tentativa;
        break;
      }
    }
  }
  return { parts: current, upgrades };
}

function fail(reason: string): BuildFailure {
  return { ok: false, reason };
}

/** Monta um PC completo para as preferências dadas. */
export function autoBuild(
  products: ProductWithOffers[],
  specs: Record<string, PartSpec>,
  prefs: BuildPreferences
): BuildResult {
  const budget = normalizeBudget(prefs.budget);
  const cands = buildCandidates(products, specs, prefs.trustedOnly);

  // 1) Toda categoria precisa de ao menos um candidato.
  for (const cat of PICK_ORDER) {
    if (cands[cat].length === 0) {
      const dica = prefs.trustedOnly ? " Desative “Só lojas confiáveis” ou tente mais tarde." : " Tente mais tarde.";
      return fail(`Não há ${lower(cat)} disponível com os filtros atuais.${dica}`);
    }
  }

  // 2) Existe alguma montagem compatível que caiba no teto?
  const cheapest = cheapestCompatibleBuild(cands);
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
  const greedy = greedyPass(cands, utility, budget.target, prefs.aesthetics);
  const notes: string[] = greedy?.notes ?? [];
  let parts: Candidate[] = greedy?.parts ?? cheapest.parts;

  // 4) Garantia do teto.
  if (totalOf(parts) > budget.hardCap) {
    parts = downgradeToCap(parts, cands, budget.hardCap);
    if (totalOf(parts) > budget.hardCap) {
      parts = cheapest.parts;
      notes.push("Para caber no teto, usamos a montagem compatível mais barata.");
    }
  }

  // 5) Sobras e folga: subir GPU/CPU quando vale a pena.
  const totalAntes = totalOf(parts);
  const up = upgradePass(parts, cands, utility, budget.hardCap);
  parts = up.parts;
  const totalPix = totalOf(parts);

  for (const u of up.upgrades) {
    const ganho = Math.round((u.to.spec.perf / u.from.spec.perf - 1) * 100);
    const label = lower(u.category);
    if (totalPix > budget.target) {
      notes.push(
        `Usou ${formatBRL(round2(totalPix - budget.target))} da folga para subir ${label}: ${u.from.product.name} → ${u.to.product.name} (+${ganho}% de desempenho).`
      );
    } else {
      notes.push(`Sobrou dinheiro no alvo e subimos ${label}: ${u.from.product.name} → ${u.to.product.name} (+${ganho}%).`);
    }
  }
  if (up.upgrades.length === 0 && totalAntes > budget.target) {
    notes.push(
      `A montagem ficou ${formatBRL(round2(totalPix - budget.target))} acima do alvo, mas dentro do teto.`
    );
  }

  const buildParts = toBuildParts(parts);
  const payment = buildPaymentSummary(buildParts);

  return {
    ok: true,
    parts: buildParts,
    totalPix,
    totalInstallment: payment.installmentTotal,
    budget,
    usedWiggleRoom: totalPix > budget.target,
    leftover: round2(budget.hardCap - totalPix),
    notes,
    performance: estimatePerformance(buildParts),
    payment,
  };
}
