// Cupons de desconto (V2, pacote E — tarefa E3, opcional). Lógica pura: recebe
// o resumo de pagamento, o código digitado e a lista de cupons conhecidos.
// O desconto vale sobre o preço do Pix (é o preço que o Montador usa).
//
// TODO(V2-E): tabela `coupons` no Supabase + serviço com fallback, campo de
// cupom na tela (PaymentPlanner) e cashback. Hoje não há cupons cadastrados.

import type { PaymentSummary } from "@/models/builder-types";
import { formatBRL } from "@/lib/format";

export type Coupon = {
  /** Código que a pessoa digita (comparado sem diferenciar maiúsculas). */
  code: string;
  /** Loja onde o cupom vale; ausente = vale para a montagem toda. */
  storeId?: string;
  /** Desconto em % (ex.: 10 = 10%). Use este OU `amount`. */
  percent?: number;
  /** Desconto fixo em reais. */
  amount?: number;
  /** Valor mínimo (Pix) na loja/montagem para o cupom valer. */
  minTotal?: number;
  /** Data ISO do último dia de validade (inclusive). */
  expiresAt?: string;
};

export type CouponResult =
  | { ok: true; coupon: Coupon; discount: number; pixTotal: number; message: string }
  | { ok: false; reason: string };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Data AAAA-MM-DD no fuso de Brasília (o formato en-CA já sai assim). */
function dataEmBrasilia(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function applyCoupon(
  summary: PaymentSummary,
  code: string,
  coupons: Coupon[],
  now: Date = new Date()
): CouponResult {
  const alvo = code.trim().toUpperCase();
  const coupon = coupons.find((c) => c.code.trim().toUpperCase() === alvo);
  if (!alvo || !coupon) return { ok: false, reason: "Cupom não encontrado." };

  // Compara só a data (AAAA-MM-DD) no horário de Brasília, para o cupom valer
  // o dia inteiro aqui (em UTC ele venceria às 21h do último dia, LOG-13).
  if (coupon.expiresAt && dataEmBrasilia(now) > coupon.expiresAt.slice(0, 10)) {
    return { ok: false, reason: "Este cupom venceu." };
  }

  let base = summary.pixTotal;
  if (coupon.storeId) {
    const loja = summary.stores.find((s) => s.store.id === coupon.storeId);
    if (!loja) return { ok: false, reason: "Este cupom é de uma loja que não está na sua montagem." };
    base = loja.pixTotal;
  }
  if (coupon.minTotal && base < coupon.minTotal) {
    return { ok: false, reason: `Este cupom vale a partir de ${formatBRL(coupon.minTotal)}.` };
  }

  const bruto = coupon.percent ? (base * coupon.percent) / 100 : (coupon.amount ?? 0);
  // Nunca desconta mais do que a pessoa vai pagar naquela loja.
  const discount = round2(Math.min(Math.max(0, bruto), base));
  return {
    ok: true,
    coupon,
    discount,
    pixTotal: round2(summary.pixTotal - discount),
    message: `Cupom aplicado: ${formatBRL(discount)} de desconto.`,
  };
}
