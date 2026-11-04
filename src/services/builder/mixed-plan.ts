// Mistura Pix + parcelado (V2, pacote E). A pessoa diz quanto tem à vista e
// quanto cabe por mês; sugerimos quais peças pagar no Pix e em quantas vezes
// parcelar o resto.
//
// Regra (simples de explicar):
// 1. Paga no Pix as peças mais caras primeiro, enquanto o dinheiro à vista der.
//    Se uma peça cara não cabe, tenta as mais baratas (aproveita o que sobra).
//    Peça cara no Pix é o que mais economiza, porque o desconto é proporcional.
// 2. O resto vai para o cartão no MENOR número de parcelas cuja parcela cabe no
//    "cabe por mês" (menos meses = menos juros e menos tempo endividado),
//    respeitando o máximo e a tabela de juros de cada loja.
// TODO(V2-E): escolher a combinação ótima de peças (hoje é gulosa) e considerar
// cupons/cashback na conta.

import type { BuildPart, InstallmentRate } from "@/models/builder-types";
import { formatBRL } from "@/lib/format";
import { buildPaymentSummary, installmentPlan } from "./payments";

export type MixedPlan = {
  /** Peças pagas no Pix (mais caras primeiro). */
  pixItems: BuildPart[];
  /** Peças parceladas no cartão (mais caras primeiro). */
  installmentItems: BuildPart[];
  /** Soma do Pix das peças pagas à vista. */
  pixTotal: number;
  /** Número de parcelas do que vai para o cartão (0 se nada for parcelado). */
  months: number;
  /** Valor das primeiras parcelas (0 se nada for parcelado). */
  monthly: number;
  /** Total pago no cartão, já com juros. */
  installmentTotal: number;
  /** true quando a parcela cabe no "cabe por mês". */
  fits: boolean;
  /** Explicações em linguagem simples para a tela. */
  notes: string[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Valor digitado inválido ou negativo vira zero. */
function naoNegativo(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function mixedPlan(
  parts: BuildPart[],
  input: { cash: number; monthly: number },
  tables?: Record<string, InstallmentRate[]>
): MixedPlan {
  const cash = naoNegativo(input.cash);
  const cabePorMes = naoNegativo(input.monthly);
  const notes: string[] = [];

  // 1) Pix: mais caras primeiro, enquanto o dinheiro à vista der.
  const ordenadas = [...parts].sort((a, b) => b.offer.price_pix - a.offer.price_pix);
  const pixItems: BuildPart[] = [];
  const installmentItems: BuildPart[] = [];
  let pixTotal = 0;
  for (const p of ordenadas) {
    if (round2(pixTotal + p.offer.price_pix) <= cash) {
      pixItems.push(p);
      pixTotal = round2(pixTotal + p.offer.price_pix);
    } else {
      installmentItems.push(p);
    }
  }

  if (installmentItems.length === 0) {
    if (parts.length > 0) {
      notes.push(`Tudo cabe no Pix: ${formatBRL(pixTotal)} à vista, sem parcelas.`);
      const sobra = round2(cash - pixTotal);
      if (sobra > 0) notes.push(`Ainda sobram ${formatBRL(sobra)} do seu dinheiro à vista.`);
    }
    return { pixItems, installmentItems, pixTotal, months: 0, monthly: 0, installmentTotal: 0, fits: true, notes };
  }

  // 2) Cartão: menor número de parcelas cuja parcela cabe por mês.
  const resumo = buildPaymentSummary(installmentItems, tables);
  const maximo = Math.max(1, resumo.maxInstallments);
  let plano = installmentPlan(resumo, maximo);
  let fits = false;
  for (let n = 1; n <= maximo; n++) {
    const tentativa = installmentPlan(resumo, n);
    if (tentativa.monthly <= cabePorMes) {
      plano = tentativa;
      fits = true;
      break;
    }
  }

  const pixDoParcelado = resumo.pixTotal;
  if (pixItems.length > 0) {
    notes.push(
      `Pague ${formatBRL(pixTotal)} no Pix (${pixItems.length} ${pixItems.length === 1 ? "peça" : "peças"}) e parcele o resto em ${plano.count}x de ${formatBRL(plano.monthly)}.`
    );
  } else {
    notes.push(`Tudo no cartão: ${plano.count}x de ${formatBRL(plano.monthly)}.`);
  }
  const acrescimo = round2(plano.total - pixDoParcelado);
  if (acrescimo > 0) {
    notes.push(`O parcelado tem acréscimo de ${formatBRL(acrescimo)} em relação a pagar essas peças no Pix.`);
  } else {
    notes.push("O parcelamento sai sem juros: mesmo preço do Pix.");
  }
  if (resumo.stores.length > 1 && resumo.stores.some((s) => s.installmentCount < plano.count)) {
    notes.push("Uma das lojas parcela em menos vezes; as últimas parcelas ficam menores.");
  }
  if (!fits) {
    notes.push(`Falta ${formatBRL(round2(plano.monthly - cabePorMes))} por mês para caber no seu orçamento.`);
  }

  return {
    pixItems,
    installmentItems,
    pixTotal,
    months: plano.count,
    monthly: plano.monthly,
    installmentTotal: plano.total,
    fits,
    notes,
  };
}
