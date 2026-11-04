import { describe, it, expect } from "vitest";
import { mixedPlan } from "./mixed-plan";
import { makePart, LOJA_KABUM, LOJA_PICHAU } from "./test-fixtures";
import { INSTALLMENT_TABLES } from "@/models/installment-tables";
import { formatBRL } from "@/lib/format";

const gpu = makePart({ slug: "gpu", category: "gpu", perf: 100, aesthetics: 50 }, { store: LOJA_KABUM, price: 1000, installment: 1100, count: 10 });
const cpu = makePart({ slug: "cpu", category: "cpu", perf: 100, aesthetics: 50 }, { store: LOJA_KABUM, price: 500, installment: 550, count: 12 });
const ram = makePart({ slug: "ram", category: "ram", perf: 100, aesthetics: 50 }, { store: LOJA_PICHAU, price: 300, installment: 330, count: 6 });
const pecas = [cpu, ram, gpu];

const slugs = (xs: { spec: { slug: string } }[]) => xs.map((p) => p.spec.slug);

describe("mistura Pix + parcelado (sem tabela de juros, V1)", () => {
  it("tudo no Pix quando o dinheiro à vista cobre o total", () => {
    const r = mixedPlan(pecas, { cash: 2000, monthly: 0 });
    expect(slugs(r.pixItems)).toEqual(["gpu", "cpu", "ram"]);
    expect(r.installmentItems).toEqual([]);
    expect(r).toMatchObject({ pixTotal: 1800, months: 0, monthly: 0, installmentTotal: 0, fits: true });
  });

  it("nada no Pix: parcela tudo no menor número de meses que cabe", () => {
    const r = mixedPlan(pecas, { cash: 0, monthly: 400 });
    expect(r.pixItems).toEqual([]);
    expect(slugs(r.installmentItems)).toEqual(["gpu", "cpu", "ram"]);
    // 1980 / 5 = 396 ≤ 400 (4x seria 495).
    expect(r).toMatchObject({ pixTotal: 0, months: 5, monthly: 396, installmentTotal: 1980, fits: true });
  });

  it("caso misto: as peças mais caras vão para o Pix até acabar o dinheiro", () => {
    const r = mixedPlan(pecas, { cash: 1200, monthly: 150 });
    expect(slugs(r.pixItems)).toEqual(["gpu"]);
    expect(slugs(r.installmentItems)).toEqual(["cpu", "ram"]);
    // Resto parcelado: 550 + 330 = 880, máximo 6x (Pichau) → 146,67 ≤ 150.
    expect(r).toMatchObject({ pixTotal: 1000, months: 6, monthly: 146.67, installmentTotal: 880, fits: true });
  });

  it("se uma peça cara não cabe no Pix, tenta as mais baratas", () => {
    const r = mixedPlan(pecas, { cash: 1300, monthly: 100 });
    expect(slugs(r.pixItems)).toEqual(["gpu", "ram"]);
    expect(slugs(r.installmentItems)).toEqual(["cpu"]);
    expect(r).toMatchObject({ pixTotal: 1300, months: 6, monthly: 91.67, installmentTotal: 550, fits: true });
  });

  it("não cabe: avisa quanto falta por mês", () => {
    const r = mixedPlan(pecas, { cash: 0, monthly: 100 });
    expect(r.fits).toBe(false);
    // No máximo (6x) a parcela é 330.
    expect(r).toMatchObject({ months: 6, monthly: 330, installmentTotal: 1980 });
    expect(r.notes).toContain(`Falta ${formatBRL(230)} por mês para caber no seu orçamento.`);
  });

  it("valores inválidos ou negativos contam como zero", () => {
    const r = mixedPlan(pecas, { cash: -50, monthly: Number.NaN });
    expect(r.pixItems).toEqual([]);
    expect(r.fits).toBe(false);
  });

  it("sem peças: nada a pagar", () => {
    const r = mixedPlan([], { cash: 0, monthly: 0 });
    expect(r).toMatchObject({ pixTotal: 0, months: 0, monthly: 0, installmentTotal: 0, fits: true });
  });
});

describe("mistura Pix + parcelado (com tabela de juros)", () => {
  it("usa a faixa sem juros da loja quando cabe", () => {
    // RAM vai no Pix; GPU + CPU (Kabum, Pix 1500) parcelam sem juros até 10x.
    const r = mixedPlan(pecas, { cash: 300, monthly: 200 }, INSTALLMENT_TABLES);
    expect(slugs(r.pixItems)).toEqual(["ram"]);
    expect(r).toMatchObject({ pixTotal: 300, months: 8, monthly: 187.5, installmentTotal: 1500, fits: true });
  });

  it("passa para a faixa com juros quando precisa de mais meses", () => {
    // 10x = 150 > 145; 11x = 1590 / 11 = 144,55 ≤ 145.
    const r = mixedPlan(pecas, { cash: 300, monthly: 145 }, INSTALLMENT_TABLES);
    expect(r).toMatchObject({ months: 11, monthly: 144.55, installmentTotal: 1590, fits: true });
    expect(r.notes.some((n) => n.includes("acréscimo"))).toBe(true);
  });

  it("não cabe nem no máximo da tabela", () => {
    // 12x = 1590 / 12 = 132,50 > 130.
    const r = mixedPlan(pecas, { cash: 300, monthly: 130 }, INSTALLMENT_TABLES);
    expect(r).toMatchObject({ months: 12, monthly: 132.5, fits: false });
    expect(r.notes).toContain(`Falta ${formatBRL(2.5)} por mês para caber no seu orçamento.`);
  });
});
