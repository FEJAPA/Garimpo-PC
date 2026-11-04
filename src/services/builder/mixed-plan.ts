// Mistura Pix + parcelado (V2, pacote E). A pessoa diz quanto tem à vista e
// quanto cabe por mês; sugerimos quais peças pagar no Pix e em quantas vezes
// parcelar o resto.
//
// Regra (simples de explicar):
// 1. O dinheiro à vista vai primeiro para as peças que MAIS ENCARECEM no cartão
//    (R-06): custo evitado = total da peça no cartão, no máximo de parcelas da
//    loja − Pix. O total no cartão sai da MESMA conta de "Como pagar"
//    (payments.ts): até o que a oferta anuncia vale o preço a prazo dela (S-03);
//    acima disso, max(preço a prazo, Pix × fator); e nunca abaixo do Pix (S-06).
//    Empate: a peça mais cara primeiro. Se uma peça não cabe, tenta as próximas
//    (aproveita o que sobra).
//    Por que não só "a mais cara": uma peça de loja com +15% no cartão custa
//    mais para parcelar do que uma peça mais cara de loja sem juros.
// 2. O resto vai para o cartão no MENOR número de parcelas cuja 1ª parcela (a
//    maior) cabe no "cabe por mês" (menos meses = menos juros e menos tempo
//    endividado), respeitando o máximo e a tabela de juros de cada loja.
// 3. Só calculamos com os DOIS valores preenchidos (F-11, ver mixedPlanPrompt):
//    "cabe por mês" vazio não vira "sem limite" nem "zero", para não adivinhar.
// TODO(V2-E): escolher a combinação ótima de peças (hoje é gulosa) e considerar
// cupons/cashback na conta.

import type { BuildPart, InstallmentRate } from "@/models/builder-types";
import { formatBRL } from "@/lib/format";
import {
  buildPaymentSummary,
  formatSchedule,
  installmentBands,
  installmentPlan,
  type ScheduleBand,
} from "./payments";

export type MixedPlan = {
  /** Peças pagas no Pix (as que mais encarecem no cartão primeiro). */
  pixItems: BuildPart[];
  /** Peças parceladas no cartão. */
  installmentItems: BuildPart[];
  /** Soma do Pix das peças pagas à vista. */
  pixTotal: number;
  /** Número de parcelas do que vai para o cartão (0 se nada for parcelado). */
  months: number;
  /** Valor da 1ª parcela, a maior (0 se nada for parcelado). */
  monthly: number;
  /** Faixas para a tela, sem o arredondamento (ex.: 10x de 300 + 2x de 120). */
  schedule: ScheduleBand[];
  /** Centavos de arredondamento somados à 1ª parcela. */
  rounding: number;
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

/** Quanto a peça encarece se for sozinha para o cartão, no máximo de parcelas da loja. */
function custoEvitado(p: BuildPart, tables?: Record<string, InstallmentRate[]>): number {
  const sozinha = buildPaymentSummary([p], tables);
  const noCartao = installmentPlan(sozinha, sozinha.maxInstallments).total;
  return Math.max(0, round2(noCartao - p.offer.price_pix));
}

/**
 * O que falta preencher no modo Misturar (F-11), ou null se dá para calcular.
 * Os dois campos são obrigatórios; 0 é um valor válido ("não tenho nada à vista").
 */
export function mixedPlanPrompt(cashText: string, monthlyText: string): string | null {
  const temAVista = cashText.trim() !== "";
  const temPorMes = monthlyText.trim() !== "";
  if (temAVista && temPorMes) return null;
  if (temAVista) return "Preencha também quanto cabe por mês (pode ser 0).";
  if (temPorMes) return "Preencha também quanto você tem à vista (pode ser 0).";
  return "Diga quanto você tem à vista e quanto cabe por mês para ver a melhor divisão.";
}

export function mixedPlan(
  parts: BuildPart[],
  input: { cash: number; monthly: number },
  tables?: Record<string, InstallmentRate[]>
): MixedPlan {
  const cash = naoNegativo(input.cash);
  const cabePorMes = naoNegativo(input.monthly);
  const notes: string[] = [];

  // 1) Pix: as que mais encarecem no cartão primeiro, enquanto o dinheiro der.
  const ordenadas = parts
    .map((p) => ({ p, custo: custoEvitado(p, tables) }))
    .sort((a, b) => b.custo - a.custo || b.p.offer.price_pix - a.p.offer.price_pix)
    .map((x) => x.p);
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
    return {
      pixItems,
      installmentItems,
      pixTotal,
      months: 0,
      monthly: 0,
      schedule: [],
      rounding: 0,
      installmentTotal: 0,
      fits: true,
      notes,
    };
  }

  // 2) Cartão: menor número de parcelas cuja 1ª parcela cabe por mês.
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
  const { faixas, arredondamento } = installmentBands(resumo, plano.count);
  const textoParcelas = formatSchedule(faixas);

  if (pixItems.length > 0) {
    notes.push(
      `Pague ${formatBRL(pixTotal)} no Pix (${pixItems.length} ${pixItems.length === 1 ? "peça" : "peças"}) e parcele o resto em ${textoParcelas}.`
    );
  } else {
    notes.push(`Tudo no cartão: ${textoParcelas}.`);
  }
  if (arredondamento > 0) {
    notes.push(`A 1ª parcela fica ${formatBRL(arredondamento)} maior por causa do arredondamento dos centavos.`);
  }
  const aMaisQuePix = round2(plano.total - resumo.pixTotal);
  const acimaDoPrazo = round2(plano.total - resumo.installmentTotal);
  if (aMaisQuePix > 0) {
    notes.push(`No cartão essas peças custam ${formatBRL(aMaisQuePix)} a mais do que no Pix.`);
  } else {
    notes.push("O parcelamento sai pelo mesmo preço do Pix.");
  }
  if (acimaDoPrazo > 0) {
    notes.push(`Desse valor, ${formatBRL(acimaDoPrazo)} é acréscimo da loja acima do preço a prazo anunciado.`);
  }
  if (faixas.length > 1) {
    notes.push("Uma das lojas parcela em menos vezes; por isso as últimas parcelas ficam menores.");
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
    schedule: faixas,
    rounding: arredondamento,
    installmentTotal: plano.total,
    fits,
    notes,
  };
}
