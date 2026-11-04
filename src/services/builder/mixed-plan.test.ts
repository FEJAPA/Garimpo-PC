import { describe, it, expect } from "vitest";
import { mixedPlan, mixedPlanPrompt } from "./mixed-plan";
import { makePart, LOJA_DUVIDOSA, LOJA_KABUM, LOJA_PICHAU } from "./test-fixtures";
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
    expect(r).toMatchObject({ pixTotal: 1800, months: 0, monthly: 0, installmentTotal: 0, fits: true, schedule: [] });
  });

  it("nada no Pix: parcela tudo no menor número de meses que cabe", () => {
    const r = mixedPlan(pecas, { cash: 0, monthly: 400 });
    expect(r.pixItems).toEqual([]);
    expect(slugs(r.installmentItems)).toEqual(["gpu", "cpu", "ram"]);
    // 1980 / 5 = 396 ≤ 400 (4x seria 495).
    expect(r).toMatchObject({ pixTotal: 0, months: 5, monthly: 396, installmentTotal: 1980, fits: true });
    expect(r.schedule).toEqual([{ count: 5, monthly: 396 }]);
  });

  it("caso misto: as peças que mais encarecem no cartão vão para o Pix até acabar o dinheiro", () => {
    const r = mixedPlan(pecas, { cash: 1200, monthly: 150 });
    expect(slugs(r.pixItems)).toEqual(["gpu"]);
    expect(slugs(r.installmentItems)).toEqual(["cpu", "ram"]);
    // Resto parcelado: 550 + 330 = 880, máximo 6x (Pichau). 550 / 6 deixa 4
    // centavos de resto, que vão na 1ª parcela: 146,70 e depois 146,66.
    expect(r).toMatchObject({ pixTotal: 1000, months: 6, monthly: 146.7, installmentTotal: 880, fits: true });
    expect(r.schedule).toEqual([{ count: 6, monthly: 146.66 }]);
    expect(r.rounding).toBe(0.04);
  });

  it("se uma peça não cabe no Pix, tenta as outras (aproveita o que sobra)", () => {
    const r = mixedPlan(pecas, { cash: 1300, monthly: 100 });
    expect(slugs(r.pixItems)).toEqual(["gpu", "ram"]);
    expect(slugs(r.installmentItems)).toEqual(["cpu"]);
    expect(r).toMatchObject({ pixTotal: 1300, months: 6, monthly: 91.7, installmentTotal: 550, fits: true });
  });

  it("não cabe: avisa quanto falta por mês", () => {
    const r = mixedPlan(pecas, { cash: 0, monthly: 100 });
    expect(r.fits).toBe(false);
    // No máximo (10x, a Kabum; a Pichau para em 6x) a 1ª parcela é 165 + 55 = 220.
    expect(r).toMatchObject({ months: 10, monthly: 220, installmentTotal: 1980 });
    expect(r.schedule).toEqual([
      { count: 6, monthly: 220 },
      { count: 4, monthly: 165 },
    ]);
    expect(r.notes).toContain(`Falta ${formatBRL(120)} por mês para caber no seu orçamento.`);
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

  it("empate no custo evitado: a peça mais cara vai primeiro", () => {
    // Ofertas com preço a prazo = Pix: nenhuma encarece no cartão.
    const a = makePart({ slug: "a", category: "gpu", perf: 100, aesthetics: 50 }, { store: LOJA_PICHAU, price: 700, installment: 700, count: 10 });
    const b = makePart({ slug: "b", category: "cpu", perf: 100, aesthetics: 50 }, { store: LOJA_PICHAU, price: 400, installment: 400, count: 10 });
    const r = mixedPlan([b, a], { cash: 800, monthly: 1000 });
    expect(slugs(r.pixItems)).toEqual(["a"]);
  });
});

describe("mistura Pix + parcelado (com tabela de juros)", () => {
  // Tabela de demonstração: Kabum até 10x pelo preço a prazo (fator 1,10) e
  // 11x/12x com fator 1,16; Pichau até 12x com fator 1,10.
  it("usa a faixa sem acréscimo da loja quando cabe", () => {
    // Custo evitado: GPU 160 (1000 × 1,16), CPU 80, RAM 30. Com R$ 300 à vista
    // só a RAM cabe no Pix; GPU + CPU (Kabum, a prazo 1650) parcelam até 10x.
    const r = mixedPlan(pecas, { cash: 300, monthly: 200 }, INSTALLMENT_TABLES);
    expect(slugs(r.pixItems)).toEqual(["ram"]);
    // 1650 / 8 = 206,25 > 200; 1650 / 9 = 183,33 (+3 centavos na 1ª).
    expect(r).toMatchObject({ pixTotal: 300, months: 9, monthly: 183.36, installmentTotal: 1650, fits: true });
    expect(r.notes.some((n) => n.includes("acima do preço a prazo"))).toBe(false);
  });

  it("passa para a faixa com acréscimo quando precisa de mais meses", () => {
    // 10x = 165 > 160; 11x = 1500 × 1,16 = 1740 / 11 = 158,18 (+2 centavos na 1ª).
    const r = mixedPlan(pecas, { cash: 300, monthly: 160 }, INSTALLMENT_TABLES);
    expect(r).toMatchObject({ months: 11, monthly: 158.2, installmentTotal: 1740, fits: true });
    expect(r.notes.some((n) => n.includes("acréscimo"))).toBe(true);
  });

  it("não cabe nem no máximo da tabela", () => {
    // 12x = 1740 / 12 = 145 > 140.
    const r = mixedPlan(pecas, { cash: 300, monthly: 140 }, INSTALLMENT_TABLES);
    expect(r).toMatchObject({ months: 12, monthly: 145, fits: false });
    expect(r.notes).toContain(`Falta ${formatBRL(5)} por mês para caber no seu orçamento.`);
  });

  // R-06: o Pix vai primeiro para a peça que mais encarece no cartão.
  it("peça de loja com +15% vai ao Pix antes de uma mais cara sem juros", () => {
    const tabelas = { duvidosa: [{ count: 12, factor: 1.15 }] };
    // A oferta só anuncia o Pix; no cartão vale a tabela da loja (+15%). Se ela
    // anunciasse 12x por R$ 800, valeria o anunciado (S-03) e não haveria juros.
    const comJuros = makePart({ slug: "com-juros", category: "gpu", perf: 100, aesthetics: 50 }, { store: LOJA_DUVIDOSA, price: 800, installment: null, count: null });
    const semJuros = makePart({ slug: "sem-juros", category: "cpu", perf: 100, aesthetics: 50 }, { store: LOJA_PICHAU, price: 1000, installment: 1000, count: 10 });
    const r = mixedPlan([semJuros, comJuros], { cash: 1000, monthly: 200 }, tabelas);
    // Pelo preço iria a de R$ 1.000; pelo custo evitado vai a de R$ 800 (120 de juros).
    expect(slugs(r.pixItems)).toEqual(["com-juros"]);
    expect(slugs(r.installmentItems)).toEqual(["sem-juros"]);
    expect(r).toMatchObject({ pixTotal: 800, installmentTotal: 1000, fits: true });
  });

  // S-03: o custo evitado usa a mesma conta de "Como pagar". Uma oferta que
  // anuncia 12x pelo preço a prazo não encarece além dele, mesmo com tabela.
  it("o custo evitado respeita o que a oferta anuncia", () => {
    const tabelas = { duvidosa: [{ count: 12, factor: 1.15 }] };
    // Anuncia 12x por 800 (= Pix): no cartão custa o mesmo que no Pix.
    const anunciada = makePart({ slug: "anunciada", category: "gpu", perf: 100, aesthetics: 50 }, { store: LOJA_DUVIDOSA, price: 800, installment: 800, count: 12 });
    // Pichau sem tabela: 1000 no Pix, 1050 a prazo (custa 50 a mais no cartão).
    const aPrazo = makePart({ slug: "a-prazo", category: "cpu", perf: 100, aesthetics: 50 }, { store: LOJA_PICHAU, price: 1000, installment: 1050, count: 10 });
    const r = mixedPlan([anunciada, aPrazo], { cash: 1000, monthly: 1000 }, tabelas);
    expect(slugs(r.pixItems)).toEqual(["a-prazo"]);
  });
});

// S-06: preço a prazo abaixo do Pix é dado ruim e não pode "baratear" o cartão.
describe("mistura com preço a prazo abaixo do Pix (S-06)", () => {
  it("o custo evitado nunca é negativo (empate: a peça mais cara vai primeiro)", () => {
    // A "ruim" (a prazo 400 < Pix 500) tem custo 0, como a "igual"; empate: a mais cara.
    const ruim = makePart({ slug: "ruim", category: "gpu", perf: 100, aesthetics: 50 }, { store: LOJA_PICHAU, price: 500, installment: 400, count: 10 });
    const igual = makePart({ slug: "igual", category: "cpu", perf: 100, aesthetics: 50 }, { store: LOJA_PICHAU, price: 200, installment: 200, count: 10 });
    const r = mixedPlan([igual, ruim], { cash: 500, monthly: 1000 });
    expect(slugs(r.pixItems)).toEqual(["ruim"]);
    // No cartão, a "igual" sai pelo preço do Pix, nunca abaixo dele.
    expect(r.installmentTotal).toBe(200);
  });

  it("no cartão, a peça nunca sai mais barata que no Pix", () => {
    const ruim = makePart({ slug: "ruim", category: "gpu", perf: 100, aesthetics: 50 }, { store: LOJA_PICHAU, price: 500, installment: 400, count: 10 });
    const r = mixedPlan([ruim], { cash: 0, monthly: 1000 });
    expect(r.installmentTotal).toBe(500);
    expect(r.notes).toContain("O parcelamento sai pelo mesmo preço do Pix.");
  });
});

// F-11: com "Cabe por mês" vazio, o plano diria "Falta R$ X por mês" sem a pessoa
// ter dito quanto cabe. Escolha: só calcular com os DOIS campos preenchidos
// (0 vale); vazio não é tratado como "sem limite" para não adivinhar.
describe("mixedPlanPrompt: o que falta preencher no modo Misturar", () => {
  it("pede os dois valores quando nada foi preenchido", () => {
    expect(mixedPlanPrompt("", "  ")).toBe("Diga quanto você tem à vista e quanto cabe por mês para ver a melhor divisão.");
  });

  it("pede o que falta quando só um foi preenchido", () => {
    expect(mixedPlanPrompt("3000", "")).toBe("Preencha também quanto cabe por mês (pode ser 0).");
    expect(mixedPlanPrompt("", "500")).toBe("Preencha também quanto você tem à vista (pode ser 0).");
  });

  it("com os dois preenchidos (0 vale), não pede nada", () => {
    expect(mixedPlanPrompt("3000", "500")).toBeNull();
    expect(mixedPlanPrompt("0", "0")).toBeNull();
  });
});
