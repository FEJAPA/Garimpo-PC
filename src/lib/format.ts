// Funções de formatação e ajuda para exibir preços e ofertas.

import type { OfferWithStore, ProductWithOffers } from "@/models/types";

/** Formata um valor em reais, ex.: 1899.9 -> "R$ 1.899,90". */
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Formata uma data ISO para "DD/MM", ex.: "2026-06-15" -> "15/06". */
export function formatDayMonth(isoDate: string): string {
  const [, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}`;
}

/** Retorna a oferta mais barata (menor preço PIX) de uma peça, ou null. */
export function getBestOffer(product: ProductWithOffers): OfferWithStore | null {
  const disponiveis = product.offers.filter((o) => o.in_stock);
  if (disponiveis.length === 0) return null;
  return disponiveis.reduce((melhor, o) =>
    o.price_pix < melhor.price_pix ? o : melhor
  );
}

/** Texto curto descrevendo a confiabilidade de uma loja. */
export function trustLabel(rating: number): string {
  if (rating >= 4.5) return "Muito confiável";
  if (rating >= 4) return "Confiável";
  if (rating >= 3) return "Razoável";
  return "Atenção";
}
