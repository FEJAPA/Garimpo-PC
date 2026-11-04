import { describe, it, expect } from "vitest";
import { buildPaymentSummary, installmentPlan } from "./payments";
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
