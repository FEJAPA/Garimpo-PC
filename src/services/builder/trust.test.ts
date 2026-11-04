import { describe, it, expect } from "vitest";
import { isTrustedStore, validOffers, cheapestOffer, storeTrust, trustLevel } from "./trust";
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

describe("validOffers: validação de preço (V2, A2)", () => {
  it("ignora ofertas com preço Pix zero, negativo ou não finito", () => {
    const comPrecosRuins: ProductWithOffers = {
      ...produto,
      offers: [
        oferta("ok", oficial, 1899.9),
        oferta("zero", oficial, 0),
        oferta("negativo", notaBaixa, -10),
        oferta("nan", oficial, Number.NaN),
        oferta("infinito", oficial, Number.POSITIVE_INFINITY),
      ],
    };
    expect(validOffers(comPrecosRuins, false).map((o) => o.id)).toEqual(["ok"]);
    expect(cheapestOffer(comPrecosRuins, false)?.id).toBe("ok");
  });
});

describe("storeTrust: reputação com motivos (V2, C1)", () => {
  const kabum: Store = {
    id: "kabum", name: "KaBuM!", rating: 4.8, rating_count: 125000, is_official: true, url: null,
    reclame_aqui_score: 8.2, years_active: 12, blocked: false,
  };

  it("oficial + nota alta + Reclame Aqui bom → confiável com motivos", () => {
    const t = storeTrust(kabum);
    expect(t.trusted).toBe(true);
    expect(t.reasons).toEqual([
      "Loja oficial",
      "Nota 4,8 (125.000 avaliações)",
      "Reclame Aqui 8,2",
      "12 anos de mercado",
    ]);
  });

  it("loja bloqueada nunca é confiável, mesmo com tudo bom", () => {
    const t = storeTrust({ ...kabum, blocked: true });
    expect(t.trusted).toBe(false);
    expect(t.reasons).toContain("Loja bloqueada por denúncias");
    expect(isTrustedStore({ ...kabum, blocked: true })).toBe(false);
  });

  it("sem Reclame Aqui informado mantém a regra da V1", () => {
    const t = storeTrust(oficial);
    expect(t.trusted).toBe(true);
    expect(t.reasons).toEqual(["Loja oficial", "Nota 4,8 (1.000 avaliações)"]);
    expect(storeTrust({ ...oficial, reclame_aqui_score: null }).trusted).toBe(true);
  });

  it("Reclame Aqui abaixo de 6 → não confiável, com motivo", () => {
    const t = storeTrust({ ...kabum, reclame_aqui_score: 5.1 });
    expect(t.trusted).toBe(false);
    expect(t.reasons).toContain("Reclame Aqui baixo (5,1)");
    expect(isTrustedStore({ ...kabum, reclame_aqui_score: 5.1 })).toBe(false);
  });

  it("Reclame Aqui entre 6 e 7 não derruba a loja, mas não vira motivo", () => {
    const t = storeTrust({ ...kabum, reclame_aqui_score: 6.5 });
    expect(t.trusted).toBe(true);
    expect(t.reasons.some((r) => r.startsWith("Reclame Aqui"))).toBe(false);
  });

  it("menos de 3 anos de mercado não vira motivo", () => {
    expect(storeTrust({ ...kabum, years_active: 2 }).reasons.some((r) => r.includes("mercado"))).toBe(false);
    expect(storeTrust({ ...kabum, years_active: 3 }).reasons).toContain("3 anos de mercado");
  });

  it("explica por que uma loja não é confiável", () => {
    const naoOficial = storeTrust(notaBaixa);
    expect(naoOficial.trusted).toBe(false);
    expect(naoOficial.reasons).toContain("Não é loja oficial");
    const notaFraca = storeTrust(oficialNotaBaixa);
    expect(notaFraca.trusted).toBe(false);
    expect(notaFraca.reasons).toContain("Nota 4,2, abaixo de 4,5");
  });

  it("isTrustedStore é o mesmo que storeTrust(store).trusted", () => {
    for (const s of [oficial, notaBaixa, oficialNotaBaixa, kabum]) {
      expect(isTrustedStore(s)).toBe(storeTrust(s).trusted);
    }
  });
});

describe("lojas bloqueadas (V2, R-11)", () => {
  const bloqueada: Store = {
    id: "golpe", name: "Loja do Golpe", rating: 4.9, rating_count: 99999, is_official: true, url: null,
    reclame_aqui_score: 9, years_active: 20, blocked: true,
  };
  const comBloqueada: ProductWithOffers = {
    ...produto,
    offers: [oferta("ok", oficial, 1899.9), oferta("golpe", bloqueada, 900), oferta("nota", notaBaixa, 1499.9)],
  };

  it("validOffers exclui loja bloqueada mesmo com trustedOnly desligado", () => {
    expect(validOffers(comBloqueada, false).map((o) => o.id)).toEqual(["ok", "nota"]);
  });

  it("validOffers exclui loja bloqueada com trustedOnly ligado", () => {
    expect(validOffers(comBloqueada, true).map((o) => o.id)).toEqual(["ok"]);
  });

  it("cheapestOffer nunca devolve oferta de loja bloqueada", () => {
    expect(cheapestOffer(comBloqueada, false)?.id).toBe("nota");
    const soBloqueada = { ...produto, offers: [oferta("golpe", bloqueada, 900)] };
    expect(cheapestOffer(soBloqueada, false)).toBeNull();
    expect(validOffers(soBloqueada, false)).toEqual([]);
  });

  it("blocked: false (ou ausente) não exclui nada", () => {
    expect(validOffers({ ...produto, offers: [oferta("a", { ...oficial, blocked: false }, 100)] }, false)).toHaveLength(1);
  });
});

describe("storeTrust: números que chegam como texto (V2, R-12)", () => {
  // O PostgREST costuma devolver `numeric` como número, mas um driver ou uma
  // view podem devolver texto. A regra não pode ser pulada em silêncio.
  const comoTexto = (campos: Record<string, unknown>): Store =>
    ({ id: "t", name: "Loja T", rating: 4.8, rating_count: 1000, is_official: true, url: null, ...campos }) as unknown as Store;

  it("Reclame Aqui baixo em texto ainda derruba a loja", () => {
    const t = storeTrust(comoTexto({ reclame_aqui_score: "5.1" }));
    expect(t.trusted).toBe(false);
    expect(t.reasons).toContain("Reclame Aqui baixo (5,1)");
  });

  it("Reclame Aqui bom em texto vira motivo", () => {
    expect(storeTrust(comoTexto({ reclame_aqui_score: "8.2" })).reasons).toContain("Reclame Aqui 8,2");
  });

  it("anos de mercado em texto viram motivo", () => {
    expect(storeTrust(comoTexto({ years_active: "12" })).reasons).toContain("12 anos de mercado");
    expect(storeTrust(comoTexto({ years_active: "2" })).reasons.some((r) => r.includes("mercado"))).toBe(false);
  });

  it("nota em texto vale como número (4.8 confia, 4.2 não)", () => {
    const boa = storeTrust(comoTexto({ rating: "4.8", rating_count: "125000" }));
    expect(boa.trusted).toBe(true);
    expect(boa.reasons).toContain("Nota 4,8 (125.000 avaliações)");
    const fraca = storeTrust(comoTexto({ rating: "4.2" }));
    expect(fraca.trusted).toBe(false);
    expect(fraca.reasons).toContain("Nota 4,2, abaixo de 4,5");
  });

  it("texto vazio ou inválido conta como não informado (não derruba nem confia)", () => {
    expect(storeTrust(comoTexto({ reclame_aqui_score: "" })).trusted).toBe(true);
    expect(storeTrust(comoTexto({ reclame_aqui_score: "abc" })).trusted).toBe(true);
    expect(storeTrust(comoTexto({ years_active: " " })).reasons.some((r) => r.includes("mercado"))).toBe(false);
    // Nota ilegível nunca é confiável.
    expect(storeTrust(comoTexto({ rating: "abc" })).trusted).toBe(false);
  });

  it("o texto dá o mesmo resultado que o número", () => {
    const comNumero = storeTrust(comoTexto({ reclame_aqui_score: 5.1, years_active: 12 }));
    const comTexto = storeTrust(comoTexto({ reclame_aqui_score: "5.1", years_active: "12" }));
    expect(comTexto).toEqual(comNumero);
  });
});

describe("trustLevel: uma régua só para selo, rótulo e cor (V2, LOG-17)", () => {
  it("confiável, não verificada e bloqueada", () => {
    expect(trustLevel(oficial)).toBe("trusted");
    expect(trustLevel(notaBaixa)).toBe("unverified");
    expect(trustLevel({ ...oficial, blocked: true })).toBe("blocked");
  });

  it("nota 4,0 a 4,49 não é confiável (antes aparecia verde)", () => {
    expect(trustLevel({ ...oficial, rating: 4.4 })).toBe("unverified");
    expect(trustLevel({ ...oficial, rating: 4.5 })).toBe("trusted");
  });

  it("loja não oficial com nota alta continua não verificada", () => {
    expect(trustLevel({ ...oficial, is_official: false, rating: 4.9 })).toBe("unverified");
  });

  it("Reclame Aqui baixo derruba para não verificada", () => {
    expect(trustLevel({ ...oficial, reclame_aqui_score: 4 })).toBe("unverified");
  });

  it("concorda com isTrustedStore", () => {
    for (const s of [oficial, notaBaixa, oficialNotaBaixa, { ...oficial, blocked: true }]) {
      expect(trustLevel(s) === "trusted").toBe(isTrustedStore(s));
    }
  });
});
