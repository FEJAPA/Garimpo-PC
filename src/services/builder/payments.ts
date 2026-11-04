// Plano de pagamento da montagem: Pix (à vista) × parcelado, por loja. Spec §7.
//
// Premissa de dinheiro (item 2 do Portão 1): no Brasil, "10x sem juros" vale
// sobre o PREÇO A PRAZO, que já é maior que o Pix (o desconto do Pix só existe
// no Pix). Por isso:
//
// - Preço a prazo da loja = soma dos `price_installment` das ofertas (oferta sem
//   preço parcelado válido entra pelo preço do Pix e não parcela). Preço a prazo
//   abaixo do Pix é dado ruim: vale o Pix (S-06), para o cartão nunca parecer
//   mais barato que o Pix.
// - V1 (sem tabela de juros): o preço a prazo vale para qualquer número de
//   parcelas até o máximo que a loja oferece.
// - V2 (pacote E, com tabela `InstallmentRate[]`):
//   - até o número de parcelas que as ofertas da loja ANUNCIAM (o menor entre
//     elas, `offersInstallmentCount`), vale o preço a prazo anunciado (S-03): se
//     a peça diz "ou 10x de R$ 195", a loja cobra isso em 10x;
//   - acima disso, total em n parcelas = max(preço a prazo, pixTotal × fator(n)).
//     A tabela só pode ENCARECER o parcelado, nunca baratear abaixo do preço a
//     prazo;
//   - a loja parcela até o maior número da tabela.
// - Cada loja é um pagamento separado e limita só as parcelas dela (S-04): se
//   você escolhe 12x e uma loja só parcela em 6x (ou só aceita Pix), ela fica em
//   6x (ou 1x) e as outras seguem até 12x. Por isso o plano tem FAIXAS (ex.:
//   "6x de R$ 195 + 6x de R$ 140").
// - Centavos: o resto da divisão vai na 1ª parcela de cada loja, para a soma
//   das parcelas fechar exatamente o total.
//
// A mistura Pix + parcelado fica em mixed-plan.ts.
// TODO(V2-E): cupons e cashback por loja (ver coupons.ts).

import type {
  BuildPart,
  InstallmentPlan,
  InstallmentRate,
  PaymentSummary,
  StorePayment,
} from "@/models/builder-types";
import type { Offer } from "@/models/types";
import { formatBRL } from "@/lib/format";

/** Teto de parcelas aceito ao ler ofertas e tabelas (LOG-12): dado absurdo não trava a tela. */
export const MAX_INSTALLMENTS = 24;

/** Uma faixa do plano: `count` parcelas de `monthly` reais. */
export type ScheduleBand = { count: number; monthly: number };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function centavos(n: number): number {
  return Math.round(n * 100);
}

/** Normaliza o número de parcelas pedido: inteiro, no mínimo 1. */
function parcelasPedidas(count: number): number {
  return Math.max(1, Math.floor(count) || 1);
}

/**
 * Preço parcelado válido da oferta (LOG-10): número finito e maior que zero.
 * Zero, negativo, NaN ou Infinity é dado ruim e conta como "não parcela".
 */
export function validInstallmentPrice(offer: Pick<Offer, "price_installment">): number | null {
  const v = offer.price_installment;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Preço a prazo usado nas contas (S-06): o anunciado, mas nunca abaixo do Pix.
 * Sem preço parcelado válido, é o próprio Pix.
 */
function precoAPrazo(offer: Pick<Offer, "price_pix" | "price_installment">): number {
  return Math.max(offer.price_pix, validInstallmentPrice(offer) ?? offer.price_pix);
}

/** Parcelas que a oferta anuncia, entre 1 e 24 (LOG-12). Sem preço parcelado válido = 1. */
function parcelasDaOferta(offer: Pick<Offer, "price_installment" | "installment_count">): number {
  if (validInstallmentPrice(offer) === null) return 1;
  const n = Math.floor(Number(offer.installment_count));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_INSTALLMENTS);
}

/** Só faixas com sentido: parcelas entre 1 e 24 e fator finito ≥ 1. Ordenadas por parcelas. */
function tabelaValida(table: InstallmentRate[] | undefined): InstallmentRate[] {
  if (!table) return [];
  return table
    .filter(
      (r) =>
        Number.isFinite(r.count) &&
        r.count >= 1 &&
        r.count <= MAX_INSTALLMENTS &&
        Number.isFinite(r.factor) &&
        r.factor >= 1
    )
    .map((r) => ({ count: Math.floor(r.count), factor: r.factor }))
    .sort((a, b) => a.count - b.count);
}

/**
 * Fator de juros para `n` parcelas: o da menor faixa que cobre `n`.
 * Entre faixas usa a de cima (a mais cara), para nunca prometer menos do que a
 * loja cobra. Acima da maior faixa, usa a maior (a loja não parcela além dela).
 * Tabela vazia = sem juros conhecidos (fator 1).
 */
export function rateFor(table: InstallmentRate[], n: number): number {
  if (table.length === 0) return 1;
  const ordenada = [...table].sort((a, b) => a.count - b.count);
  const faixa = ordenada.find((r) => r.count >= n) ?? ordenada[ordenada.length - 1];
  return faixa.factor;
}

/**
 * Até quantas parcelas o FATOR da tabela é 1 (0 = nunca). Olha só a tabela; para
 * saber até quando a loja cobra só o preço a prazo, use `storeNoExtraUpTo`.
 */
export function interestFreeUpTo(table: InstallmentRate[]): number {
  let ate = 0;
  for (const r of [...table].sort((a, b) => a.count - b.count)) {
    if (r.factor > 1) break;
    ate = r.count;
  }
  return ate;
}

function temTabela(loja: StorePayment): loja is StorePayment & { interestTable: InstallmentRate[] } {
  return !!loja.interestTable && loja.interestTable.length > 0;
}

/** Máximo de parcelas de uma loja: o da tabela, se houver; senão o das ofertas. */
function maximoDaLoja(loja: StorePayment): number {
  if (temTabela(loja)) return Math.min(MAX_INSTALLMENTS, Math.max(...loja.interestTable.map((r) => r.count)));
  return Math.min(MAX_INSTALLMENTS, Math.max(1, loja.installmentCount));
}

/**
 * Total da loja em `n` parcelas (n já limitado ao máximo dela).
 * Até o que as ofertas anunciam vale o preço a prazo delas (S-03); acima, a
 * tabela decide, sem nunca ficar abaixo do preço a prazo.
 */
function totalDaLoja(loja: StorePayment, n: number): number {
  if (!temTabela(loja)) return loja.installmentTotal;
  if (n <= (loja.offersInstallmentCount ?? 0)) return loja.installmentTotal;
  return round2(Math.max(loja.installmentTotal, loja.pixTotal * rateFor(loja.interestTable, n)));
}

/** Parcela "cheia" e resto (em centavos) de `total` dividido em `n`. */
function dividir(total: number, n: number): { base: number; resto: number } {
  const c = centavos(total);
  const base = Math.floor(c / n);
  return { base, resto: c - base * n };
}

/** Junta meses iguais (em centavos) em faixas. */
function emFaixas(meses: number[]): ScheduleBand[] {
  const faixas: ScheduleBand[] = [];
  for (const c of meses) {
    const ultima = faixas[faixas.length - 1];
    if (ultima && centavos(ultima.monthly) === c) ultima.count += 1;
    else faixas.push({ count: 1, monthly: c / 100 });
  }
  return faixas;
}

/** Plano de várias lojas, cada uma no seu número de parcelas, em `n` meses. */
function montarPlano(lojas: { count: number; total: number }[], n: number) {
  const nominal = Array.from({ length: n }, () => 0);
  let resto = 0;
  for (const l of lojas) {
    const d = dividir(l.total, l.count);
    resto += d.resto;
    for (let m = 0; m < l.count && m < n; m++) nominal[m] += d.base;
  }
  const exato = [...nominal];
  if (n > 0) exato[0] += resto;
  return {
    total: round2(lojas.reduce((s, l) => s + l.total, 0)),
    schedule: emFaixas(exato),
    faixas: emFaixas(nominal),
    arredondamento: resto / 100,
  };
}

/**
 * Plano de uma loja só em `count` parcelas, limitado ao máximo dela.
 * `monthly` é a 1ª parcela (com o resto dos centavos); `schedule` fecha o total.
 */
export function storeInstallment(store: StorePayment, count: number): InstallmentPlan {
  const n = Math.min(parcelasPedidas(count), maximoDaLoja(store));
  const plano = montarPlano([{ count: n, total: totalDaLoja(store, n) }], n);
  return { count: n, monthly: plano.schedule[0]?.monthly ?? 0, total: plano.total, schedule: plano.schedule };
}

/** Até quantas parcelas a loja cobra só o preço a prazo das ofertas (0 = acréscimo já em 1x). */
export function storeNoExtraUpTo(store: StorePayment): number {
  let ate = 0;
  for (let n = 1; n <= maximoDaLoja(store); n++) {
    if (centavos(totalDaLoja(store, n)) <= centavos(store.installmentTotal)) ate = n;
  }
  return ate;
}

/** Número de parcelas efetivo para o resumo: limitado a [1, maxInstallments]. */
function parcelasDoResumo(summary: PaymentSummary, count: number): number {
  return Math.min(parcelasPedidas(count), Math.max(1, Math.min(MAX_INSTALLMENTS, summary.maxInstallments)));
}

function planoDoResumo(summary: PaymentSummary, count: number) {
  const n = parcelasDoResumo(summary, count);
  const lojas = summary.stores.map((s) => {
    const c = Math.min(n, maximoDaLoja(s));
    return { count: c, total: totalDaLoja(s, c) };
  });
  return { n, ...montarPlano(lojas, n) };
}

/**
 * Plano em `count` parcelas, limitado a [1, maxInstallments]. Soma o plano de
 * cada loja. `schedule` traz as faixas reais (Σ count × monthly = total) e
 * `monthly` é a 1ª parcela (a maior: todas as lojas ainda pagando + centavos).
 */
export function installmentPlan(summary: PaymentSummary, count: number): InstallmentPlan {
  const p = planoDoResumo(summary, count);
  return { count: p.n, monthly: p.schedule[0]?.monthly ?? 0, total: p.total, schedule: p.schedule };
}

/**
 * Faixas para a manchete da tela: sem o resto dos centavos (que vai à parte em
 * `arredondamento`, somado à 1ª parcela). Ex.: "10x de R$ 586,17 + 2x de R$ 551,49".
 */
export function installmentBands(
  summary: PaymentSummary,
  count: number
): { faixas: ScheduleBand[]; arredondamento: number } {
  const p = planoDoResumo(summary, count);
  return { faixas: p.faixas, arredondamento: p.arredondamento };
}

/** "10x de R$ 586,17 + 2x de R$ 551,49". */
export function formatSchedule(faixas: ScheduleBand[]): string {
  return faixas.map((f) => `${f.count}x de ${formatBRL(f.monthly)}`).join(" + ");
}

export type InstallmentOption = {
  count: number;
  /** 1ª parcela. */
  monthly: number;
  total: number;
  /** Quanto custa a mais que o preço a prazo das ofertas (0 = sem acréscimo). */
  extra: number;
};

/** Opções do seletor de parcelas, de 1x ao máximo, com o acréscimo de cada uma. */
export function installmentOptions(summary: PaymentSummary): InstallmentOption[] {
  const maximo = parcelasDoResumo(summary, Number.MAX_SAFE_INTEGER);
  return Array.from({ length: maximo }, (_, i) => {
    const p = installmentPlan(summary, i + 1);
    return {
      count: p.count,
      monthly: p.monthly,
      total: p.total,
      extra: Math.max(0, round2(p.total - summary.installmentTotal)),
    };
  });
}

/**
 * Onde o seletor abre: no maior número de parcelas sem acréscimo. Se todas têm
 * acréscimo, no parcelado mais barato (S-05), e não no máximo, que costuma ser
 * o mais caro.
 */
export function defaultInstallmentCount(summary: PaymentSummary): number {
  const opcoes = installmentOptions(summary);
  const semAcrescimo = opcoes.filter((o) => o.extra === 0);
  if (semAcrescimo.length > 0) return semAcrescimo[semAcrescimo.length - 1].count;
  return summary.bestInstallment?.count ?? opcoes[opcoes.length - 1]?.count ?? 1;
}

/** Tabelas de juros por id de loja, remontadas a partir do resumo (para o modo Misturar, a lista e o CSV). */
export function interestTablesOf(summary: PaymentSummary): Record<string, InstallmentRate[]> {
  const tabelas: Record<string, InstallmentRate[]> = {};
  for (const s of summary.stores) if (s.interestTable && s.interestTable.length > 0) tabelas[s.store.id] = s.interestTable;
  return tabelas;
}

/**
 * O parcelado que UMA oferta anuncia, para "ou 10x de R$ 209,99" (F-12/F-13).
 * É a mesma conta de "Como pagar" para essa oferta sozinha, para a lista de
 * peças, a página da peça e o CSV nunca dizerem outra coisa:
 * - sem preço a prazo válido: null (só à vista);
 * - parcelas: as anunciadas, entre 1 e 24; sem número informado, 1x;
 * - com tabela de juros da loja: no máximo o maior número da tabela;
 * - total: o preço a prazo, nunca abaixo do Pix (S-06);
 * - `monthly`: a parcela "cheia", sem o resto dos centavos (que a loja soma na 1ª).
 */
export function offerInstallment(
  offer: Pick<Offer, "price_pix" | "price_installment" | "installment_count">,
  table?: InstallmentRate[]
): { count: number; monthly: number; total: number } | null {
  if (validInstallmentPrice(offer) === null) return null;
  const tabela = tabelaValida(table);
  const maximo = tabela.length > 0 ? tabela[tabela.length - 1].count : MAX_INSTALLMENTS;
  const count = Math.min(parcelasDaOferta(offer), maximo);
  const total = round2(precoAPrazo(offer));
  return { count, monthly: dividir(total, count).base / 100, total };
}

/**
 * Resumo de pagamento de uma lista de peças escolhidas.
 * `tables` (opcional, V2-E): tabela de juros por id de loja. Sem ela, V1.
 */
export function buildPaymentSummary(
  parts: BuildPart[],
  tables?: Record<string, InstallmentRate[]>
): PaymentSummary {
  const porLoja = new Map<string, StorePayment>();

  for (const part of parts) {
    const { offer } = part;
    const parcelas = parcelasDaOferta(offer);
    // Oferta só com preço do Pix não anuncia parcelas (0): numa loja com tabela,
    // a tabela vale desde 1x para o carrinho dessa loja.
    const anunciadas = validInstallmentPrice(offer) === null ? 0 : parcelas;

    const atual = porLoja.get(offer.store.id) ?? {
      store: offer.store,
      items: 0,
      pixTotal: 0,
      installmentTotal: 0,
      installmentCount: Number.POSITIVE_INFINITY,
      offersInstallmentCount: Number.POSITIVE_INFINITY,
    };
    atual.items += 1;
    atual.pixTotal = round2(atual.pixTotal + offer.price_pix);
    atual.installmentTotal = round2(atual.installmentTotal + precoAPrazo(offer));
    // Na mesma loja, o carrinho inteiro respeita o menor máximo entre os itens.
    atual.installmentCount = Math.min(atual.installmentCount, parcelas);
    atual.offersInstallmentCount = Math.min(atual.offersInstallmentCount ?? 0, anunciadas);
    porLoja.set(offer.store.id, atual);
  }

  // Lojas com tabela de juros: a tabela manda no máximo de parcelas. O preço a
  // prazo (installmentTotal) continua o das ofertas: é o piso do parcelado.
  for (const loja of porLoja.values()) {
    const tabela = tabelaValida(tables?.[loja.store.id]);
    if (tabela.length === 0) continue;
    loja.interestTable = tabela;
    loja.installmentCount = maximoDaLoja(loja);
  }

  const stores = [...porLoja.values()].sort((a, b) => b.pixTotal - a.pixTotal);
  const pixTotal = round2(stores.reduce((s, l) => s + l.pixTotal, 0));
  const installmentTotal = round2(stores.reduce((s, l) => s + l.installmentTotal, 0));
  // S-04: cada loja limita só as parcelas dela (as faixas cuidam de quem termina
  // antes), então o máximo geral é o MAIOR entre as lojas, com ou sem tabela.
  // Uma loja só no Pix não derruba mais o carrinho inteiro para 1x.
  const maxInstallments = stores.length ? Math.max(...stores.map(maximoDaLoja)) : 1;

  const resumo: PaymentSummary = { pixTotal, installmentTotal, maxInstallments, pixSavings: 0, stores };

  // R-04: a economia do Pix é contra o parcelado MAIS BARATO com mais de 1
  // parcela (empate: o maior n, que é o mais confortável pelo mesmo preço).
  // Se ninguém parcela, compara com o cartão em 1x.
  const opcoes = installmentOptions(resumo);
  const candidatas = opcoes.length > 1 ? opcoes.slice(1) : opcoes;
  const melhor = candidatas.reduce((a, b) => (centavos(b.total) <= centavos(a.total) ? b : a));
  resumo.bestInstallment = { count: melhor.count, total: melhor.total };
  // Com o preço a prazo nunca abaixo do Pix (S-06), isto já é ≥ 0; o max é a garantia.
  resumo.pixSavings = Math.max(0, round2(melhor.total - pixTotal));
  return resumo;
}
