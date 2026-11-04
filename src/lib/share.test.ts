import { describe, expect, it } from "vitest";
import type { BuildPreferences } from "@/models/builder-types";
import { decodeBuild, encodeBuild, safeHref, shoppingListCsv } from "./share";

const prefs: BuildPreferences = {
  budget: { target: 6000, hardCap: 7000 },
  trustedOnly: true,
  aesthetics: 25,
  usage: "jogos",
  resolution: "1440p",
};
const parts = [
  { slug: "rtx-4060", storeId: "kabum" },
  { slug: "ryzen-5-7600", storeId: "pichau" },
];

describe("encodeBuild / decodeBuild", () => {
  it("ida e volta preserva preferências e peças", () => {
    const code = encodeBuild(prefs, parts);
    expect(decodeBuild(code)).toEqual({ prefs, parts });
  });

  it("gera código seguro para URL (base64url, sem + / =)", () => {
    const code = encodeBuild({ ...prefs, budget: { target: 6000.5, hardCap: 7000.75 } }, parts);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeBuild(code)?.prefs.budget).toEqual({ target: 6000.5, hardCap: 7000.75 });
  });

  it("aceita peças com acentos e caracteres especiais", () => {
    const especiais = [{ slug: "gabinete-ção", storeId: "loja/ü" }];
    expect(decodeBuild(encodeBuild(prefs, especiais))?.parts).toEqual(especiais);
  });

  it("sem usage/resolution, devolve sem esses campos", () => {
    const simples: BuildPreferences = { budget: { target: 5000, hardCap: 5000 }, trustedOnly: false, aesthetics: 80 };
    expect(decodeBuild(encodeBuild(simples, []))).toEqual({ prefs: simples, parts: [] });
  });

  it("devolve null para código inválido", () => {
    expect(decodeBuild("")).toBeNull();
    expect(decodeBuild("lixo!!")).toBeNull();
    expect(decodeBuild("bm90LWpzb24")).toBeNull(); // "not-json"
    expect(decodeBuild(Buffer.from("[1,2,3]").toString("base64url"))).toBeNull();
    expect(decodeBuild("x".repeat(5000))).toBeNull();
  });

  it("devolve null para valores fora do permitido", () => {
    const ruim = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    expect(decodeBuild(ruim({ v: 1, t: -1, c: 7000, o: 1, a: 25, p: [] }))).toBeNull();
    expect(decodeBuild(ruim({ v: 1, t: 6000, c: 7000, o: 1, a: 25, p: "x" }))).toBeNull();
    expect(decodeBuild(ruim({ v: 1, t: 2e9, c: 2e9, o: 1, a: 25, p: [] }))).toBeNull();
    expect(decodeBuild(ruim({ v: 9, t: 6000, c: 7000, o: 1, a: 25, p: [] }))).toBeNull();
    expect(decodeBuild(ruim({ v: 1, t: 6000, c: 7000, o: 1, a: 25, p: [[1, 2]] }))).toBeNull();
  });

  it("ignora usage/resolution desconhecidos e limita o slider a 0..100", () => {
    const ruim = Buffer.from(JSON.stringify({ v: 1, t: 6000, c: 5000, o: 0, a: 300, u: "x", r: "4k", p: [] })).toString(
      "base64url",
    );
    const out = decodeBuild(ruim);
    expect(out?.prefs).toEqual({ budget: { target: 6000, hardCap: 5000 }, trustedOnly: false, aesthetics: 100 });
  });
});

describe("shoppingListCsv", () => {
  const store = { id: "kabum", name: "Kabum; Oficial", rating: 4.8, rating_count: 10, is_official: true, url: null };
  const parte = (over: Record<string, unknown> = {}) =>
    ({
      category: "gpu",
      product: { id: "p1", slug: "rtx-4060", name: 'Placa "RTX" 4060', category: "gpu", brand: null, description: null, image_url: null, offers: [] },
      offer: {
        id: "o1",
        product_id: "p1",
        store_id: "kabum",
        url: "https://kabum.com.br/x",
        price_pix: 1899.9,
        price_installment: 2099.9,
        installment_count: 10,
        in_stock: true,
        store,
      },
      spec: { slug: "rtx-4060", category: "gpu", perf: 100, aesthetics: 50 },
      price: 1899.9,
      ...over,
    }) as unknown as import("@/models/builder-types").BuildPart;

  it("gera cabeçalho, uma linha por peça e o total, com ; e vírgula decimal", () => {
    const csv = shoppingListCsv([parte()]);
    const linhas = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(linhas[0]).toBe("Categoria;Peça;Loja;Preço Pix (R$);Parcelado (R$);Parcelas;Link");
    expect(linhas[1]).toBe('Placa de vídeo;"Placa ""RTX"" 4060";"Kabum; Oficial";1899,90;2099,90;10;https://kabum.com.br/x');
    expect(linhas[2]).toBe("Total;;;1899,90;2099,90;;");
    expect(csv.startsWith("﻿")).toBe(true);
  });

  it("sem parcelado usa o Pix, e não exporta link inseguro nem fórmula", () => {
    const p = parte();
    p.offer = { ...p.offer, url: "javascript:alert(1)", price_installment: null, installment_count: null };
    p.product = { ...p.product, name: "=HYPERLINK(1)" };
    const linha = shoppingListCsv([p]).trim().split("\r\n")[1];
    expect(linha).toBe("Placa de vídeo;'=HYPERLINK(1);\"Kabum; Oficial\";1899,90;1899,90;1;");
  });

  // F-13: o CSV usa a mesma conta da tela (offerInstallment), para a lista que a
  // pessoa leva para a loja não divergir de "Como pagar".
  it("preço a prazo válido sem número de parcelas: 1x pelo preço a prazo (como na tela)", () => {
    const p = parte();
    p.offer = { ...p.offer, price_pix: 200, price_installment: 230, installment_count: null };
    const linhas = shoppingListCsv([p]).trim().split("\r\n");
    expect(linhas[1]).toBe('Placa de vídeo;"Placa ""RTX"" 4060";"Kabum; Oficial";200,00;230,00;1;https://kabum.com.br/x');
    expect(linhas[2]).toBe("Total;;;200,00;230,00;;");
  });

  it("preço a prazo abaixo do Pix vale o Pix (S-06)", () => {
    const p = parte();
    p.offer = { ...p.offer, price_pix: 1000, price_installment: 900, installment_count: 10 };
    expect(shoppingListCsv([p]).trim().split("\r\n")[1]).toContain(";1000,00;1000,00;10;");
  });

  it("com o resumo de pagamento, respeita a tabela da loja: oferta 12x e tabela até 10x → 10x", () => {
    const p = parte();
    p.offer = { ...p.offer, price_pix: 1000, price_installment: 1120, installment_count: 12 };
    const payment = {
      pixTotal: 1000,
      installmentTotal: 1120,
      maxInstallments: 10,
      pixSavings: 120,
      stores: [{ store, items: 1, pixTotal: 1000, installmentTotal: 1120, installmentCount: 10, offersInstallmentCount: 12, interestTable: [{ count: 10, factor: 1.15 }] }],
    };
    expect(shoppingListCsv([p], payment).trim().split("\r\n")[1]).toContain(";1000,00;1120,00;10;");
    // Sem o resumo, vale o que a oferta anuncia.
    expect(shoppingListCsv([p]).trim().split("\r\n")[1]).toContain(";1000,00;1120,00;12;");
  });
});

describe("safeHref", () => {
  it("aceita só http e https", () => {
    expect(safeHref("https://www.kabum.com.br/produto/1")).toBe("https://www.kabum.com.br/produto/1");
    expect(safeHref(" http://loja.com ")).toBe("http://loja.com/");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("JAVASCRIPT:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,oi")).toBeNull();
    expect(safeHref("/relativo")).toBeNull();
    expect(safeHref("")).toBeNull();
    expect(safeHref(null)).toBeNull();
    expect(safeHref(undefined)).toBeNull();
  });
});
