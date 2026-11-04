import { describe, expect, it } from "vitest";
import { MAX_MONEY, moneyError, parseMoney } from "./money";

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
  it("ponto seguido de exatamente 2 dígitos no fim é decimal", () => {
    expect(parseMoney("6000.50")).toBe(6000.5);
    expect(parseMoney("6000.5")).toBe(60005);
    expect(parseMoney("6.000.00")).toBe(6000);
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
