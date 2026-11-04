import { describe, it, expect } from "vitest";
import { hasRequiredSpec, isCompatible, requiredWattage } from "./compatibility";
import type { PartSpec } from "@/models/builder-types";

const cpuAm5: PartSpec = { slug: "r5", category: "cpu", perf: 100, aesthetics: 50, socket: "AM5", tdp: 65 };
const cpuIntel: PartSpec = { slug: "i5", category: "cpu", perf: 92, aesthetics: 50, socket: "LGA1700", tdp: 110 };
const moboAm5: PartSpec = { slug: "b650m", category: "motherboard", perf: 100, aesthetics: 50, socket: "AM5", ramType: "DDR5", formFactor: "mATX" };
const moboAtx: PartSpec = { slug: "b650", category: "motherboard", perf: 100, aesthetics: 50, socket: "AM5", ramType: "DDR5", formFactor: "ATX" };
const ramDdr5: PartSpec = { slug: "ddr5", category: "ram", perf: 100, aesthetics: 50, ramType: "DDR5" };
const ramDdr4: PartSpec = { slug: "ddr4", category: "ram", perf: 80, aesthetics: 50, ramType: "DDR4" };
const gpu: PartSpec = { slug: "4060", category: "gpu", perf: 100, aesthetics: 50, tdp: 115 };
const caseMatx: PartSpec = { slug: "mini", category: "case", perf: 70, aesthetics: 50, caseSupports: ["mATX", "ITX"] };
const psu450: PartSpec = { slug: "450", category: "psu", perf: 80, aesthetics: 30, wattage: 450 };
const psu650: PartSpec = { slug: "650", category: "psu", perf: 100, aesthetics: 30, wattage: 650 };

describe("compatibilidade", () => {
  it("processador e placa-mãe precisam do mesmo socket", () => {
    expect(isCompatible([moboAm5], cpuAm5)).toBe(true);
    expect(isCompatible([moboAm5], cpuIntel)).toBe(false);
    expect(isCompatible([cpuIntel], moboAm5)).toBe(false);
  });

  it("memória e placa-mãe precisam do mesmo tipo (DDR4/DDR5)", () => {
    expect(isCompatible([moboAm5], ramDdr5)).toBe(true);
    expect(isCompatible([moboAm5], ramDdr4)).toBe(false);
  });

  it("gabinete precisa suportar o form factor da placa-mãe", () => {
    expect(isCompatible([moboAm5], caseMatx)).toBe(true);
    expect(isCompatible([moboAtx], caseMatx)).toBe(false);
    expect(isCompatible([caseMatx], moboAtx)).toBe(false);
  });

  it("potência exigida = (gpu + cpu + 75) * 1.3, arredondada para cima", () => {
    expect(requiredWattage([gpu, cpuAm5])).toBe(Math.ceil((115 + 65 + 75) * 1.3)); // 332
  });

  it("fonte precisa ter a potência exigida", () => {
    expect(isCompatible([gpu, cpuAm5], psu650)).toBe(true);
    expect(isCompatible([gpu, cpuIntel], psu450)).toBe(true); // 390 W
    const gpuForte: PartSpec = { ...gpu, tdp: 245 };
    expect(isCompatible([gpuForte, cpuIntel], psu450)).toBe(false); // 559 W
  });

  it("sem peças relacionadas, tudo é compatível", () => {
    expect(isCompatible([], cpuAm5)).toBe(true);
    expect(isCompatible([gpu], ramDdr4)).toBe(true);
  });
});

describe("especificação mínima por categoria (LOG-02/03)", () => {
  const completas: PartSpec[] = [cpuAm5, moboAm5, ramDdr5, gpu, caseMatx, psu650, { slug: "nv2", category: "ssd", perf: 100, aesthetics: 30 }];

  it("aceita as specs completas de cada categoria", () => {
    for (const s of completas) expect(hasRequiredSpec(s)).toBe(true);
  });

  it("exige tdp e perf > 0 em gpu e cpu", () => {
    expect(hasRequiredSpec({ ...gpu, tdp: undefined })).toBe(false);
    expect(hasRequiredSpec({ ...gpu, tdp: 0 })).toBe(false);
    expect(hasRequiredSpec({ ...gpu, perf: 0 })).toBe(false);
    expect(hasRequiredSpec({ ...cpuAm5, perf: Number.NaN })).toBe(false);
    expect(hasRequiredSpec({ ...cpuAm5, tdp: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it("exige socket na cpu; socket, tipo de memória e formato na placa-mãe", () => {
    expect(hasRequiredSpec({ ...cpuAm5, socket: undefined })).toBe(false);
    expect(hasRequiredSpec({ ...moboAm5, socket: undefined })).toBe(false);
    expect(hasRequiredSpec({ ...moboAm5, ramType: undefined })).toBe(false);
    expect(hasRequiredSpec({ ...moboAm5, formFactor: undefined })).toBe(false);
  });

  it("exige tipo na memória, formatos no gabinete, potência na fonte e perf no SSD", () => {
    expect(hasRequiredSpec({ ...ramDdr5, ramType: undefined })).toBe(false);
    expect(hasRequiredSpec({ ...caseMatx, caseSupports: [] })).toBe(false);
    expect(hasRequiredSpec({ ...caseMatx, caseSupports: undefined })).toBe(false);
    expect(hasRequiredSpec({ ...psu650, wattage: undefined })).toBe(false);
    expect(hasRequiredSpec({ ...psu650, wattage: 0 })).toBe(false);
    expect(hasRequiredSpec({ slug: "x", category: "ssd", perf: 0, aesthetics: 30 })).toBe(false);
  });

  it("estética precisa estar entre 0 e 100 em qualquer categoria", () => {
    expect(hasRequiredSpec({ ...ramDdr5, aesthetics: 101 })).toBe(false);
    expect(hasRequiredSpec({ ...caseMatx, aesthetics: -1 })).toBe(false);
    expect(hasRequiredSpec({ ...psu650, aesthetics: Number.NaN })).toBe(false);
    expect(hasRequiredSpec({ ...caseMatx, aesthetics: 0 })).toBe(true);
    expect(hasRequiredSpec({ ...caseMatx, aesthetics: 100 })).toBe(true);
  });

  it("recusa categoria fora das sete (ex.: vinda do banco como 'GPU')", () => {
    expect(hasRequiredSpec({ ...gpu, category: "GPU" as PartSpec["category"] })).toBe(false);
    expect(hasRequiredSpec({ ...gpu, category: "cooler" as PartSpec["category"] })).toBe(false);
  });
});
