import { describe, it, expect } from "vitest";
import { isTrustedStore, validOffers, cheapestOffer } from "./trust";
import type { OfferWithStore, ProductWithOffers, Store } from "@/models/types";

const oficial: Store = { id: "kabum", name: "KaBuM!", rating: 4.8, rating_count: 1000, is_official: true, url: null };
const notaBaixa: Store = { id: "x", name: "Loja X", rating: 3.9, rating_count: 50, is_official: false, url: null };
const oficialNotaBaixa: Store = { id: "y", name: "Loja Y", rating: 4.2, rating_count: 50, is_official: true, url: null };

function oferta(id: string, store: Store, price: number, inStock = true): OfferWithStore {
  return {
    id, product_id: "p", store_id: store.id, url: null,
    price_pix: price, price_installment: price * 1.1, installment_count: 10,
    in_stock: inStock, store,
  };
}

const produto: ProductWithOffers = {
  id: "p", slug: "rtx-4060", name: "RTX 4060", category: "gpu", brand: null, description: null, image_url: null,
  offers: [
    oferta("o1", oficial, 1899.9),
    oferta("o2", notaBaixa, 1499.9),
    oferta("o3", oficial, 1700, false),
  ],
};

describe("lojas confiáveis", () => {
  it("é confiável quando oficial e nota >= 4.5", () => {
    expect(isTrustedStore(oficial)).toBe(true);
    expect(isTrustedStore(notaBaixa)).toBe(false);
    expect(isTrustedStore(oficialNotaBaixa)).toBe(false);
  });

  it("validOffers ignora ofertas sem estoque", () => {
    expect(validOffers(produto, false).map((o) => o.id)).toEqual(["o1", "o2"]);
  });

  it("validOffers com trustedOnly mantém só lojas confiáveis", () => {
    expect(validOffers(produto, true).map((o) => o.id)).toEqual(["o1"]);
  });

  it("cheapestOffer pega a mais barata entre as válidas", () => {
    expect(cheapestOffer(produto, false)?.id).toBe("o2");
    expect(cheapestOffer(produto, true)?.id).toBe("o1");
  });

  it("cheapestOffer devolve null sem oferta válida", () => {
    const semEstoque = { ...produto, offers: [oferta("o9", oficial, 100, false)] };
    expect(cheapestOffer(semEstoque, false)).toBeNull();
  });
});
