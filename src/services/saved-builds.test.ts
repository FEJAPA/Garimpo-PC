// Testes das montagens salvas e do alerta da montagem inteira (V2, pacote G).
// Só lógica pura: serialização ida e volta, validação do formulário e o cálculo
// do total atual de uma montagem salva (base do e-mail "sua montagem caiu").

import { describe, expect, it } from "vitest";
import {
  currentBuildTotal,
  fromSavedBuildRow,
  MAX_TARGET_PRICE,
  parseSavedBuildForm,
  parseTargetPrice,
  sharePartsFromRow,
  toSavedBuildRow,
  validateBuildName,
  type SavedBuildRow,
} from "./saved-builds";
import type { BuildPart, BuildPreferences, BuildSuccess } from "@/models/builder-types";
import type { OfferWithStore, ProductWithOffers, Store } from "@/models/types";
import { MOCK_PRODUCTS } from "@/models/mock-data";

const loja = (id: string, extra: Partial<Store> = {}): Store => ({
  id,
  name: id,
  rating: 4.8,
  rating_count: 1000,
  is_official: true,
  url: null,
  blocked: false,
  ...extra,
});

function oferta(id: string, productId: string, store: Store, price: number, inStock = true): OfferWithStore {
  return {
    id,
    product_id: productId,
    store_id: store.id,
    url: null,
    price_pix: price,
    price_installment: null,
    installment_count: null,
    in_stock: inStock,
    store,
  };
}

function produto(id: string, slug: string, offers: OfferWithStore[]): ProductWithOffers {
  return {
    id,
    slug,
    name: slug,
    category: "gpu",
    brand: null,
    description: null,
    image_url: null,
    offers,
  };
}

const kabum = loja("kabum");
const pichau = loja("pichau");
const duvidosa = loja("duvidosa", { is_official: false, rating: 3.5 });

const gpu = produto("p-gpu", "rtx-4060", [
  oferta("o-gpu-kabum", "p-gpu", kabum, 1900),
  oferta("o-gpu-pichau", "p-gpu", pichau, 1850),
]);
const cpu = produto("p-cpu", "ryzen-5-7600", [
  oferta("o-cpu-kabum", "p-cpu", kabum, 1100),
  oferta("o-cpu-duvidosa", "p-cpu", duvidosa, 1050),
]);

const prefs: BuildPreferences = {
  budget: { target: 6000, hardCap: 7000 },
  trustedOnly: false,
  aesthetics: 30,
  usage: "jogos",
  resolution: "1080p",
};

function parte(p: ProductWithOffers, offerIndex: number): BuildPart {
  const offer = p.offers[offerIndex];
  return {
    product: p,
    offer,
    spec: { slug: p.slug, category: p.category, perf: 100, aesthetics: 50 },
    price: offer.price_pix,
    category: p.category,
  };
}

// Só os campos que a serialização lê; o resto do BuildSuccess não importa aqui.
const result = {
  ok: true,
  parts: [parte(gpu, 0), parte(cpu, 0)],
  totalPix: 3000,
  totalInstallment: 3300,
  budget: prefs.budget,
  usedWiggleRoom: false,
  leftover: 4000,
  notes: [],
} as unknown as BuildSuccess;

describe("validateBuildName", () => {
  it("apara e junta espaços", () => {
    expect(validateBuildName("  PC   da  sala ")).toEqual({ ok: true, name: "PC da sala" });
  });

  it("vazio vira o nome padrão", () => {
    expect(validateBuildName("   ")).toEqual({ ok: true, name: "Minha montagem" });
    expect(validateBuildName(null)).toEqual({ ok: true, name: "Minha montagem" });
  });

  it("recusa mais de 60 caracteres", () => {
    expect(validateBuildName("a".repeat(60))).toEqual({ ok: true, name: "a".repeat(60) });
    const r = validateBuildName("a".repeat(61));
    expect(r.ok).toBe(false);
  });
});

describe("toSavedBuildRow / fromSavedBuildRow", () => {
  it("serializa peças, preferências e total", () => {
    const row = toSavedBuildRow(prefs, result, "PC da sala");
    expect(row).toEqual({
      name: "PC da sala",
      prefs,
      parts: [
        { productId: "p-gpu", offerId: "o-gpu-kabum", price: 1900, slug: "rtx-4060", storeId: "kabum" },
        { productId: "p-cpu", offerId: "o-cpu-kabum", price: 1100, slug: "ryzen-5-7600", storeId: "kabum" },
      ],
      total_pix: 3000,
    });
  });

  it("ida e volta devolve as mesmas peças por product_id", () => {
    const row: SavedBuildRow = {
      id: "b1",
      created_at: "2026-11-04T15:30:00Z",
      ...toSavedBuildRow(prefs, result, "PC da sala"),
    };
    // Simula o que o banco devolve: jsonb volta como objeto, numeric pode vir como texto.
    const doBanco = JSON.parse(JSON.stringify({ ...row, total_pix: "3000.00" }));
    const salvo = fromSavedBuildRow(doBanco);
    expect(salvo).toEqual({
      id: "b1",
      name: "PC da sala",
      prefs,
      parts: [
        { productId: "p-gpu", offerId: "o-gpu-kabum", price: 1900 },
        { productId: "p-cpu", offerId: "o-cpu-kabum", price: 1100 },
      ],
      totalPix: 3000,
      createdAt: "2026-11-04T15:30:00Z",
    });
    expect(salvo.parts.map((p) => p.productId)).toEqual(result.parts.map((p) => p.product.id));
  });

  it("aceita peças no formato snake_case e descarta peças quebradas", () => {
    const salvo = fromSavedBuildRow({
      id: "b2",
      name: "Antiga",
      prefs,
      parts: [
        { product_id: "p-gpu", offer_id: "o-gpu-kabum", price: "1900.50" },
        { product_id: "p-cpu" }, // sem offer_id: inválida
        "lixo",
      ] as unknown as SavedBuildRow["parts"],
      total_pix: 1900.5,
      created_at: "2026-11-01T10:00:00Z",
    });
    expect(salvo.parts).toEqual([{ productId: "p-gpu", offerId: "o-gpu-kabum", price: 1900.5 }]);
  });

  it("sharePartsFromRow devolve slug e loja para o link de compartilhar", () => {
    const row = toSavedBuildRow(prefs, result, "x");
    expect(sharePartsFromRow(row)).toEqual([
      { slug: "rtx-4060", storeId: "kabum" },
      { slug: "ryzen-5-7600", storeId: "kabum" },
    ]);
  });
});

describe("parseSavedBuildForm", () => {
  function form(campos: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(campos)) fd.set(k, v);
    return fd;
  }
  const row = toSavedBuildRow(prefs, result, "PC da sala");
  const valido = {
    name: "PC da sala",
    prefs: JSON.stringify(row.prefs),
    parts: JSON.stringify(row.parts),
  };

  it("lê nome, preferências e peças", () => {
    const r = parseSavedBuildForm(form(valido));
    expect(r).toEqual({
      ok: true,
      value: {
        name: "PC da sala",
        prefs,
        parts: row.parts.map(({ productId, offerId, price }) => ({ productId, offerId, price })),
      },
    });
  });

  it("recusa JSON quebrado, lista vazia e preferências inválidas", () => {
    expect(parseSavedBuildForm(form({ ...valido, parts: "{" })).ok).toBe(false);
    expect(parseSavedBuildForm(form({ ...valido, parts: "[]" })).ok).toBe(false);
    expect(
      parseSavedBuildForm(
        form({ ...valido, prefs: JSON.stringify({ ...prefs, budget: { target: -1, hardCap: 5 } }) }),
      ).ok,
    ).toBe(false);
    expect(
      parseSavedBuildForm(form({ ...valido, prefs: JSON.stringify({ ...prefs, aesthetics: 300 }) })).ok,
    ).toBe(false);
  });

  it("recusa nome longo demais com mensagem clara", () => {
    const r = parseSavedBuildForm(form({ ...valido, name: "x".repeat(61) }));
    expect(r).toEqual({ ok: false, message: "O nome pode ter até 60 caracteres." });
  });

  it("recusa peça repetida ou lista grande demais", () => {
    const dup = [row.parts[0], row.parts[0]];
    expect(parseSavedBuildForm(form({ ...valido, parts: JSON.stringify(dup) })).ok).toBe(false);
    const muitas = Array.from({ length: 21 }, (_, i) => ({ productId: `p${i}`, offerId: `o${i}`, price: 10 }));
    expect(parseSavedBuildForm(form({ ...valido, parts: JSON.stringify(muitas) })).ok).toBe(false);
  });
});

describe("parseTargetPrice", () => {
  it("aceita valores positivos até o teto", () => {
    expect(parseTargetPrice("1500")).toEqual({ ok: true, value: 1500 });
    expect(parseTargetPrice(String(MAX_TARGET_PRICE))).toEqual({ ok: true, value: MAX_TARGET_PRICE });
  });

  it("lê dinheiro em pt-BR como o resto do site", () => {
    expect(parseTargetPrice("5.999,90")).toEqual({ ok: true, value: 5999.9 });
    expect(parseTargetPrice("R$ 5999.90")).toEqual({ ok: true, value: 5999.9 });
    expect(parseTargetPrice(1709)).toEqual({ ok: true, value: 1709 });
  });

  it("recusa vazio, zero, negativo e valores absurdos (SEG-10)", () => {
    expect(parseTargetPrice("").ok).toBe(false);
    expect(parseTargetPrice("0").ok).toBe(false);
    expect(parseTargetPrice("-5").ok).toBe(false);
    expect(parseTargetPrice("1e12").ok).toBe(false);
    expect(parseTargetPrice("abc").ok).toBe(false);
  });
});

describe("currentBuildTotal", () => {
  const partes = [
    { productId: "p-gpu", offerId: "o-gpu-kabum", price: 1900 },
    { productId: "p-cpu", offerId: "o-cpu-kabum", price: 1100 },
  ];

  it("soma o melhor preço atual de cada peça (pode ser de outra loja)", () => {
    expect(currentBuildTotal(partes, [gpu, cpu])).toEqual({ total: 2900, missing: [] });
  });

  it("com trustedOnly, ignora lojas não confiáveis", () => {
    expect(currentBuildTotal(partes, [gpu, cpu], { trustedOnly: true })).toEqual({ total: 2950, missing: [] });
  });

  it("peça fora de estoque ou fora do catálogo entra em missing", () => {
    const semEstoque = produto("p-cpu", "ryzen-5-7600", [oferta("o-cpu-kabum", "p-cpu", kabum, 1100, false)]);
    expect(currentBuildTotal(partes, [gpu, semEstoque])).toEqual({ total: 1850, missing: ["p-cpu"] });
    expect(currentBuildTotal(partes, [gpu])).toEqual({ total: 1850, missing: ["p-cpu"] });
  });

  it("R-01: a oferta suspeita da marketplace não vira o total (mesma régua do Melhor preço)", () => {
    const rtx = MOCK_PRODUCTS.find((p) => p.slug === "rtx-4060")!;
    const r = currentBuildTotal([{ productId: rtx.id, offerId: "o-4060-kabum", price: 1899.9 }], MOCK_PRODUCTS);
    expect(r).toEqual({ total: 1899.9, missing: [] });
  });

  it("arredonda para centavos", () => {
    const a = produto("a", "a", [oferta("oa", "a", kabum, 0.1)]);
    const b = produto("b", "b", [oferta("ob", "b", kabum, 0.2)]);
    const r = currentBuildTotal(
      [
        { productId: "a", offerId: "oa", price: 0.1 },
        { productId: "b", offerId: "ob", price: 0.2 },
      ],
      [a, b],
    );
    expect(r.total).toBe(0.3);
  });

  it("lista vazia soma zero (a rota de alertas ignora montagem sem peças)", () => {
    expect(currentBuildTotal([], [gpu])).toEqual({ total: 0, missing: [] });
  });
});
