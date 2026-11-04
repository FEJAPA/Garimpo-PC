import { describe, it, expect } from "vitest";
import { suspiciousPrice, flagSuspiciousOffers } from "./suspicious";
import type { OfferWithStore, ProductWithOffers, Store } from "@/models/types";

const kabum: Store = { id: "kabum", name: "KaBuM!", rating: 4.8, rating_count: 125000, is_official: true, url: null };
const pichau: Store = { id: "pichau", name: "Pichau", rating: 4.6, rating_count: 48000, is_official: true, url: null };
const terabyte: Store = { id: "terabyte", name: "Terabyte Shop", rating: 4.7, rating_count: 61000, is_official: true, url: null };
const promo: Store = {
  id: "promocenter", name: "Promo Center", rating: 3.8, rating_count: 2300, is_official: false, url: null,
  reclame_aqui_score: 4.9, years_active: 1, blocked: false,
};

function oferta(id: string, store: Store, price: number, inStock = true): OfferWithStore {
  return {
    id, product_id: "p", store_id: store.id, url: null,
    price_pix: price, price_installment: price * 1.1, installment_count: 10,
    in_stock: inStock, store,
  };
}

function produto(offers: OfferWithStore[]): ProductWithOffers {
  return {
    id: "p", slug: "rtx-4060", name: "RTX 4060", category: "gpu", brand: null, description: null, image_url: null,
    offers,
  };
}

describe("suspiciousPrice", () => {
  it("sem preços de lojas confiáveis devolve null", () => {
    expect(suspiciousPrice(100, [])).toBeNull();
  });

  it("preço acima ou igual à mediana não é suspeito", () => {
    expect(suspiciousPrice(2100, [1899.9, 2000])).toBeNull();
    expect(suspiciousPrice(1000, [1000])).toBeNull();
  });

  it("exatamente 25% abaixo da mediana já é suspeito", () => {
    const r = suspiciousPrice(750, [1000]);
    expect(r).not.toBeNull();
    expect(r?.reason).toContain("25% abaixo da mediana das lojas confiáveis");
  });

  it("um pouco menos de 25% abaixo não é suspeito", () => {
    expect(suspiciousPrice(750.01, [1000])).toBeNull();
  });

  it("usa a mediana (não a média) e explica em linguagem simples", () => {
    // Mediana de [1799,90; 1899,90; 5000] = 1899,90 (a média seria bem maior).
    const r = suspiciousPrice(1386.93, [5000, 1799.9, 1899.9]);
    expect(r?.reason).toBe(
      "27% abaixo da mediana das lojas confiáveis (R$ 1.899,90): confira se a loja existe mesmo antes de pagar",
    );
    // Com a média, 1500 seria suspeito; com a mediana, não.
    expect(suspiciousPrice(1500, [5000, 1799.9, 1899.9])).toBeNull();
  });

  it("mediana de quantidade par é a média dos dois do meio", () => {
    // Mediana de [1000, 2000] = 1500; 25% abaixo = 1125.
    expect(suspiciousPrice(1125, [2000, 1000])).not.toBeNull();
    expect(suspiciousPrice(1126, [2000, 1000])).toBeNull();
  });

  it("ignora preços confiáveis inválidos e preço avaliado inválido", () => {
    expect(suspiciousPrice(750, [0, -5, Number.NaN, 1000])).not.toBeNull();
    expect(suspiciousPrice(750, [0, Number.NaN])).toBeNull();
    expect(suspiciousPrice(0, [1000])).toBeNull();
  });
});

describe("flagSuspiciousOffers", () => {
  it("marca a oferta de loja não confiável muito abaixo das confiáveis", () => {
    const p = produto([
      oferta("k", kabum, 1899.9),
      oferta("pi", pichau, 1949.9),
      oferta("t", terabyte, 1879.9),
      oferta("promo", promo, 1299.9),
    ]);
    const flags = flagSuspiciousOffers(p);
    expect([...flags.keys()]).toEqual(["promo"]);
    expect(flags.get("promo")?.reason).toContain("abaixo da mediana das lojas confiáveis");
  });

  it("não marca nada quando não há loja confiável para comparar", () => {
    const p = produto([oferta("promo", promo, 100), oferta("x", { ...promo, id: "x" }, 2000)]);
    expect(flagSuspiciousOffers(p).size).toBe(0);
  });

  it("não marca ofertas de lojas confiáveis nem preço razoável", () => {
    const p = produto([
      oferta("k", kabum, 1899.9),
      oferta("t", terabyte, 1300),
      oferta("promo", promo, 1799.9),
    ]);
    // Mediana confiável = 1599,95; Terabyte está 19% abaixo e é confiável; Promo está acima.
    expect(flagSuspiciousOffers(p).size).toBe(0);
  });

  it("ignora ofertas sem estoque na mediana e na marcação", () => {
    const p = produto([
      oferta("k", kabum, 1899.9),
      oferta("k-old", kabum, 100, false),
      oferta("promo-off", promo, 500, false),
      oferta("promo", promo, 1799.9),
    ]);
    expect(flagSuspiciousOffers(p).size).toBe(0);
  });
});
