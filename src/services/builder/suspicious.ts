// "Preço bom demais": oferta muito abaixo do que as lojas confiáveis cobram
// costuma ser golpe (loja falsa, produto que nunca chega). V2, pacote C3.
//
// TODO(V2-C): considerar também o histórico de preços da peça, não só as
// ofertas de hoje.

import type { ProductWithOffers } from "@/models/types";
import { formatBRL } from "@/lib/currency";
import { isTrustedStore, validOffers } from "./trust";

/** A partir de quanto abaixo da mediana confiável (fração) a oferta é suspeita. */
export const SUSPICIOUS_DISCOUNT = 0.25;

/** Margem para erros de arredondamento de ponto flutuante no limite exato. */
const EPSILON = 1e-9;

export type SuspiciousFlag = { reason: string };

/** Mediana de uma lista não vazia de números. */
function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 1 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

/**
 * Diz se `price` é "bom demais": 25% ou mais abaixo da mediana dos preços das
 * lojas confiáveis. Sem nenhum preço confiável válido, não há com o que
 * comparar e devolve null.
 */
export function suspiciousPrice(price: number, trustedPrices: number[]): SuspiciousFlag | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  const validos = trustedPrices.filter((p) => Number.isFinite(p) && p > 0);
  if (validos.length === 0) return null;

  const referencia = mediana(validos);
  const limite = referencia * (1 - SUSPICIOUS_DISCOUNT);
  if (price > limite + EPSILON) return null;

  const pct = Math.round((1 - price / referencia) * 100);
  return {
    reason: `${pct}% abaixo da mediana das lojas confiáveis (${formatBRL(referencia)}): confira se a loja existe mesmo antes de pagar`,
  };
}

/**
 * Marca as ofertas suspeitas de uma peça (id da oferta → motivo). Só olha
 * ofertas em estoque com preço válido e de loja não bloqueada (`validOffers`);
 * lojas confiáveis nunca são marcadas.
 */
export function flagSuspiciousOffers(product: ProductWithOffers): Map<string, SuspiciousFlag> {
  const ofertas = validOffers(product, false);
  const precosConfiaveis = ofertas.filter((o) => isTrustedStore(o.store)).map((o) => o.price_pix);
  const marcadas = new Map<string, SuspiciousFlag>();
  if (precosConfiaveis.length === 0) return marcadas;

  for (const o of ofertas) {
    if (isTrustedStore(o.store)) continue;
    const flag = suspiciousPrice(o.price_pix, precosConfiaveis);
    if (flag) marcadas.set(o.id, flag);
  }
  return marcadas;
}
