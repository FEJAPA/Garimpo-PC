import { describe, it, expect } from "vitest";
import { isCompatible, requiredWattage } from "./compatibility";
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
