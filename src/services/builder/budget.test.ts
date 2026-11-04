import { describe, it, expect } from "vitest";
import { normalizeBudget, wiggleRoom, fitsHardCap, DEFAULT_BUDGET } from "./budget";

describe("orçamento (alvo, teto e folga)", () => {
  it("padrão é alvo 6000 e teto 7000", () => {
    expect(DEFAULT_BUDGET).toEqual({ target: 6000, hardCap: 7000 });
  });

  it("iguala o teto ao alvo quando o teto é menor", () => {
    expect(normalizeBudget({ target: 6000, hardCap: 5000 })).toEqual({
      target: 6000,
      hardCap: 6000,
    });
  });

  it("mantém alvo e teto quando o teto é maior", () => {
    expect(normalizeBudget({ target: 6000, hardCap: 7000 })).toEqual({
      target: 6000,
      hardCap: 7000,
    });
  });

  it("trata valores inválidos (NaN, negativos) como zero", () => {
    expect(normalizeBudget({ target: Number.NaN, hardCap: -10 })).toEqual({
      target: 0,
      hardCap: 0,
    });
  });

  it("folga é teto menos alvo", () => {
    expect(wiggleRoom({ target: 6000, hardCap: 7000 })).toBe(1000);
  });

  it("fitsHardCap aceita o valor exato do teto e rejeita acima", () => {
    const b = { target: 6000, hardCap: 7000 };
    expect(fitsHardCap(7000, b)).toBe(true);
    expect(fitsHardCap(7000.01, b)).toBe(false);
  });
});
