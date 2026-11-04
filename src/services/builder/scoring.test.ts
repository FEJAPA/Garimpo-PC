import { describe, it, expect } from "vitest";
import { partUtility, categoryShares, AESTHETICS_RELEVANCE } from "./scoring";
import type { PartSpec } from "@/models/builder-types";

const gabineteBonito: PartSpec = { slug: "a", category: "case", perf: 50, aesthetics: 95 };
const gabineteArejado: PartSpec = { slug: "b", category: "case", perf: 100, aesthetics: 30 };
const cpu: PartSpec = { slug: "c", category: "cpu", perf: 80, aesthetics: 100 };

describe("utilidade de uma peça", () => {
  it("com slider 0 só o desempenho conta", () => {
    expect(partUtility(gabineteBonito, 0, 100)).toBeCloseTo(0.5);
    expect(partUtility(gabineteArejado, 0, 100)).toBeCloseTo(1);
  });

  it("com slider 100 o gabinete é escolhido pela estética", () => {
    expect(partUtility(gabineteBonito, 100, 100)).toBeCloseTo(0.95);
    expect(partUtility(gabineteArejado, 100, 100)).toBeCloseTo(0.3);
  });

  it("a estética nunca pesa no processador", () => {
    expect(AESTHETICS_RELEVANCE.cpu).toBe(0);
    expect(partUtility(cpu, 100, 100)).toBeCloseTo(0.8);
  });

  it("na placa de vídeo a estética pesa no máximo 60%", () => {
    const gpu: PartSpec = { slug: "g", category: "gpu", perf: 50, aesthetics: 100 };
    // w = 0.6 → 0.4 * 0.5 + 0.6 * 1 = 0.8
    expect(partUtility(gpu, 100, 100)).toBeCloseTo(0.8);
  });
});

describe("fatias do orçamento", () => {
  it("somam 1 em qualquer posição do slider", () => {
    for (const a of [0, 25, 50, 100]) {
      const total = Object.values(categoryShares(a)).reduce((s, v) => s + v, 0);
      expect(total).toBeCloseTo(1, 6);
    }
  });

  it("desempenho máximo dá 42% para a GPU e 5% para o gabinete", () => {
    const s = categoryShares(0);
    expect(s.gpu).toBeCloseTo(0.42);
    expect(s.case).toBeCloseTo(0.05);
  });

  it("estética máxima dá 30% para a GPU e 20% para o gabinete", () => {
    const s = categoryShares(100);
    expect(s.gpu).toBeCloseTo(0.3);
    expect(s.case).toBeCloseTo(0.2);
  });

  it("interpola linearmente no meio", () => {
    expect(categoryShares(50).gpu).toBeCloseTo(0.36);
  });
});

describe("fatias do orçamento por perfil de uso (V2-B3)", () => {
  const somar = (s: Record<string, number>) => Object.values(s).reduce((t, v) => t + v, 0);

  it("somam 1 nos três perfis, em qualquer posição do slider", () => {
    for (const usage of ["jogos", "trabalho", "criacao"] as const) {
      for (const a of [0, 25, 50, 75, 100]) {
        const s = categoryShares(a, usage);
        expect(somar(s)).toBeCloseTo(1, 6);
        expect(Object.values(s).every((v) => v > 0)).toBe(true);
      }
    }
  });

  it("sem perfil, vale o de jogos (tabela da V1)", () => {
    for (const a of [0, 50, 100]) expect(categoryShares(a, "jogos")).toEqual(categoryShares(a));
  });

  it("perfil criação dá mais peso a CPU e RAM", () => {
    const s = categoryShares(0, "criacao");
    expect(s.cpu).toBeGreaterThanOrEqual(0.22 - 1e-9);
    expect(s.ram).toBeGreaterThanOrEqual(0.1);
    expect(s.gpu).toBeCloseTo(0.36);
    expect(s.ssd).toBeCloseTo(0.05);
  });

  it("perfil trabalho tira da GPU e dá para CPU, RAM e SSD", () => {
    const jogos = categoryShares(0);
    const s = categoryShares(0, "trabalho");
    expect(s.gpu).toBeCloseTo(jogos.gpu - 0.12);
    expect(s.cpu).toBeCloseTo(jogos.cpu + 0.05);
    expect(s.ram).toBeCloseTo(jogos.ram + 0.03);
    expect(s.ssd).toBeCloseTo(jogos.ssd + 0.04);
    expect(s.case).toBeCloseTo(jogos.case);
  });
});
