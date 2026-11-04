import { describe, expect, it } from "vitest";
import { formatBRL } from "./currency";
import { MAX_MONEY, formatMoneyPreview, moneyError, parseMoney } from "./money";

describe("parseMoney", () => {
  it("entende ponto como separador de milhar", () => {
    expect(parseMoney("6.000")).toBe(6000);
    expect(parseMoney("1.234.567")).toBe(1234567);
  });
  it("entende vírgula como decimal", () => {
    expect(parseMoney("6000,50")).toBe(6000.5);
    expect(parseMoney("6.000,50")).toBe(6000.5);
    expect(parseMoney("0,5")).toBe(0.5);
  });
  // S-01 / F-14 / T-3: no celular, o teclado decimal em inglês só tem ponto.
  // "6000.5" é R$ 6.000,50, nunca R$ 60.005.
  it("sem vírgula, UM ponto seguido de 1 ou 2 dígitos no fim é decimal", () => {
    expect(parseMoney("6000.50")).toBe(6000.5);
    expect(parseMoney("6000.5")).toBe(6000.5);
    expect(parseMoney("1500.5")).toBe(1500.5);
    expect(parseMoney("6.5")).toBe(6.5);
    expect(parseMoney("1.5")).toBe(1.5);
    expect(parseMoney("5999.90")).toBe(5999.9);
  });
  it("sem vírgula, grupos de 3 dígitos depois do ponto são milhar", () => {
    expect(parseMoney("1.234")).toBe(1234);
    expect(parseMoney("12.345")).toBe(12345);
    expect(parseMoney("123.456.789")).toBe(123456789);
  });
  it("sem vírgula, qualquer outra forma com ponto é inválida (não chuta)", () => {
    expect(parseMoney("6.0000")).toBeNaN();
    expect(parseMoney("1.2.3")).toBeNaN();
    expect(parseMoney("1.23.456")).toBeNaN();
    expect(parseMoney("6.000.00")).toBeNaN();
    expect(parseMoney("1234.567")).toBeNaN();
    expect(parseMoney("6000.")).toBeNaN();
    expect(parseMoney(".")).toBeNaN();
  });
  it("com vírgula, os pontos só podem ser de milhar", () => {
    expect(parseMoney("1.234.567,89")).toBe(1234567.89);
    expect(parseMoney("1.2,50")).toBeNaN();
    expect(parseMoney("6.0000,00")).toBeNaN();
    expect(parseMoney("6000.000,00")).toBeNaN();
  });
  it("aceita espaços e prefixo R$", () => {
    expect(parseMoney("  R$ 5.500 ")).toBe(5500);
    expect(parseMoney("4500")).toBe(4500);
    expect(parseMoney("0")).toBe(0);
  });
  it("devolve NaN para vazio, lixo e negativo", () => {
    expect(parseMoney("")).toBeNaN();
    expect(parseMoney("   ")).toBeNaN();
    expect(parseMoney("abc")).toBeNaN();
    expect(parseMoney("12abc")).toBeNaN();
    expect(parseMoney("-100")).toBeNaN();
    expect(parseMoney("1,2,3")).toBeNaN();
    expect(parseMoney(",")).toBeNaN();
  });
});

describe("formatMoneyPreview", () => {
  it("mostra o valor que entendemos, para a dica do campo", () => {
    expect(formatMoneyPreview("6000.5")).toBe(`= ${formatBRL(6000.5)}`);
    expect(formatMoneyPreview("6.000")).toBe(`= ${formatBRL(6000)}`);
    expect(formatMoneyPreview(" R$ 1.500,50 ")).toBe(`= ${formatBRL(1500.5)}`);
    expect(formatMoneyPreview("6000.5")?.replace(/\s/g, " ")).toBe("= R$ 6.000,50");
  });
  it("devolve null quando não há o que mostrar (vazio ou inválido)", () => {
    expect(formatMoneyPreview("")).toBeNull();
    expect(formatMoneyPreview("   ")).toBeNull();
    expect(formatMoneyPreview("1.2.3")).toBeNull();
    expect(formatMoneyPreview("abc")).toBeNull();
  });
});

describe("moneyError", () => {
  it("aceita valores positivos dentro do limite", () => {
    expect(moneyError(6000)).toBeNull();
    expect(moneyError(MAX_MONEY)).toBeNull();
  });
  it("recusa zero, negativo e NaN", () => {
    expect(moneyError(0)).toBe("Informe um valor maior que zero.");
    expect(moneyError(-5)).toBe("Informe um valor maior que zero.");
    expect(moneyError(NaN)).toBe("Informe um valor maior que zero.");
  });
  it("recusa acima do limite", () => {
    expect(MAX_MONEY).toBe(1_000_000);
    expect(moneyError(MAX_MONEY + 1)).toBe("Valor acima do permitido (R$ 1.000.000).");
  });
  it("respeita limite customizado", () => {
    expect(moneyError(600, { max: 500 })).toBe("Valor acima do permitido (R$ 500).");
  });
});
