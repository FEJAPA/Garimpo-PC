// Fábricas de dados para os testes do Montador (não é um arquivo de teste).

import type { BuildPart, PartSpec } from "@/models/builder-types";
import type { Category, OfferWithStore, ProductWithOffers, Store } from "@/models/types";

export const LOJA_KABUM: Store = { id: "kabum", name: "KaBuM!", rating: 4.8, rating_count: 125000, is_official: true, url: "https://www.kabum.com.br" };
export const LOJA_PICHAU: Store = { id: "pichau", name: "Pichau", rating: 4.6, rating_count: 48000, is_official: true, url: "https://www.pichau.com.br" };
export const LOJA_DUVIDOSA: Store = { id: "duvidosa", name: "Loja Duvidosa", rating: 3.5, rating_count: 90, is_official: false, url: null };

export type OfferInput = {
  store: Store;
  price: number;
  installment?: number | null;
  count?: number | null;
  inStock?: boolean;
};

/** Cria um produto com ofertas a partir de uma lista compacta. */
export function makeProduct(slug: string, category: Category, offers: OfferInput[]): ProductWithOffers {
  const id = `p-${slug}`;
  return {
    id,
    slug,
    name: slug,
    category,
    brand: null,
    description: null,
    image_url: null,
    offers: offers.map((o, i): OfferWithStore => ({
      id: `o-${slug}-${o.store.id}-${i}`,
      product_id: id,
      store_id: o.store.id,
      url: o.store.url,
      price_pix: o.price,
      price_installment: o.installment === undefined ? Math.round(o.price * 1.1 * 100) / 100 : o.installment,
      installment_count: o.count === undefined ? 10 : o.count,
      in_stock: o.inStock ?? true,
      store: o.store,
    })),
  };
}

/** Cria uma peça já escolhida (para testes de pagamento/desempenho). */
export function makePart(
  spec: PartSpec,
  offer: OfferInput
): BuildPart {
  const product = makeProduct(spec.slug, spec.category, [offer]);
  return { category: spec.category, product, offer: product.offers[0], spec, price: offer.price };
}
