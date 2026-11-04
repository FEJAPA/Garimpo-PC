// Plano de pagamento da montagem: Pix (à vista) × parcelado, por loja. Spec §7.
//
// V1 (sem tabela de juros): o preço parcelado informado pela loja vale para
// qualquer número de parcelas até o máximo que ela oferece (parcela = total / n).
//
// V2 (pacote E): quando a loja tem tabela de juros (`InstallmentRate[]`), o
// total em n parcelas é `pixTotal × fator(n)`, e a loja parcela até o maior
// número da tabela. Cada loja é um pagamento separado: se você escolhe 12x e uma
// loja só parcela em 6x, ela fica em 6x e as outras seguem até 12x.
// A mistura Pix + parcelado fica em mixed-plan.ts.
// TODO(V2-E): cupons e cashback por loja (ver coupons.ts).

import type {
  BuildPart,
  InstallmentPlan,
  InstallmentRate,
  PaymentSummary,
  StorePayment,
} from "@/models/builder-types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Normaliza o número de parcelas pedido: inteiro, no mínimo 1. */
function parcelasPedidas(count: number): number {
  return Math.max(1, Math.floor(count) || 1);
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

/** Até quantas parcelas sai pelo preço do Pix (fator ≤ 1). 0 = nunca é sem juros. */
export function interestFreeUpTo(table: InstallmentRate[]): number {
  let ate = 0;
  for (const r of [...table].sort((a, b) => a.count - b.count)) {
    if (r.factor > 1) break;
    ate = r.count;
  }
  return ate;
}

/** Máximo de parcelas de uma loja: o da tabela, se houver; senão o das ofertas. */
function maximoDaLoja(loja: StorePayment): number {
  const tabela = loja.interestTable;
  if (tabela && tabela.length > 0) return Math.max(...tabela.map((r) => r.count));
  return Math.max(1, loja.installmentCount);
}

/**
 * Plano de uma loja só em `count` parcelas, limitado ao máximo dela.
 * Com tabela: total = pixTotal × fator. Sem tabela (V1): total = installmentTotal.
 */
export function storeInstallment(store: StorePayment, count: number): InstallmentPlan {
  const n = Math.min(parcelasPedidas(count), maximoDaLoja(store));
  const tabela = store.interestTable;
  const total =
    tabela && tabela.length > 0 ? round2(store.pixTotal * rateFor(tabela, n)) : store.installmentTotal;
  return { count: n, monthly: round2(total / n), total };
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
    const parcelado = offer.price_installment ?? offer.price_pix;
    const parcelas = offer.price_installment !== null && offer.installment_count ? offer.installment_count : 1;

    const atual = porLoja.get(offer.store.id) ?? {
      store: offer.store,
      items: 0,
      pixTotal: 0,
      installmentTotal: 0,
      installmentCount: Number.POSITIVE_INFINITY,
    };
    atual.items += 1;
    atual.pixTotal = round2(atual.pixTotal + offer.price_pix);
    atual.installmentTotal = round2(atual.installmentTotal + parcelado);
    // Na mesma loja, o carrinho inteiro respeita o menor máximo entre os itens.
    atual.installmentCount = Math.min(atual.installmentCount, parcelas);
    porLoja.set(offer.store.id, atual);
  }

  // Lojas com tabela de juros: a tabela manda. O máximo de parcelas passa a ser
  // o maior da tabela, e o "total parcelado" é o preço nesse máximo.
  let algumaTabela = false;
  for (const loja of porLoja.values()) {
    const tabela = tables?.[loja.store.id];
    if (!tabela || tabela.length === 0) continue;
    algumaTabela = true;
    loja.interestTable = [...tabela].sort((a, b) => a.count - b.count);
    const maximo = maximoDaLoja(loja);
    loja.installmentCount = maximo;
    loja.installmentTotal = round2(loja.pixTotal * rateFor(loja.interestTable, maximo));
  }

  const stores = [...porLoja.values()].sort((a, b) => b.pixTotal - a.pixTotal);
  const pixTotal = round2(stores.reduce((s, l) => s + l.pixTotal, 0));
  const installmentTotal = round2(stores.reduce((s, l) => s + l.installmentTotal, 0));
  // V1: o carrinho todo segue a loja que parcela em menos vezes.
  // V2 (com tabela): cada loja limita a sua, então o máximo geral é o MAIOR.
  const maxInstallments = stores.length
    ? algumaTabela
      ? Math.max(...stores.map(maximoDaLoja))
      : Math.min(...stores.map((l) => l.installmentCount))
    : 1;

  return {
    pixTotal,
    installmentTotal,
    maxInstallments,
    pixSavings: round2(installmentTotal - pixTotal),
    stores,
  };
}

/**
 * Plano em `count` parcelas, limitado a [1, maxInstallments].
 * Sem tabela de juros: V1 (installmentTotal / n).
 * Com tabela: soma o plano de cada loja; `monthly` é o valor das primeiras
 * parcelas (quando uma loja termina antes, as últimas ficam menores).
 */
export function installmentPlan(summary: PaymentSummary, count: number): InstallmentPlan {
  const n = Math.min(parcelasPedidas(count), Math.max(1, summary.maxInstallments));
  const comTabela = summary.stores.some((s) => s.interestTable && s.interestTable.length > 0);

  if (!comTabela) {
    return {
      count: n,
      monthly: round2(summary.installmentTotal / n),
      total: summary.installmentTotal,
    };
  }

  const porLoja = summary.stores.map((s) => storeInstallment(s, n));
  return {
    count: n,
    monthly: round2(porLoja.reduce((s, p) => s + p.monthly, 0)),
    total: round2(porLoja.reduce((s, p) => s + p.total, 0)),
  };
}
