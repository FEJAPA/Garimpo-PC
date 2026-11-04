import { describe, it, expect } from "vitest";
import {
  buildPaymentSummary,
  defaultInstallmentCount,
  formatSchedule,
  installmentBands,
  installmentOptions,
  installmentPlan,
  interestFreeUpTo,
  rateFor,
  storeInstallment,
  storeNoExtraUpTo,
  validInstallmentPrice,
} from "./payments";
import { makePart, LOJA_KABUM, LOJA_PICHAU } from "./test-fixtures";
import { INSTALLMENT_TABLES } from "@/models/installment-tables";
import { MOCK_PRODUCTS } from "@/models/mock-data";
import { formatBRL } from "@/lib/format";
import type { BuildPart } from "@/models/builder-types";

const gpu = makePart({ slug: "gpu", category: "gpu", perf: 100, aesthetics: 50 }, { store: LOJA_KABUM, price: 1000, installment: 1100, count: 10 });
const cpu = makePart({ slug: "cpu", category: "cpu", perf: 100, aesthetics: 50 }, { store: LOJA_KABUM, price: 500, installment: 550, count: 12 });
const ram = makePart({ slug: "ram", category: "ram", perf: 100, aesthetics: 50 }, { store: LOJA_PICHAU, price: 300, installment: 330, count: 6 });
const ssdSemParcela = makePart({ slug: "ssd", category: "ssd", perf: 100, aesthetics: 50 }, { store: LOJA_PICHAU, price: 200, installment: null, count: null });

/** Peça de teste com oferta "crua" (para simular dado ruim vindo do banco). */
function pecaCrua(slug: string, price: number, installment: number | null, count: number | null): BuildPart {
  return makePart({ slug, category: "ssd", perf: 100, aesthetics: 50 }, { store: LOJA_PICHAU, price, installment, count });
}

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
    // Sem parcelamento, a comparação do Pix é com o cartão em 1x (mesmo preço).
    expect(r.bestInstallment).toEqual({ count: 1, total: 200 });
    expect(r.pixSavings).toBe(0);
  });

  it("sem peças: nada a pagar", () => {
    const r = buildPaymentSummary([]);
    expect(r).toMatchObject({ pixTotal: 0, installmentTotal: 0, maxInstallments: 1, pixSavings: 0, stores: [] });
  });
});

// LOG-10: preço parcelado <= 0 ou não finito é dado ruim = oferta sem parcelamento.
describe("preço parcelado inválido (LOG-10)", () => {
  it.each([0, -50, Number.NaN, Number.POSITIVE_INFINITY])("price_installment = %s conta como ausente", (inst) => {
    const r = buildPaymentSummary([pecaCrua("x", 200, inst, 10)]);
    expect(r.installmentTotal).toBe(200);
    expect(r.stores[0].installmentCount).toBe(1);
    expect(r.maxInstallments).toBe(1);
  });

  it("validInstallmentPrice só aceita número finito maior que zero", () => {
    expect(validInstallmentPrice({ price_installment: 330 })).toBe(330);
    expect(validInstallmentPrice({ price_installment: null })).toBeNull();
    expect(validInstallmentPrice({ price_installment: 0 })).toBeNull();
    expect(validInstallmentPrice({ price_installment: Number.NaN })).toBeNull();
  });
});

// LOG-12: número de parcelas da oferta fica entre 1 e 24.
describe("número de parcelas da oferta (LOG-12)", () => {
  it("acima de 24 vira 24", () => {
    const r = buildPaymentSummary([pecaCrua("x", 200, 240, 1000)]);
    expect(r.stores[0].installmentCount).toBe(24);
    expect(r.maxInstallments).toBe(24);
  });

  it.each([0, -3, Number.NaN, null])("installment_count = %s vira 1", (count) => {
    const r = buildPaymentSummary([pecaCrua("x", 200, 240, count)]);
    expect(r.stores[0].installmentCount).toBe(1);
  });

  it("número quebrado é arredondado para baixo", () => {
    const r = buildPaymentSummary([pecaCrua("x", 200, 240, 3.7)]);
    expect(r.stores[0].installmentCount).toBe(3);
  });

  it("faixa da tabela de juros acima de 24x é ignorada", () => {
    const r = buildPaymentSummary([gpu], { kabum: [{ count: 12, factor: 1.1 }, { count: 48, factor: 1.3 }] });
    expect(r.stores[0].interestTable).toEqual([{ count: 12, factor: 1.1 }]);
    expect(r.maxInstallments).toBe(12);
  });
});

describe("plano de parcelas", () => {
  const resumo = buildPaymentSummary([gpu, cpu, ram]);

  it("limita ao máximo de parcelas disponível", () => {
    expect(installmentPlan(resumo, 12)).toEqual({ count: 6, monthly: 330, total: 1980, schedule: [{ count: 6, monthly: 330 }] });
  });

  it("nunca fica abaixo de 1 parcela", () => {
    expect(installmentPlan(resumo, 0)).toEqual({ count: 1, monthly: 1980, total: 1980, schedule: [{ count: 1, monthly: 1980 }] });
  });

  it("divide o total parcelado pelo número de parcelas", () => {
    expect(installmentPlan(resumo, 3)).toEqual({ count: 3, monthly: 660, total: 1980, schedule: [{ count: 3, monthly: 660 }] });
  });

  it("o resto dos centavos vai na primeira parcela e a soma fecha exata", () => {
    // R$ 100 em 3x: 33,34 + 33,33 + 33,33.
    const r = buildPaymentSummary([pecaCrua("x", 100, 100, 3)]);
    const p = installmentPlan(r, 3);
    expect(p).toEqual({
      count: 3,
      monthly: 33.34,
      total: 100,
      schedule: [
        { count: 1, monthly: 33.34 },
        { count: 2, monthly: 33.33 },
      ],
    });
    // Para a manchete: a faixa "de verdade" e o arredondamento à parte.
    expect(installmentBands(r, 3)).toEqual({ faixas: [{ count: 3, monthly: 33.33 }], arredondamento: 0.01 });
  });
});

// ---------------------------------------------------------------------------
// V2 (pacote E): tabela de juros por loja.
// Premissa (item 2 do Portão 1): no Brasil, "10x sem juros" é sobre o preço A
// PRAZO, que já é maior que o Pix. O fator multiplica o Pix, mas o total da loja
// nunca fica abaixo do preço a prazo informado pelas ofertas:
//   total(n) = max(Σ price_installment, pixTotal × fator(n)).
// Tabela de teste: fator 1 até 6x e 1,12 de 7x a 12x.
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

  it("o total parcelado da loja continua sendo o preço a prazo das ofertas", () => {
    const r = buildPaymentSummary([gpu, cpu], TABELAS);
    expect(r.stores[0].installmentTotal).toBe(1650);
    expect(r.installmentTotal).toBe(1650);
  });

  it("na faixa de fator 1, paga o preço a prazo da oferta, nunca o preço do Pix", () => {
    const r = buildPaymentSummary([gpu, cpu], TABELAS);
    expect(installmentPlan(r, 6)).toMatchObject({ count: 6, monthly: 275, total: 1650 });
    expect(installmentPlan(r, 3)).toMatchObject({ count: 3, monthly: 550, total: 1650 });
  });

  it("quando Pix × fator passa do preço a prazo, vale o maior", () => {
    const r = buildPaymentSummary([gpu, cpu], TABELAS);
    // 1500 × 1,12 = 1680 > 1650.
    expect(installmentPlan(r, 12)).toEqual({ count: 12, monthly: 140, total: 1680, schedule: [{ count: 12, monthly: 140 }] });
  });

  it("a tabela nunca barateia o parcelado abaixo do preço a prazo", () => {
    const r = buildPaymentSummary([gpu, cpu], { kabum: [{ count: 12, factor: 1 }] });
    expect(installmentPlan(r, 12).total).toBe(1650);
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
    expect(installmentPlan(r, 3)).toMatchObject({ count: 3, monthly: 110, total: 330 });
  });

  it("tabela vazia ou só com linhas inválidas é o mesmo que não ter tabela", () => {
    expect(buildPaymentSummary([gpu, cpu, ram], { kabum: [] })).toEqual(buildPaymentSummary([gpu, cpu, ram]));
    expect(buildPaymentSummary([gpu, cpu, ram], { kabum: [{ count: 0, factor: 1 }, { count: 6, factor: 0.5 }] })).toEqual(
      buildPaymentSummary([gpu, cpu, ram])
    );
  });

  // R-03: lojas com prazos diferentes geram faixas de parcelas.
  it("mistura de lojas: faixas decrescentes cuja soma fecha o total", () => {
    const r = buildPaymentSummary([gpu, cpu, ram], TABELAS);
    // Preço a prazo das ofertas: Kabum 1650 + Pichau 330.
    expect(r.installmentTotal).toBe(1980);
    // O máximo geral passa a ser o MAIOR entre as lojas.
    expect(r.maxInstallments).toBe(12);
    // 12x: Kabum 1680 / 12 = 140 por 12 meses; Pichau para em 6x de 55.
    const p12 = installmentPlan(r, 12);
    expect(p12).toEqual({
      count: 12,
      monthly: 195,
      total: 2010,
      schedule: [
        { count: 6, monthly: 195 },
        { count: 6, monthly: 140 },
      ],
    });
    const soma = p12.schedule!.reduce((s, f) => s + f.count * f.monthly, 0);
    expect(soma).toBeCloseTo(p12.total, 2);
    expect(formatSchedule(installmentBands(r, 12).faixas)).toBe(`6x de ${formatBRL(195)} + 6x de ${formatBRL(140)}`);
    // 6x: Kabum 1650 / 6 = 275 + Pichau 55, uma faixa só.
    expect(installmentPlan(r, 6)).toEqual({ count: 6, monthly: 330, total: 1980, schedule: [{ count: 6, monthly: 330 }] });
  });

  // R-04: a economia do Pix é contra o parcelado mais barato com mais de 1 parcela.
  it("economia do Pix é em relação ao parcelado mais barato (com n > 1)", () => {
    const r = buildPaymentSummary([gpu, cpu, ram], TABELAS);
    // Até 6x o total é 1980; de 7x a 12x é 2010. Empate: fica o maior n.
    expect(r.bestInstallment).toEqual({ count: 6, total: 1980 });
    expect(r.pixSavings).toBe(180);
  });

  it("V1: a economia do Pix compara com o parcelado no máximo de parcelas", () => {
    const r = buildPaymentSummary([gpu, cpu, ram]);
    expect(r.bestInstallment).toEqual({ count: 6, total: 1980 });
  });
});

describe("tabela de demonstração da Kabum (R-04)", () => {
  // Oferta igual à RTX 4060 da Kabum no mock: Pix 1.899,90, a prazo 2.099,90 em 10x.
  const rtx = makePart({ slug: "rtx", category: "gpu", perf: 100, aesthetics: 50 }, { store: LOJA_KABUM, price: 1899.9, installment: 2099.9, count: 10 });
  const r = buildPaymentSummary([rtx], INSTALLMENT_TABLES);

  it("até 10x vale o preço a prazo da oferta; 11x e 12x têm acréscimo", () => {
    expect(installmentPlan(r, 10).total).toBe(2099.9);
    expect(installmentPlan(r, 12).total).toBeGreaterThan(2099.9);
  });

  it("a economia do Pix é contra 10x (sem acréscimo), não contra 12x", () => {
    expect(r.bestInstallment).toEqual({ count: 10, total: 2099.9 });
    expect(r.pixSavings).toBe(200);
  });

  it("o seletor abre em 10x, o maior número de parcelas sem acréscimo", () => {
    expect(defaultInstallmentCount(r)).toBe(10);
  });
});

describe("tabelas de demonstração × ofertas de demonstração", () => {
  // Coerência do mock: em nenhuma oferta o parcelado com tabela fica abaixo do
  // preço a prazo que a própria oferta informa, no número de parcelas dela.
  it("o parcelado com tabela nunca fica abaixo do preço a prazo da oferta", () => {
    for (const produto of MOCK_PRODUCTS) {
      for (const offer of produto.offers) {
        if (!INSTALLMENT_TABLES[offer.store_id] || !offer.price_installment || !offer.installment_count) continue;
        const parte: BuildPart = { category: produto.category, product: produto, offer, spec: { slug: produto.slug, category: produto.category, perf: 1, aesthetics: 0 }, price: offer.price_pix };
        const resumo = buildPaymentSummary([parte], INSTALLMENT_TABLES);
        const plano = installmentPlan(resumo, offer.installment_count);
        expect(plano.total).toBeGreaterThanOrEqual(offer.price_installment);
      }
    }
  });

  it("Kabum, Pichau e Terabyte têm uma faixa sem acréscimo sobre o preço a prazo", () => {
    for (const loja of ["kabum", "pichau", "terabyte"]) {
      const produto = MOCK_PRODUCTS.find((p) => p.offers.some((o) => o.store_id === loja))!;
      const offer = produto.offers.find((o) => o.store_id === loja)!;
      const parte: BuildPart = { category: produto.category, product: produto, offer, spec: { slug: produto.slug, category: produto.category, perf: 1, aesthetics: 0 }, price: offer.price_pix };
      const resumo = buildPaymentSummary([parte], INSTALLMENT_TABLES);
      expect(storeNoExtraUpTo(resumo.stores[0])).toBeGreaterThanOrEqual(6);
    }
  });
});

describe("opções do seletor de parcelas", () => {
  it("cada opção diz o acréscimo sobre o preço a prazo (0 = sem acréscimo)", () => {
    const r = buildPaymentSummary([gpu, cpu], TABELAS);
    const opcoes = installmentOptions(r);
    expect(opcoes).toHaveLength(12);
    expect(opcoes[5]).toEqual({ count: 6, monthly: 275, total: 1650, extra: 0 });
    expect(opcoes[11]).toEqual({ count: 12, monthly: 140, total: 1680, extra: 30 });
  });

  it("abre no maior número de parcelas sem acréscimo", () => {
    expect(defaultInstallmentCount(buildPaymentSummary([gpu, cpu], TABELAS))).toBe(6);
  });

  it("sem tabela (V1) tudo é sem acréscimo: abre no máximo", () => {
    expect(defaultInstallmentCount(buildPaymentSummary([gpu, cpu, ram]))).toBe(6);
  });

  it("se todas as opções têm acréscimo, abre no máximo", () => {
    const r = buildPaymentSummary([gpu], { kabum: [{ count: 12, factor: 1.2 }] });
    expect(installmentOptions(r).every((o) => o.extra > 0)).toBe(true);
    expect(defaultInstallmentCount(r)).toBe(12);
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

  it("interestFreeUpTo diz até quantas vezes o fator é 1 (0 se nunca)", () => {
    expect(interestFreeUpTo(tabela)).toBe(6);
    expect(interestFreeUpTo([{ count: 10, factor: 1.05 }])).toBe(0);
    expect(interestFreeUpTo([{ count: 12, factor: 1 }])).toBe(12);
  });

  it("storeInstallment calcula o plano de uma loja só", () => {
    const r = buildPaymentSummary([gpu, cpu, ram], TABELAS);
    const pichau = r.stores.find((s) => s.store.id === "pichau")!;
    expect(storeInstallment(pichau, 12)).toEqual({ count: 6, monthly: 55, total: 330, schedule: [{ count: 6, monthly: 55 }] });
    const kabum = r.stores.find((s) => s.store.id === "kabum")!;
    expect(storeInstallment(kabum, 12)).toEqual({ count: 12, monthly: 140, total: 1680, schedule: [{ count: 12, monthly: 140 }] });
  });

  it("storeNoExtraUpTo diz até quantas vezes a loja cobra só o preço a prazo", () => {
    const r = buildPaymentSummary([gpu, cpu, ram], TABELAS);
    expect(storeNoExtraUpTo(r.stores.find((s) => s.store.id === "kabum")!)).toBe(6);
    // Sem tabela: o preço a prazo vale até o máximo da loja.
    expect(storeNoExtraUpTo(r.stores.find((s) => s.store.id === "pichau")!)).toBe(6);
    // Acréscimo já em 1x: 0.
    const caro = buildPaymentSummary([gpu], { kabum: [{ count: 12, factor: 1.2 }] });
    expect(storeNoExtraUpTo(caro.stores[0])).toBe(0);
  });

  it("formatSchedule junta as faixas com +", () => {
    expect(formatSchedule([{ count: 10, monthly: 586.17 }, { count: 2, monthly: 551.49 }])).toBe(
      `10x de ${formatBRL(586.17)} + 2x de ${formatBRL(551.49)}`
    );
    expect(formatSchedule([])).toBe("");
  });
});
