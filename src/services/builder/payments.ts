// Plano de pagamento da montagem: Pix (à vista) × parcelado, por loja. Spec §7.
//
// Premissa V1: o preço parcelado informado pela loja vale para qualquer número
// de parcelas até o máximo que ela oferece (parcela = total / n).
// TODO(V2-E): tabela de juros por loja e por número de parcelas; parcelar só
// algumas peças e pagar o resto no Pix; entrada "quanto cabe por mês" para
// sugerir a mistura; cupons e cashback.

import type { BuildPart, InstallmentPlan, PaymentSummary, StorePayment } from "@/models/builder-types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Resumo de pagamento de uma lista de peças escolhidas. */
export function buildPaymentSummary(parts: BuildPart[]): PaymentSummary {
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

  const stores = [...porLoja.values()].sort((a, b) => b.pixTotal - a.pixTotal);
  const pixTotal = round2(stores.reduce((s, l) => s + l.pixTotal, 0));
  const installmentTotal = round2(stores.reduce((s, l) => s + l.installmentTotal, 0));
  const maxInstallments = stores.length ? Math.min(...stores.map((l) => l.installmentCount)) : 1;

  return {
    pixTotal,
    installmentTotal,
    maxInstallments,
    pixSavings: round2(installmentTotal - pixTotal),
    stores,
  };
}

/** Plano em `count` parcelas, limitado a [1, maxInstallments]. */
export function installmentPlan(summary: PaymentSummary, count: number): InstallmentPlan {
  const n = Math.min(Math.max(1, Math.floor(count) || 1), Math.max(1, summary.maxInstallments));
  return {
    count: n,
    monthly: round2(summary.installmentTotal / n),
    total: summary.installmentTotal,
  };
}
