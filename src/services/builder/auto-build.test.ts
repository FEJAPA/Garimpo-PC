import { describe, it, expect } from "vitest";
import { autoBuild, cheapestCompatibleBuild, buildCandidates } from "./auto-build";
import { MOCK_PRODUCTS } from "@/models/mock-data";
import { PART_SPECS } from "@/models/part-specs";
import { isCompatible } from "./compatibility";
import { makeProduct, LOJA_KABUM } from "./test-fixtures";
import type { BuildPreferences, PartSpec } from "@/models/builder-types";
import type { Category } from "@/models/types";

const CATEGORIAS: Category[] = ["gpu", "cpu", "motherboard", "ram", "ssd", "psu", "case"];

function prefs(target: number, hardCap: number, aesthetics = 25, trustedOnly = true): BuildPreferences {
  return { budget: { target, hardCap }, trustedOnly, aesthetics };
}

function montar(p: BuildPreferences) {
  return autoBuild(MOCK_PRODUCTS, PART_SPECS, p);
}

describe("montagem automática (catálogo de exemplo)", () => {
  it("monta um PC completo, compatível, dentro do teto, só com lojas confiáveis", () => {
    const r = montar(prefs(6000, 7000));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parts.map((p) => p.category).sort()).toEqual([...CATEGORIAS].sort());
    expect(r.totalPix).toBeLessThanOrEqual(7000);
    expect(r.parts.every((p) => p.offer.store.id !== "promocenter")).toBe(true);
    const specs = r.parts.map((p) => p.spec);
    expect(specs.every((s) => isCompatible(specs.filter((x) => x !== s), s))).toBe(true);
    expect(r.performance.score).toBeGreaterThan(0);
    expect(r.payment.pixTotal).toBeCloseTo(r.totalPix, 2);
  });

  it("INVARIANTE: o total nunca passa do teto, em qualquer combinação", () => {
    for (const target of [4700, 5000, 6000, 8000, 12000]) {
      for (const extra of [0, 500, 1000, 3000]) {
        for (const a of [0, 50, 100]) {
          for (const trusted of [true, false]) {
            const r = montar(prefs(target, target + extra, a, trusted));
            expect(r.ok).toBe(true);
            if (!r.ok) continue;
            expect(r.totalPix).toBeLessThanOrEqual(target + extra);
            expect(r.leftover).toBeCloseTo(target + extra - r.totalPix, 2);
            const specs = r.parts.map((p) => p.spec);
            expect(specs.every((s) => isCompatible(specs.filter((x) => x !== s), s))).toBe(true);
          }
        }
      }
    }
  });

  it("usa a folga para subir a placa de vídeo quando vale a pena", () => {
    const semFolga = montar(prefs(6000, 6000, 0));
    const comFolga = montar(prefs(6000, 7000, 0));
    expect(semFolga.ok && comFolga.ok).toBe(true);
    if (!semFolga.ok || !comFolga.ok) return;
    const gpuSem = semFolga.parts.find((p) => p.category === "gpu")!;
    const gpuCom = comFolga.parts.find((p) => p.category === "gpu")!;
    expect(gpuCom.spec.perf).toBeGreaterThan(gpuSem.spec.perf);
    expect(comFolga.usedWiggleRoom).toBe(true);
    expect(comFolga.totalPix).toBeGreaterThan(6000);
    expect(comFolga.totalPix).toBeLessThanOrEqual(7000);
    expect(comFolga.notes.some((n) => n.includes("folga"))).toBe(true);
    expect(semFolga.usedWiggleRoom).toBe(false);
  });

  it("sem o filtro de lojas, aceita a oferta 'boa demais' do marketplace", () => {
    const confiavel = montar(prefs(5500, 5500, 0, true));
    const qualquerLoja = montar(prefs(5500, 5500, 0, false));
    expect(confiavel.ok && qualquerLoja.ok).toBe(true);
    if (!confiavel.ok || !qualquerLoja.ok) return;
    expect(qualquerLoja.parts.find((p) => p.category === "gpu")!.offer.store.id).toBe("promocenter");
    expect(confiavel.parts.find((p) => p.category === "gpu")!.offer.store.id).not.toBe("promocenter");
  });

  it("no extremo estético escolhe o gabinete bonito; no de desempenho, não", () => {
    const estetica = montar(prefs(6000, 7000, 100));
    const desempenho = montar(prefs(6000, 7000, 0));
    expect(estetica.ok && desempenho.ok).toBe(true);
    if (!estetica.ok || !desempenho.ok) return;
    expect(estetica.parts.find((p) => p.category === "case")!.product.slug).toBe("montech-sky-two");
    expect(desempenho.parts.find((p) => p.category === "case")!.product.slug).not.toBe("montech-sky-two");
  });

  it("orçamento impossível falha dizendo o valor da montagem mais barata", () => {
    const r = montar(prefs(1000, 1000));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("R$");
    expect(r.reason).toContain("4.699");
  });

  it("a montagem mais barata compatível do catálogo custa R$ 4.699,30", () => {
    const cands = buildCandidates(MOCK_PRODUCTS, PART_SPECS, true);
    const cheapest = cheapestCompatibleBuild(cands);
    expect(cheapest).not.toBeNull();
    expect(cheapest!.total).toBeCloseTo(4699.3, 2);
  });

  it("teto igual ao alvo nunca marca uso de folga", () => {
    const r = montar(prefs(7000, 7000, 50));
    expect(r.ok && r.usedWiggleRoom).toBe(false);
  });
});

describe("montagem automática (catálogo sintético)", () => {
  const base: Record<Category, PartSpec[]> = {
    gpu: [
      { slug: "gpu-a", category: "gpu", perf: 100, aesthetics: 50, tdp: 100 },
      { slug: "gpu-b", category: "gpu", perf: 105, aesthetics: 50, tdp: 100 },
      { slug: "gpu-c", category: "gpu", perf: 120, aesthetics: 50, tdp: 100 },
    ],
    cpu: [{ slug: "cpu", category: "cpu", perf: 100, aesthetics: 50, socket: "AM5", tdp: 65 }],
    motherboard: [{ slug: "mobo", category: "motherboard", perf: 100, aesthetics: 50, socket: "AM5", ramType: "DDR5", formFactor: "mATX" }],
    ram: [{ slug: "ram", category: "ram", perf: 100, aesthetics: 50, ramType: "DDR5" }],
    ssd: [{ slug: "ssd", category: "ssd", perf: 100, aesthetics: 50 }],
    psu: [{ slug: "psu", category: "psu", perf: 100, aesthetics: 50, wattage: 650 }],
    case: [{ slug: "case", category: "case", perf: 100, aesthetics: 50, caseSupports: ["mATX"] }],
  };
  const precos: Record<string, number> = {
    "gpu-a": 1000, "gpu-b": 1500, "gpu-c": 2000,
    cpu: 500, mobo: 400, ram: 200, ssd: 200, psu: 200, case: 200,
  };
  const produtos = Object.values(base).flat().map((s) => makeProduct(s.slug, s.category, [{ store: LOJA_KABUM, price: precos[s.slug] }]));
  const specs = Object.fromEntries(Object.values(base).flat().map((s) => [s.slug, s]));
  // Resto das peças = 1700. Com gpu-a o total é 2700.

  it("não usa a folga para um ganho menor que 10%", () => {
    // gpu-b (+5%) caberia no teto 3200, mas o ganho é pequeno demais.
    const r = autoBuild(produtos, specs, prefs(2700, 3200, 0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parts.find((p) => p.category === "gpu")!.product.slug).toBe("gpu-a");
    expect(r.usedWiggleRoom).toBe(false);
  });

  it("usa a folga para um ganho de 20% quando cabe no teto", () => {
    const r = autoBuild(produtos, specs, prefs(2700, 3700, 0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parts.find((p) => p.category === "gpu")!.product.slug).toBe("gpu-c");
    expect(r.totalPix).toBe(3700);
    expect(r.usedWiggleRoom).toBe(true);
  });

  it("falha explicando a categoria quando o filtro de lojas elimina todas as opções", () => {
    const semFonteConfiavel = produtos.map((p) =>
      p.category === "psu" ? { ...p, offers: p.offers.map((o) => ({ ...o, store: { ...o.store, is_official: false } })) } : p
    );
    const r = autoBuild(semFonteConfiavel, specs, prefs(5000, 5000, 0, true));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason.toLowerCase()).toContain("fonte");
  });
});
