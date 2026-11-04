import { afterEach, describe, expect, it, vi } from "vitest";
import type { OfferWithStore, ProductWithOffers, Store } from "@/models/types";

// A régua de "oferta suspeita" fica em services/builder/suspicious. Aqui a
// função real é embrulhada num `vi.fn` só para um teste conseguir simular o
// caso "todas as ofertas válidas são suspeitas", que a regra real não produz
// (loja confiável nunca é marcada), mas que getBestOffer precisa tratar.
vi.mock("@/services/builder/suspicious", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/services/builder/suspicious")>();
  return { ...real, flagSuspiciousOffers: vi.fn(real.flagSuspiciousOffers) };
});

import { flagSuspiciousOffers } from "@/services/builder/suspicious";
import {
  formatBRL,
  formatDayMonth,
  getBestOffer,
  offerWarning,
  priceHistorySummary,
  trustLabel,
} from "./format";

const kabum: Store = { id: "kabum", name: "KaBuM!", rating: 4.8, rating_count: 125000, is_official: true, url: null };
const pichau: Store = { id: "pichau", name: "Pichau", rating: 4.6, rating_count: 48000, is_official: true, url: null };
const terabyte: Store = { id: "terabyte", name: "Terabyte Shop", rating: 4.7, rating_count: 61000, is_official: true, url: null };
const promo: Store = {
  id: "promocenter", name: "Promo Center", rating: 3.8, rating_count: 2300, is_official: false, url: null,
  reclame_aqui_score: 4.9, years_active: 1, blocked: false,
};
const golpe: Store = { ...promo, id: "golpe", name: "Loja do Golpe", blocked: true };

function oferta(id: string, store: Store, price: number, inStock = true): OfferWithStore {
  return {
    id, product_id: "p", store_id: store.id, url: null,
    price_pix: price, price_installment: price * 1.1, installment_count: 10,
    in_stock: inStock, store,
  };
}

function produto(offers: OfferWithStore[]): ProductWithOffers {
  return { id: "p", slug: "rtx-4060", name: "RTX 4060", category: "gpu", brand: null, description: null, image_url: null, offers };
}

afterEach(() => {
  vi.mocked(flagSuspiciousOffers).mockClear();
});

describe("formatBRL e formatDayMonth", () => {
  it("formata em reais", () => {
    expect(formatBRL(1899.9).replace(/\s/g, " ")).toBe("R$ 1.899,90");
  });

  it("formata a data como DD/MM", () => {
    expect(formatDayMonth("2026-06-15")).toBe("15/06");
  });
});

describe("getBestOffer", () => {
  it("devolve a oferta em estoque mais barata", () => {
    const p = produto([oferta("a", kabum, 1899.9), oferta("b", pichau, 1799.9), oferta("c", terabyte, 1500, false)]);
    expect(getBestOffer(p)?.id).toBe("b");
  });

  it("devolve null sem oferta em estoque", () => {
    expect(getBestOffer(produto([]))).toBeNull();
    expect(getBestOffer(produto([oferta("a", kabum, 1899.9, false)]))).toBeNull();
  });

  it("ignora preço zero, negativo ou não finito (nunca mostra R$ 0,00)", () => {
    const p = produto([
      oferta("zero", kabum, 0),
      oferta("neg", pichau, -10),
      oferta("nan", terabyte, Number.NaN),
      oferta("ok", kabum, 1899.9),
    ]);
    expect(getBestOffer(p)?.id).toBe("ok");
    expect(getBestOffer(produto([oferta("zero", kabum, 0)]))).toBeNull();
  });

  it("não escolhe oferta de loja bloqueada, mesmo a mais barata", () => {
    const p = produto([oferta("golpe", golpe, 500), oferta("ok", kabum, 1899.9)]);
    expect(getBestOffer(p)?.id).toBe("ok");
    expect(getBestOffer(produto([oferta("golpe", golpe, 500)]))).toBeNull();
  });

  it("pula a oferta suspeita (27% abaixo da mediana confiável) e fica com a mais barata normal", () => {
    const p = produto([
      oferta("k", kabum, 1899.9),
      oferta("pi", pichau, 1949.9),
      oferta("t", terabyte, 1879.9),
      oferta("promo", promo, 1399.9),
    ]);
    expect(flagSuspiciousOffers(p).has("promo")).toBe(true);
    expect(getBestOffer(p)?.id).toBe("t");
  });

  it("loja não confiável com preço normal pode ser a melhor oferta", () => {
    const p = produto([oferta("k", kabum, 1899.9), oferta("promo", promo, 1799.9)]);
    expect(getBestOffer(p)?.id).toBe("promo");
  });

  it("se só restarem suspeitas, devolve a mais barata delas (a peça não some)", () => {
    const p = produto([oferta("a", promo, 1200), oferta("b", { ...promo, id: "outra" }, 1100)]);
    const todasSuspeitas = () =>
      new Map([
        ["a", { reason: "motivo a" }],
        ["b", { reason: "motivo b" }],
      ]);
    // Uma chamada em getBestOffer e outra em offerWarning; depois volta ao real.
    vi.mocked(flagSuspiciousOffers).mockReturnValueOnce(todasSuspeitas());
    expect(getBestOffer(p)?.id).toBe("b");
    vi.mocked(flagSuspiciousOffers).mockReturnValueOnce(todasSuspeitas());
    expect(offerWarning(p, p.offers[1])).toBe("motivo b");
  });
});

describe("offerWarning", () => {
  const p = produto([
    oferta("k", kabum, 1899.9),
    oferta("pi", pichau, 1949.9),
    oferta("t", terabyte, 1879.9),
    oferta("promo", promo, 1399.9),
    oferta("golpe", golpe, 900),
  ]);

  it("oferta normal não tem aviso", () => {
    expect(offerWarning(p, p.offers[0])).toBeNull();
  });

  it("oferta suspeita devolve o motivo em linguagem simples", () => {
    const aviso = offerWarning(p, p.offers[3]);
    expect(aviso).toContain("abaixo da mediana das lojas confiáveis");
    expect(aviso).toContain("confira se a loja existe mesmo antes de pagar");
  });

  it("oferta de loja bloqueada também avisa", () => {
    expect(offerWarning(p, p.offers[4])).toContain("bloqueada");
  });
});

describe("trustLabel: vem de storeTrust, não da nota (V2, LOG-17)", () => {
  it("loja confiável", () => {
    expect(trustLabel(kabum)).toBe("Confiável");
  });

  it("loja não oficial com nota alta não é 'Confiável'", () => {
    expect(trustLabel({ ...kabum, is_official: false, rating: 4.7 })).toBe("Não verificada");
  });

  it("nota entre 4,0 e 4,49 não é 'Confiável'", () => {
    expect(trustLabel({ ...kabum, rating: 4.2 })).toBe("Não verificada");
  });

  it("Reclame Aqui baixo derruba o rótulo", () => {
    expect(trustLabel({ ...kabum, reclame_aqui_score: 5 })).toBe("Não verificada");
  });

  it("loja bloqueada", () => {
    expect(trustLabel({ ...kabum, blocked: true })).toBe("Bloqueada");
  });
});

describe("priceHistorySummary (texto alternativo do gráfico, A11Y-05)", () => {
  it("resume do primeiro ao último ponto, com menor e maior preço", () => {
    const resumo = priceHistorySummary([
      { date: "2026-10-01", price: 1899.9 },
      { date: "2026-10-15", price: 1750 },
      { date: "2026-11-04", price: 1799.9 },
    ]);
    const limpo = resumo.replace(/\s/g, " ");
    expect(limpo).toContain("Histórico de preços: de R$ 1.899,90 em 01/10 a R$ 1.799,90 em 04/11");
    expect(limpo).toContain("menor preço R$ 1.750,00");
    expect(limpo).toContain("maior R$ 1.899,90");
  });

  it("com um único ponto não inventa intervalo", () => {
    const resumo = priceHistorySummary([{ date: "2026-11-04", price: 1799.9 }]).replace(/\s/g, " ");
    expect(resumo).toBe("Histórico de preços: R$ 1.799,90 em 04/11 (um único registro).");
  });

  it("sem pontos avisa que não há histórico", () => {
    expect(priceHistorySummary([])).toBe("Ainda não há histórico de preços para esta peça.");
  });
});
