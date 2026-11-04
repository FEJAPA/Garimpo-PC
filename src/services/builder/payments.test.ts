import { describe, it, expect } from "vitest";
import { buildPaymentSummary, installmentPlan, interestFreeUpTo, rateFor, storeInstallment } from "./payments";
import { makePart, LOJA_KABUM, LOJA_PICHAU } from "./test-fixtures";

const gpu = makePart({ slug: "gpu", category: "gpu", perf: 100, aesthetics: 50 }, { store: LOJA_KABUM, price: 1000, installment: 1100, count: 10 });
const cpu = makePart({ slug: "cpu", category: "cpu", perf: 100, aesthetics: 50 }, { store: LOJA_KABUM, price: 500, installment: 550, count: 12 });
const ram = makePart({ slug: "ram", category: "ram", perf: 100, aesthetics: 50 }, { store: LOJA_PICHAU, price: 300, installment: 330, count: 6 });
const ssdSemParcela = makePart({ slug: "ssd", category: "ssd", perf: 100, aesthetics: 50 }, { store: LOJA_PICHAU, price: 200, installment: null, count: null });

describe("resumo de pagamento", () => {
  const resumo = buildPaymentSummary([gpu, cpu, ram]);

  it("soma os totais Pix e parcelado", () => {
    expect(resumo.pixTotal).toBeCloseTo(1800);
    expect(resumo.installmentTotal).toBeCloseTo(1980);
    expect(resumo.pixSavings).toBeCloseTo(180);
  });

  it("agrupa por loja, maior total primeiro, com o máximo de parcelas da loja", () => {
    expect(resumo.stores.map((s) => s.store.id)).toEqual(["kabum", "pichau"]);
    expect(resumo.stores[0]).toMatchObject({ items: 2, pixTotal: 1500, installmentTotal: 1650, installmentCount: 10 });
    expect(resumo.stores[1]).toMatchObject({ items: 1, pixTotal: 300, installmentTotal: 330, installmentCount: 6 });
  });

  it("o máximo geral de parcelas é o menor entre as lojas", () => {
    expect(resumo.maxInstallments).toBe(6);
  });

  it("oferta sem parcelamento conta como à vista (1x, preço Pix)", () => {
    const r = buildPaymentSummary([ssdSemParcela]);
    expect(r.installmentTotal).toBe(200);
    expect(r.maxInstallments).toBe(1);
    expect(r.stores[0].installmentCount).toBe(1);
  });
});

describe("plano de parcelas", () => {
  const resumo = buildPaymentSummary([gpu, cpu, ram]);

  it("limita ao máximo de parcelas disponível", () => {
    expect(installmentPlan(resumo, 12)).toEqual({ count: 6, monthly: 330, total: 1980 });
  });

  it("nunca fica abaixo de 1 parcela", () => {
    expect(installmentPlan(resumo, 0)).toEqual({ count: 1, monthly: 1980, total: 1980 });
  });

  it("divide o total parcelado pelo número de parcelas", () => {
    expect(installmentPlan(resumo, 3)).toEqual({ count: 3, monthly: 660, total: 1980 });
  });
});

// ---------------------------------------------------------------------------
// V2 (pacote E): tabela de juros por loja.
// Tabela de teste: até 6x sem juros (fator 1) e 7x a 12x com fator 1,12.
// ---------------------------------------------------------------------------
const TABELAS = {
  kabum: [
    { count: 12, factor: 1.12 },
    { count: 6, factor: 1 },
  ],
};

describe("juros por loja (tabela)", () => {
  it("preenche a tabela da loja (ordenada) e deixa sem tabela quem não tem", () => {
    const r = buildPaymentSummary([gpu, cpu, ram], TABELAS);
    const kabum = r.stores.find((s) => s.store.id === "kabum");
    const pichau = r.stores.find((s) => s.store.id === "pichau");
    expect(kabum?.interestTable).toEqual([
      { count: 6, factor: 1 },
      { count: 12, factor: 1.12 },
    ]);
    expect(pichau?.interestTable).toBeUndefined();
  });

  it("com tabela, a loja parcela até o maior número da tabela", () => {
    const r = buildPaymentSummary([gpu, cpu], TABELAS);
    expect(r.stores[0].installmentCount).toBe(12);
    expect(r.maxInstallments).toBe(12);
  });

  it("6x sem juros custa o mesmo que o Pix", () => {
    const r = buildPaymentSummary([gpu, cpu], TABELAS);
    expect(installmentPlan(r, 6)).toEqual({ count: 6, monthly: 250, total: 1500 });
  });

  it("menos parcelas que a faixa sem juros também sai pelo preço do Pix", () => {
    const r = buildPaymentSummary([gpu, cpu], TABELAS);
    expect(installmentPlan(r, 3)).toEqual({ count: 3, monthly: 500, total: 1500 });
  });

  it("12x = Pix × 1,12", () => {
    const r = buildPaymentSummary([gpu, cpu], TABELAS);
    expect(installmentPlan(r, 12)).toEqual({ count: 12, monthly: 140, total: 1680 });
  });

  it("entre as faixas usa a faixa de cima (a mais cara, para não prometer menos)", () => {
    const r = buildPaymentSummary([gpu, cpu], TABELAS);
    expect(installmentPlan(r, 8).total).toBe(1680);
  });

  it("não passa do máximo da tabela", () => {
    const r = buildPaymentSummary([gpu, cpu], TABELAS);
    expect(installmentPlan(r, 20).count).toBe(12);
  });

  it("loja sem tabela continua com o comportamento V1", () => {
    const r = buildPaymentSummary([ram], TABELAS);
    expect(r.maxInstallments).toBe(6);
    expect(installmentPlan(r, 3)).toEqual({ count: 3, monthly: 110, total: 330 });
  });

  it("tabela vazia é o mesmo que não ter tabela", () => {
    const r = buildPaymentSummary([gpu, cpu, ram], { kabum: [] });
    expect(r).toEqual(buildPaymentSummary([gpu, cpu, ram]));
  });

  it("mistura de lojas: cada loja limita as suas parcelas e os valores somam", () => {
    const r = buildPaymentSummary([gpu, cpu, ram], TABELAS);
    // Kabum: 1500 × 1,12 = 1680 (12x); Pichau (sem tabela): 330 em até 6x.
    expect(r.installmentTotal).toBe(2010);
    expect(r.pixSavings).toBe(210);
    // O máximo geral passa a ser o MAIOR entre as lojas.
    expect(r.maxInstallments).toBe(12);
    // 12x: Kabum 1680/12 = 140; Pichau fica em 6x de 55. Primeiras parcelas = 195.
    expect(installmentPlan(r, 12)).toEqual({ count: 12, monthly: 195, total: 2010 });
    // 6x: Kabum 1500/6 = 250 (sem juros) + Pichau 55.
    expect(installmentPlan(r, 6)).toEqual({ count: 6, monthly: 305, total: 1830 });
  });
});

describe("ajudantes da tabela de juros", () => {
  const tabela = [
    { count: 6, factor: 1 },
    { count: 12, factor: 1.12 },
  ];

  it("rateFor devolve o fator da faixa que cobre o número de parcelas", () => {
    expect(rateFor(tabela, 1)).toBe(1);
    expect(rateFor(tabela, 6)).toBe(1);
    expect(rateFor(tabela, 7)).toBe(1.12);
    expect(rateFor(tabela, 12)).toBe(1.12);
    expect(rateFor(tabela, 30)).toBe(1.12);
  });

  it("interestFreeUpTo diz até quantas vezes é sem juros (0 se nunca)", () => {
    expect(interestFreeUpTo(tabela)).toBe(6);
    expect(interestFreeUpTo([{ count: 10, factor: 1.05 }])).toBe(0);
    expect(interestFreeUpTo([{ count: 12, factor: 1 }])).toBe(12);
  });

  it("storeInstallment calcula o plano de uma loja só", () => {
    const r = buildPaymentSummary([gpu, cpu, ram], TABELAS);
    const pichau = r.stores.find((s) => s.store.id === "pichau")!;
    expect(storeInstallment(pichau, 12)).toEqual({ count: 6, monthly: 55, total: 330 });
    const kabum = r.stores.find((s) => s.store.id === "kabum")!;
    expect(storeInstallment(kabum, 12)).toEqual({ count: 12, monthly: 140, total: 1680 });
  });
});
