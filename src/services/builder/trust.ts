// Filtro de "lojas confiáveis" do Montador (toggle da tela). Spec §2 e §5.1.
//
// TODO(V2-C): reputação real (Reclame Aqui, tempo de mercado, lista negra) em
// vez de só is_official + nota; tornar o limiar configurável.

import type { OfferWithStore, ProductWithOffers, Store } from "@/models/types";

/** Nota mínima para uma loja oficial ser considerada confiável. */
export const TRUSTED_MIN_RATING = 4.5;

/** Confiável = loja oficial/curada E nota >= 4.5. */
export function isTrustedStore(store: Store): boolean {
  return store.is_official && store.rating >= TRUSTED_MIN_RATING;
}

/** Ofertas em estoque; se trustedOnly, só as de lojas confiáveis. */
export function validOffers(product: ProductWithOffers, trustedOnly: boolean): OfferWithStore[] {
  return product.offers.filter((o) => o.in_stock && (!trustedOnly || isTrustedStore(o.store)));
}

/** A oferta válida mais barata (preço Pix), ou null se não houver. */
export function cheapestOffer(product: ProductWithOffers, trustedOnly: boolean): OfferWithStore | null {
  const ofertas = validOffers(product, trustedOnly);
  if (ofertas.length === 0) return null;
  return ofertas.reduce((melhor, o) => (o.price_pix < melhor.price_pix ? o : melhor));
}
