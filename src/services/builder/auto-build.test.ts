import { describe, it, expect } from "vitest";
import { autoBuild, cheapestCompatibleBuild, buildCandidates, collectCandidates, suspicionNotes } from "./auto-build";
import { MOCK_PRODUCTS } from "@/models/mock-data";
import { PART_SPECS } from "@/models/part-specs";
import { INSTALLMENT_TABLES } from "@/models/installment-tables";
import { REFERENCE_BUILDS } from "@/models/reference-builds";
import { isCompatible } from "./compatibility";
import { formatBRL } from "@/lib/currency";
import { isTrustedStore, validOffers } from "./trust";
import { installmentOptions } from "./payments";
import { flagSuspiciousOffers } from "./suspicious";
import {
  makeProduct,
  makePart,
  LOJA_KABUM,
  LOJA_PICHAU,
  LOJA_DUVIDOSA,
  seededRandom,
  syntheticCatalog,
} from "./test-fixtures";
import type { BuildPreferences, BuildSuccess, PartSpec, UsageProfile } from "@/models/builder-types";
import type { Category, ProductWithOffers } from "@/models/types";

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

  // R-01 (regra nova): sem o filtro, uma oferta de marketplace NÃO suspeita
  // pode ser usada, mas a "boa demais" (≥ 25% abaixo da mediana confiável) não.
  it("sem o filtro de lojas, usa oferta de marketplace que não é suspeita", () => {
    const confiavel = montar(prefs(8000, 9000, 0, true));
    const qualquerLoja = montar(prefs(8000, 9000, 0, false));
    expect(confiavel.ok && qualquerLoja.ok).toBe(true);
    if (!confiavel.ok || !qualquerLoja.ok) return;
    const gpu = qualquerLoja.parts.find((p) => p.category === "gpu")!;
    expect(gpu.product.slug).toBe("rtx-4070-super");
    expect(gpu.offer.store.id).toBe("promocenter");
    expect(gpu.price).toBeCloseTo(3899.9, 2);
    expect(gpu.suspicious).toBeUndefined();
    expect(confiavel.parts.every((p) => p.offer.store.id !== "promocenter")).toBe(true);
  });

  it("sem o filtro de lojas, a oferta 'boa demais' da RTX 4060 não vira candidata (R-01)", () => {
    const cands = buildCandidates(MOCK_PRODUCTS, PART_SPECS, false);
    const rtx4060 = cands.gpu.find((c) => c.product.slug === "rtx-4060")!;
    expect(rtx4060.offer.store.id).toBe("kabum");
    expect(rtx4060.price).toBeCloseTo(1899.9, 2);
    expect(rtx4060.suspicious).toBeUndefined();

    for (const [alvo, teto] of [[6000, 7000], [5000, 5000], [4500, 6000]]) {
      const r = montar(prefs(alvo, teto, 25, false));
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(r.parts.some((p) => p.offer.id === "o-4060-promocenter")).toBe(false);
      expect(r.parts.every((p) => p.suspicious === undefined)).toBe(true);
      expect(r.notes.some((n) => n.startsWith("Atenção"))).toBe(false);
    }
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

// ---------------------------------------------------------------------------
// V2 (pacote B)
// ---------------------------------------------------------------------------

/** Catálogo pequeno e controlado: cada peça com uma oferta na KaBuM!. */
function catalogo(lista: PartSpec[], precos: Record<string, number>) {
  return {
    produtos: lista.map((s) => makeProduct(s.slug, s.category, [{ store: LOJA_KABUM, price: precos[s.slug] }])),
    specs: Object.fromEntries(lista.map((s) => [s.slug, s])) as Record<string, PartSpec>,
  };
}

const RESTO: PartSpec[] = [
  { slug: "mobo", category: "motherboard", perf: 100, aesthetics: 50, socket: "AM5", ramType: "DDR5", formFactor: "mATX" },
  { slug: "ram", category: "ram", perf: 100, aesthetics: 50, ramType: "DDR5" },
  { slug: "ssd", category: "ssd", perf: 100, aesthetics: 50 },
  { slug: "psu", category: "psu", perf: 100, aesthetics: 50, wattage: 650 },
  { slug: "case", category: "case", perf: 100, aesthetics: 50, caseSupports: ["mATX"] },
];
const PRECOS_RESTO = { mobo: 400, ram: 200, ssd: 200, psu: 200, case: 200 };

function todasCompativeis(r: BuildSuccess): boolean {
  const specs = r.parts.map((p) => p.spec);
  return specs.every((s) => isCompatible(specs.filter((x) => x !== s), s));
}

describe("contexto da montagem (R-02)", () => {
  it("com as tabelas de juros, o pagamento traz a tabela de cada loja", () => {
    const sem = montar(prefs(6000, 7000));
    const com = autoBuild(MOCK_PRODUCTS, PART_SPECS, prefs(6000, 7000), { installmentTables: INSTALLMENT_TABLES });
    expect(sem.ok && com.ok).toBe(true);
    if (!sem.ok || !com.ok) return;
    expect(sem.payment.stores.every((s) => s.interestTable === undefined)).toBe(true);
    expect(com.payment.stores.length).toBeGreaterThan(0);
    expect(com.payment.stores.every((s) => (s.interestTable?.length ?? 0) > 0)).toBe(true);
    // S-09: o "ou R$ X parcelado" do cabeçalho é o parcelado mais barato que existe.
    expect(com.totalInstallment).toBe(com.payment.bestInstallment?.total ?? com.payment.installmentTotal);
    // As peças não mudam: o contexto só afeta pagamento e desempenho.
    expect(com.parts.map((p) => p.offer.id)).toEqual(sem.parts.map((p) => p.offer.id));
  });

  it("com outras referências, o 'equivale a' muda", () => {
    const sem = montar(prefs(6000, 7000));
    const refs = [{ ...REFERENCE_BUILDS[0], id: "ref-unica", name: "Referência do banco" }];
    const com = autoBuild(MOCK_PRODUCTS, PART_SPECS, prefs(6000, 7000), { references: refs });
    expect(sem.ok && com.ok).toBe(true);
    if (!sem.ok || !com.ok) return;
    expect(com.performance.closest.id).toBe("ref-unica");
    expect(sem.performance.closest.id).not.toBe("ref-unica");
  });
});

describe("oferta suspeita no Montador (R-01)", () => {
  const lista: PartSpec[] = [
    { slug: "gpu", category: "gpu", perf: 100, aesthetics: 50, tdp: 100 },
    { slug: "cpu", category: "cpu", perf: 100, aesthetics: 50, socket: "AM5", tdp: 65 },
    ...RESTO,
  ];
  const { produtos, specs } = catalogo(lista, { gpu: 1000, cpu: 500, ...PRECOS_RESTO });
  // A GPU só tem ofertas de marketplace, e o detector de teste marca as duas.
  // (Com a regra atual de C3 isso não acontece: a loja confiável nunca é marcada.)
  const gpuSo = makeProduct("gpu", "gpu", [
    { store: LOJA_DUVIDOSA, price: 700 },
    { store: { ...LOJA_DUVIDOSA, id: "outra", name: "Outra Loja" }, price: 650 },
  ]);
  const catalogoSuspeito = produtos.map((p) => (p.slug === "gpu" ? gpuSo : p));
  const tudoSuspeito = (p: ProductWithOffers) =>
    new Map(p.slug === "gpu" ? p.offers.map((o) => [o.id, { reason: "teste: bem abaixo da mediana" }]) : []);

  it("se todas as ofertas válidas são suspeitas, usa a mais barata e marca o motivo", () => {
    const { candidates } = collectCandidates(catalogoSuspeito, specs, false, tudoSuspeito);
    expect(candidates.gpu).toHaveLength(1);
    expect(candidates.gpu[0].offer.store.id).toBe("outra");
    expect(candidates.gpu[0].price).toBe(650);
    expect(candidates.gpu[0].suspicious).toEqual({ reason: "teste: bem abaixo da mediana" });
  });

  it("peça escolhida de oferta suspeita gera aviso com a loja", () => {
    const spec: PartSpec = { slug: "gpu", category: "gpu", perf: 100, aesthetics: 50, tdp: 100 };
    const suspeita = { ...makePart(spec, { store: { ...LOJA_DUVIDOSA, name: "Outra Loja" }, price: 650 }), suspicious: { reason: "x" } };
    const limpa = makePart({ ...RESTO[1] }, { store: LOJA_KABUM, price: 200 });
    expect(suspicionNotes([suspeita, limpa])).toEqual([
      "Atenção: a placa de vídeo veio de uma oferta com preço bom demais na loja Outra Loja — confira antes de pagar.",
    ]);
  });

  it("prefere a oferta não suspeita mesmo que seja mais cara", () => {
    const misto = makeProduct("gpu", "gpu", [
      { store: LOJA_DUVIDOSA, price: 600 },
      { store: LOJA_PICHAU, price: 1000 },
    ]);
    const marcaPrimeira = (p: ProductWithOffers) =>
      new Map(p.slug === "gpu" ? [[p.offers[0].id, { reason: "suspeita" }]] : []);
    const { candidates } = collectCandidates(produtos.map((p) => (p.slug === "gpu" ? misto : p)), specs, false, marcaPrimeira);
    expect(candidates.gpu[0].offer.store.id).toBe("pichau");
    expect(candidates.gpu[0].suspicious).toBeUndefined();
  });

  it("equivale às regras de trust.ts/suspicious.ts (validOffers + flagSuspiciousOffers)", () => {
    const sintetico = syntheticCatalog(40, 99);
    for (const [products, specs] of [[MOCK_PRODUCTS, PART_SPECS], [sintetico.products, sintetico.specs]] as const) {
      for (const trusted of [true, false]) {
        const cands = Object.values(buildCandidates(products, specs, trusted)).flat();
        const porSlug = new Map(cands.map((c) => [c.product.slug, c]));
        for (const p of products) {
          const validas = validOffers(p, trusted);
          const flags = flagSuspiciousOffers(p);
          const c = porSlug.get(p.slug);
          if (validas.length === 0) {
            expect(c).toBeUndefined();
            continue;
          }
          const limpas = validas.filter((o) => !flags.has(o.id));
          const base = limpas.length > 0 ? limpas : validas;
          const esperada = base.reduce((m, o) => (o.price_pix < m.price_pix ? o : m));
          expect(c?.offer.id).toBe(esperada.id);
          expect(c?.suspicious?.reason).toBe(limpas.length > 0 ? undefined : flags.get(esperada.id)?.reason);
        }
      }
    }
  });
});

describe("peças sem especificação técnica (LOG-02/03/04)", () => {
  it("ignora spec de categoria errada, spec incompleta e peça sem spec, e conta", () => {
    const extras: ProductWithOffers[] = [
      makeProduct("gpu-categoria-errada", "gpu", [{ store: LOJA_KABUM, price: 10 }]),
      makeProduct("cpu-sem-socket", "cpu", [{ store: LOJA_KABUM, price: 10 }]),
      makeProduct("ssd-sem-spec", "ssd", [{ store: LOJA_KABUM, price: 10 }]),
      // Categoria vinda do banco fora das sete: não pode derrubar a montagem.
      { ...makeProduct("gpu-maiuscula", "gpu", [{ store: LOJA_KABUM, price: 10 }]), category: "GPU" as Category },
    ];
    const specs: Record<string, PartSpec> = {
      ...PART_SPECS,
      "gpu-categoria-errada": { slug: "gpu-categoria-errada", category: "ram", perf: 500, aesthetics: 50, ramType: "DDR5" },
      "cpu-sem-socket": { slug: "cpu-sem-socket", category: "cpu", perf: 500, aesthetics: 50, tdp: 65 },
      "gpu-maiuscula": { slug: "gpu-maiuscula", category: "gpu", perf: 500, aesthetics: 50, tdp: 100 },
    };
    const produtos = [...MOCK_PRODUCTS, ...extras];

    const { candidates, ignored } = collectCandidates(produtos, specs, true);
    expect(ignored.count).toBe(4);
    expect([...ignored.slugs].sort()).toEqual(["cpu-sem-socket", "gpu-categoria-errada", "gpu-maiuscula", "ssd-sem-spec"]);
    const usados = Object.values(candidates).flat().map((c) => c.product.slug);
    expect(usados.some((s) => extras.some((e) => e.slug === s))).toBe(false);

    const r = autoBuild(produtos, specs, prefs(6000, 7000));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ignored).toEqual({ count: 4, slugs: ignored.slugs });
    expect(r.notes).toContain("4 peças do catálogo foram ignoradas por falta de especificação técnica.");
  });

  it("uma peça ignorada usa o singular; nenhuma, nenhuma nota", () => {
    const um = autoBuild(
      [...MOCK_PRODUCTS, makeProduct("sem-spec", "case", [{ store: LOJA_KABUM, price: 1 }])],
      PART_SPECS,
      prefs(6000, 7000)
    );
    expect(um.ok && um.notes).toContain("1 peça do catálogo foi ignorada por falta de especificação técnica.");
    const zero = montar(prefs(6000, 7000));
    expect(zero.ok).toBe(true);
    if (!zero.ok) return;
    expect(zero.ignored).toEqual({ count: 0, slugs: [] });
    expect(zero.notes.some((n) => n.includes("ignorada"))).toBe(false);
  });

  it("sem nenhuma spec cadastrada, diz isso em vez de mandar desligar o filtro (S-10)", () => {
    for (const trusted of [true, false]) {
      const r = autoBuild(MOCK_PRODUCTS, {}, prefs(6000, 7000, 25, trusted));
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.reason).toBe("Nenhuma peça do catálogo tem especificação técnica cadastrada; não dá para montar agora.");
    }
  });

  it("categoria inteira sem spec diz qual é, sem falar do filtro de lojas (S-10)", () => {
    for (const [cat, frase] of [
      ["gpu", "Nenhuma placa de vídeo"],
      ["cpu", "Nenhum processador"],
    ] as const) {
      const specs = Object.fromEntries(Object.entries(PART_SPECS).filter(([, s]) => s.category !== cat));
      const r = autoBuild(MOCK_PRODUCTS, specs, prefs(6000, 7000, 25, true));
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.reason).toBe(`${frase} do catálogo tem especificação técnica cadastrada; não dá para montar agora.`);
      expect(r.reason).not.toContain("Desative");
    }
  });

  it("catálogo vazio falha com motivo, sem lançar erro", () => {
    const r = autoBuild([], {}, prefs(6000, 7000));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("placa de vídeo");
  });
});

describe("folga, trocas e notas (LOG-05/06, R-16, R-17)", () => {
  const lista: PartSpec[] = [
    { slug: "gpu-a", category: "gpu", perf: 100, aesthetics: 50, tdp: 100 },
    { slug: "gpu-b", category: "gpu", perf: 105, aesthetics: 50, tdp: 100 },
    { slug: "gpu-c", category: "gpu", perf: 120, aesthetics: 50, tdp: 100 },
    { slug: "cpu-a", category: "cpu", perf: 100, aesthetics: 50, socket: "AM5", tdp: 65 },
    { slug: "cpu-b", category: "cpu", perf: 125, aesthetics: 50, socket: "AM5", tdp: 65 },
    ...RESTO,
  ];
  const { produtos, specs } = catalogo(lista, {
    "gpu-a": 1000, "gpu-b": 1500, "gpu-c": 2000, "cpu-a": 500, "cpu-b": 800, ...PRECOS_RESTO,
  });
  // Montagem mais barata: gpu-a + cpu-a + resto (1200) = 2700.

  it("acima do alvo SEM troca não marca uso da folga (LOG-05)", () => {
    // Teto 2900: nenhuma troca cabe (cpu-b daria 3000; gpu-b, 3200).
    const r = autoBuild(produtos, specs, prefs(2500, 2900, 0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.totalPix).toBe(2700);
    expect(r.upgrades).toEqual([]);
    expect(r.usedWiggleRoom).toBe(false);
    expect(r.notes).toContain(`A montagem ficou ${formatBRL(200)} acima do alvo, mas dentro do teto.`);
  });

  it("duas trocas: cada nota com o próprio valor e uma nota com o total da folga (R-17)", () => {
    const r = autoBuild(produtos, specs, prefs(2700, 4000, 0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.totalPix).toBe(4000);
    expect(r.usedWiggleRoom).toBe(true);
    expect(r.upgrades).toEqual([
      { category: "gpu", from: "gpu-a", to: "gpu-c", priceDelta: 1000, perfGainPct: 20 },
      { category: "cpu", from: "cpu-a", to: "cpu-b", priceDelta: 300, perfGainPct: 25 },
    ]);
    const gpuNota = r.notes.find((n) => n.includes("gpu-a → gpu-c"))!;
    const cpuNota = r.notes.find((n) => n.includes("cpu-a → cpu-b"))!;
    expect(gpuNota).toContain(formatBRL(1000));
    expect(gpuNota).toContain("+20% de desempenho");
    expect(gpuNota).not.toContain(formatBRL(1300));
    expect(cpuNota).toContain(formatBRL(300));
    expect(cpuNota).toContain("+25% de desempenho");
    expect(cpuNota).not.toContain(formatBRL(1300));
    expect(r.notes).toContain(`No total, as trocas usaram ${formatBRL(1300)} da folga (acima do alvo, dentro do teto).`);
  });

  it("troca paga em parte com a sobra do alvo diz de onde veio o dinheiro", () => {
    // Alvo 3200: o guloso fica em 3000 (gpu-a + par cpu-b, sobra 200); gpu-c
    // (+1000) leva a 4000, então R$ 800 saem da folga e R$ 200 da sobra.
    const r = autoBuild(produtos, specs, prefs(3200, 4000, 0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.upgrades?.[0]).toMatchObject({ category: "gpu", priceDelta: 1000 });
    expect(r.notes).toContain(
      `No total, as trocas usaram ${formatBRL(800)} da folga (acima do alvo, dentro do teto); o resto veio do que sobrou dentro do alvo.`
    );
  });

  it("troca paga com a sobra do alvo não conta como folga", () => {
    const r = autoBuild(produtos, specs, prefs(4000, 4000, 0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.usedWiggleRoom).toBe(false);
    expect(r.notes.some((n) => n.includes("folga"))).toBe(false);
  });

  it("agrupa as categorias que não couberam na fatia em uma nota só (R-16)", () => {
    const r = montar(prefs(5000, 5000));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const agrupadas = r.notes.filter((n) => n.startsWith("Para caber no orçamento, usamos as opções compatíveis mais baratas em: "));
    expect(agrupadas).toHaveLength(1);
    expect(agrupadas[0]).toMatch(/: [a-zà-ú].*\.$/);
    for (const n of r.notes) {
      expect(n).not.toContain("Nenhuma opção");
      expect(n).not.toContain(formatBRL(0));
      expect(n).not.toContain("memória ram");
    }
  });
});

describe("rebaixamento até o teto (F-02, F-04)", () => {
  // Par processador + placa-mãe único (R$ 3.500) e resto R$ 800. gpu-a cabe na
  // fatia, mas com o par passa do teto (R$ 7.300). gpu-c é mais barata E melhor
  // que gpu-b: o rebaixamento tem de ir para ela, não para "a próxima mais barata".
  function comGpus(perfB: number) {
    return catalogo(
      [
        { slug: "gpu-a", category: "gpu", perf: 120, aesthetics: 50, tdp: 100 },
        { slug: "gpu-b", category: "gpu", perf: perfB, aesthetics: 50, tdp: 100 },
        { slug: "gpu-c", category: "gpu", perf: 100, aesthetics: 50, tdp: 100 },
        { slug: "cpu", category: "cpu", perf: 100, aesthetics: 50, socket: "AM5", tdp: 65 },
        ...RESTO,
      ],
      { "gpu-a": 3000, "gpu-b": 2900, "gpu-c": 2500, cpu: 2000, ...PRECOS_RESTO, mobo: 1500 }
    );
  }

  it("troca pela de MAIOR utilidade que faz caber, não pela próxima mais barata (F-02)", () => {
    const { produtos, specs } = comGpus(95);
    const r = autoBuild(produtos, specs, prefs(7200, 7200, 0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parts.find((p) => p.category === "gpu")!.product.slug).toBe("gpu-c");
    expect(r.totalPix).toBe(6800);
    expect(todasCompativeis(r)).toBe(true);
  });

  it("depois do rebaixamento não sobra troca 'para cima' que sai mais barata (F-04)", () => {
    const { produtos, specs } = comGpus(60);
    const r = autoBuild(produtos, specs, prefs(7200, 7200, 0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parts.find((p) => p.category === "gpu")!.product.slug).toBe("gpu-c");
    expect(r.upgrades).toEqual([]);
    for (const n of r.notes) expect(n).not.toContain("-R$");
  });

  it("troca que sai mais barata diz 'economizando' e não conta como uso da folga (F-04)", () => {
    // gpu-cara + par caro passam do teto. O rebaixamento só pode usar gpu-z
    // (gpu-y pede fonte maior que a de 450 W). Na subida, gpu-y + fonte de 850 W
    // sai R$ 100 mais barata que gpu-z + fonte de 450 W.
    const lista: PartSpec[] = [
      { slug: "gpu-cara", category: "gpu", perf: 120, aesthetics: 50, tdp: 100 },
      { slug: "gpu-y", category: "gpu", perf: 115, aesthetics: 50, tdp: 300 },
      { slug: "gpu-z", category: "gpu", perf: 100, aesthetics: 50, tdp: 100 },
      { slug: "cpu", category: "cpu", perf: 100, aesthetics: 50, socket: "AM5", tdp: 65 },
      { slug: "psu-450", category: "psu", perf: 100, aesthetics: 50, wattage: 450 },
      { slug: "psu-850", category: "psu", perf: 100, aesthetics: 50, wattage: 850 },
      ...RESTO.filter((s) => s.slug !== "psu"),
    ];
    const { produtos, specs } = catalogo(lista, {
      "gpu-cara": 3000, "gpu-y": 2000, "gpu-z": 2400, cpu: 2400, mobo: 1800, ram: 200, ssd: 200, case: 200,
      "psu-450": 200, "psu-850": 500,
    });
    const r = autoBuild(produtos, specs, prefs(7200, 7500, 0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.totalPix).toBe(7300);
    expect(r.upgrades).toEqual([{ category: "gpu", from: "gpu-z", to: "gpu-y", priceDelta: -100, perfGainPct: 15 }]);
    expect(r.usedWiggleRoom).toBe(false);
    const nota = r.notes.find((n) => n.includes("gpu-z → gpu-y"))!;
    expect(nota).toContain(`economizando ${formatBRL(100)}`);
    expect(nota).not.toContain("por mais");
    expect(nota).not.toContain("-R$");
    expect(r.notes).toContain(`A montagem ficou ${formatBRL(100)} acima do alvo, mas dentro do teto.`);
    expect(r.notes.some((n) => n.includes("folga"))).toBe(false);
  });
});

describe("a folga respeita o perfil de uso (S-02)", () => {
  // gpu-a → gpu-c custa +R$ 1.000 (+20%); cpu-a → cpu-b, +R$ 300 (+25%).
  // Montagem mais barata (e a do guloso com alvo 2700): R$ 2.700.
  const lista: PartSpec[] = [
    { slug: "gpu-a", category: "gpu", perf: 100, aesthetics: 50, tdp: 100 },
    { slug: "gpu-c", category: "gpu", perf: 120, aesthetics: 50, tdp: 100 },
    { slug: "cpu-a", category: "cpu", perf: 100, aesthetics: 50, socket: "AM5", tdp: 65 },
    { slug: "cpu-b", category: "cpu", perf: 125, aesthetics: 50, socket: "AM5", tdp: 65 },
    ...RESTO,
  ];
  const { produtos, specs } = catalogo(lista, { "gpu-a": 1000, "gpu-c": 2000, "cpu-a": 500, "cpu-b": 800, ...PRECOS_RESTO });
  const montarCom = (usage: UsageProfile, teto: number) => autoBuild(produtos, specs, { ...prefs(2700, teto, 0), usage });
  const slugDe = (r: BuildSuccess, cat: Category) => r.parts.find((p) => p.category === cat)!.product.slug;

  it("Trabalho com folga sobe o processador e não troca a placa de vídeo", () => {
    const r = montarCom("trabalho", 4000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(slugDe(r, "gpu")).toBe("gpu-a");
    expect(slugDe(r, "cpu")).toBe("cpu-b");
    expect(r.upgrades?.map((u) => u.category)).toEqual(["cpu"]);
    expect(r.totalPix).toBe(3000);
  });

  it("Criação sobe primeiro o processador; Jogos, primeiro a placa de vídeo", () => {
    // Teto 3700: só cabe UMA das duas trocas, e a ordem decide qual.
    const criacao = montarCom("criacao", 3700);
    const jogos = montarCom("jogos", 3700);
    expect(criacao.ok && jogos.ok).toBe(true);
    if (!criacao.ok || !jogos.ok) return;
    expect([slugDe(criacao, "gpu"), slugDe(criacao, "cpu")]).toEqual(["gpu-a", "cpu-b"]);
    expect([slugDe(jogos, "gpu"), slugDe(jogos, "cpu")]).toEqual(["gpu-c", "cpu-a"]);
    // Com folga para as duas, Criação faz as duas (processador primeiro).
    const folgada = montarCom("criacao", 4000);
    expect(folgada.ok && folgada.upgrades?.map((u) => u.category)).toEqual(["cpu", "gpu"]);
  });
});

describe("parcelado do cabeçalho (S-09)", () => {
  it("'ou R$ X parcelado' é um parcelado que existe, mesmo com marketplace acima do preço a prazo", () => {
    // A placa de vídeo vem de uma marketplace que cobra Pix + 15% em qualquer
    // número de parcelas: R$ 1.150, acima dos R$ 1.100 a prazo que a oferta anuncia.
    const lista: PartSpec[] = [
      { slug: "gpu", category: "gpu", perf: 100, aesthetics: 50, tdp: 100 },
      { slug: "cpu", category: "cpu", perf: 100, aesthetics: 50, socket: "AM5", tdp: 65 },
      ...RESTO,
    ];
    const { produtos, specs } = catalogo(lista, { gpu: 1000, cpu: 500, ...PRECOS_RESTO });
    const comMarketplace = produtos.map((p) =>
      p.slug === "gpu" ? makeProduct("gpu", "gpu", [{ store: LOJA_DUVIDOSA, price: 1000, installment: 1100, count: 1 }]) : p
    );
    const r = autoBuild(comMarketplace, specs, prefs(3000, 3000, 0, false), {
      installmentTables: { [LOJA_DUVIDOSA.id]: [{ count: 12, factor: 1.15 }] },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parts.find((p) => p.category === "gpu")!.offer.store.id).toBe(LOJA_DUVIDOSA.id);
    expect(r.payment.bestInstallment).toBeDefined();
    expect(r.totalInstallment).toBe(r.payment.bestInstallment!.total);
    expect(r.totalInstallment).toBeGreaterThan(r.payment.installmentTotal);
    expect(installmentOptions(r.payment).some((o) => o.total === r.totalInstallment)).toBe(true);
  });

  it("no catálogo de exemplo, sem o filtro (GPU da marketplace), o valor também existe no seletor", () => {
    const r = autoBuild(MOCK_PRODUCTS, PART_SPECS, prefs(8000, 9000, 25, false), { installmentTables: INSTALLMENT_TABLES });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.totalInstallment).toBe(r.payment.bestInstallment!.total);
    expect(installmentOptions(r.payment).some((o) => o.total === r.totalInstallment)).toBe(true);
  });
});

describe("perfil de uso (B3)", () => {
  it("o perfil chega às fatias: criação põe mais dinheiro em CPU e RAM que jogos", () => {
    const lista: PartSpec[] = [
      { slug: "gpu-a", category: "gpu", perf: 100, aesthetics: 50, tdp: 100 },
      { slug: "gpu-b", category: "gpu", perf: 200, aesthetics: 50, tdp: 100 },
      { slug: "cpu", category: "cpu", perf: 100, aesthetics: 50, socket: "AM5", tdp: 65 },
      { slug: "mobo", category: "motherboard", perf: 100, aesthetics: 50, socket: "AM5", ramType: "DDR5", formFactor: "mATX" },
      { slug: "ram-a", category: "ram", perf: 100, aesthetics: 50, ramType: "DDR5" },
      { slug: "ram-b", category: "ram", perf: 200, aesthetics: 50, ramType: "DDR5" },
      ...RESTO.filter((s) => !["mobo", "ram"].includes(s.slug)),
    ];
    const { produtos, specs } = catalogo(lista, {
      "gpu-a": 3000, "gpu-b": 4100, cpu: 1700, mobo: 1300, "ram-a": 500, "ram-b": 1050, ssd: 500, psu: 500, case: 500,
    });
    // alvo 10000, a = 0. Jogos: fatia da gpu 4200 (cabe gpu-b) e da ram 700 + sobra
    // pequena (só ram-a). Criação: fatia da ram 1100 + sobra (cabe ram-b). A gpu da
    // criação pode subir depois, com a sobra, então não é conferida aqui.
    const jogos = autoBuild(produtos, specs, { ...prefs(10000, 10000, 0), usage: "jogos" });
    const criacao = autoBuild(produtos, specs, { ...prefs(10000, 10000, 0), usage: "criacao" });
    expect(jogos.ok && criacao.ok).toBe(true);
    if (!jogos.ok || !criacao.ok) return;
    expect(jogos.parts.find((p) => p.category === "gpu")!.product.slug).toBe("gpu-b");
    expect(criacao.parts.find((p) => p.category === "ram")!.product.slug).toBe("ram-b");
    expect(jogos.parts.find((p) => p.category === "ram")!.product.slug).toBe("ram-a");
  });
});

describe("CPU + placa-mãe como par (B2)", () => {
  // cpu-x é a mais barata, mas só a placa-mãe cara serve nela; o par Y sai R$ 500 mais barato.
  const lista: PartSpec[] = [
    { slug: "gpu", category: "gpu", perf: 100, aesthetics: 50, tdp: 100 },
    { slug: "cpu-x", category: "cpu", perf: 100, aesthetics: 50, socket: "AM5", tdp: 65 },
    { slug: "cpu-y", category: "cpu", perf: 100, aesthetics: 50, socket: "LGA1700", tdp: 65 },
    { slug: "mobo-x", category: "motherboard", perf: 100, aesthetics: 50, socket: "AM5", ramType: "DDR5", formFactor: "mATX" },
    { slug: "mobo-y", category: "motherboard", perf: 100, aesthetics: 50, socket: "LGA1700", ramType: "DDR5", formFactor: "mATX" },
    ...RESTO.filter((s) => s.slug !== "mobo"),
  ];
  const { produtos, specs } = catalogo(lista, {
    gpu: 1000, "cpu-x": 500, "cpu-y": 600, "mobo-x": 900, "mobo-y": 300, ram: 200, ssd: 200, psu: 200, case: 200,
  });

  it("prefere CPU + placa-mãe mais barata em conjunto", () => {
    const r = autoBuild(produtos, specs, prefs(4000, 4000, 0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.parts.find((p) => p.category === "cpu")!.product.slug).toBe("cpu-y");
    expect(r.parts.find((p) => p.category === "motherboard")!.product.slug).toBe("mobo-y");
    expect(r.totalPix).toBe(2700);
  });

  it("a montagem mais barata considera o par", () => {
    const cheapest = cheapestCompatibleBuild(buildCandidates(produtos, specs, true))!;
    expect(cheapest.total).toBe(2700);
    expect(cheapest.parts.find((p) => p.category === "cpu")!.product.slug).toBe("cpu-y");
  });
});

/** Força bruta: todas as combinações (só para catálogos minúsculos). */
function cheapestBruteForce(products: ProductWithOffers[], specs: Record<string, PartSpec>, trustedOnly: boolean) {
  const cands = buildCandidates(products, specs, trustedOnly);
  const cats: Category[] = ["gpu", "cpu", "motherboard", "ram", "ssd", "psu", "case"];
  let best: number | null = null;
  const go = (i: number, acc: PartSpec[], total: number) => {
    if (i === cats.length) {
      if (best === null || total < best) best = total;
      return;
    }
    for (const c of cands[cats[i]]) {
      if (isCompatible(acc, c.spec)) go(i + 1, [...acc, c.spec], total + c.price);
    }
  };
  go(0, [], 0);
  return best;
}

describe("catálogo sintético grande (B1)", () => {
  const grande = syntheticCatalog(150, 2026);
  const USOS: (UsageProfile | undefined)[] = [undefined, "jogos", "trabalho", "criacao"];

  it("a montagem mais barata é exata (confere com força bruta em catálogos pequenos)", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { products, specs } = syntheticCatalog(3, seed);
      for (const trusted of [true, false]) {
        const esperado = cheapestBruteForce(products, specs, trusted);
        const obtido = cheapestCompatibleBuild(buildCandidates(products, specs, trusted));
        if (esperado === null) expect(obtido).toBeNull();
        else expect(obtido?.total).toBeCloseTo(esperado, 2);
      }
    }
  });

  it("monta com 150 peças por categoria em menos de 200 ms (mediana de 5 execuções por cenário)", () => {
    // Aquecimento: as primeiras execuções pagam a compilação (JIT) e não contam.
    for (let i = 0; i < 3; i++) autoBuild(grande.products, grande.specs, prefs(8000, 9000));
    // Mediana, e não a pior: uma pausa do coletor de lixo ou do CI numa execução
    // isolada não deve derrubar o teste, mas a montagem típica tem de caber em 200 ms.
    const mediana = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    let pior = 0;
    for (const [alvo, teto, a, trusted] of [
      [6000, 7000, 25, true], [12000, 15000, 80, false], [4000, 4000, 0, true], [20000, 25000, 50, false],
    ] as [number, number, number, boolean][]) {
      const tempos: number[] = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        autoBuild(grande.products, grande.specs, prefs(alvo, teto, a, trusted));
        tempos.push(performance.now() - t0);
      }
      pior = Math.max(pior, mediana(tempos));
    }
    expect(pior).toBeLessThan(200);
  }, 30_000);

  it("INVARIANTES em 200 combinações aleatórias de preferências", () => {
    const rnd = seededRandom(7);
    let sucessos = 0;
    for (let i = 0; i < 200; i++) {
      const target = Math.round(2000 + rnd() * 20000);
      const hardCap = target + Math.round(rnd() < 0.3 ? 0 : rnd() * 5000);
      const p: BuildPreferences = {
        budget: { target, hardCap },
        trustedOnly: rnd() < 0.5,
        aesthetics: Math.round(rnd() * 100),
        usage: USOS[Math.floor(rnd() * USOS.length)],
      };
      const r = autoBuild(grande.products, grande.specs, p);
      if (!r.ok) {
        // Só pode falhar se nem a montagem mais barata cabe no teto.
        const cheapest = cheapestCompatibleBuild(buildCandidates(grande.products, grande.specs, p.trustedOnly));
        expect(cheapest === null || cheapest.total > hardCap).toBe(true);
        continue;
      }
      sucessos++;
      expect(r.totalPix).toBeLessThanOrEqual(hardCap);
      expect(r.parts.map((x) => x.category).sort()).toEqual([...CATEGORIAS].sort());
      expect(todasCompativeis(r)).toBe(true);
      if (p.trustedOnly) expect(r.parts.every((x) => isTrustedStore(x.offer.store))).toBe(true);
      // F-04: só troca que custou dinheiro conta como uso da folga.
      expect(r.usedWiggleRoom).toBe((r.upgrades ?? []).some((u) => u.priceDelta > 0) && r.totalPix > target);
      for (const n of r.notes) expect(n).not.toContain("-R$");
      for (const n of r.notes) expect(n).not.toMatch(/NaN|Infinity|undefined/);
      for (const u of r.upgrades ?? []) {
        expect(Number.isFinite(u.perfGainPct)).toBe(true);
        expect(Number.isFinite(u.priceDelta)).toBe(true);
      }
    }
    expect(sucessos).toBeGreaterThan(100);
  }, 30_000); // 200 montagens completas: folga para máquinas de CI lentas
});
