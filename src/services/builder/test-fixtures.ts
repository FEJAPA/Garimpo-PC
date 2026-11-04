// Fábricas de dados para os testes do Montador (não é um arquivo de teste).

import type { BuildPart, FormFactor, PartSpec, RamType, Socket } from "@/models/builder-types";
import type { Category, OfferWithStore, ProductWithOffers, Store } from "@/models/types";

export const LOJA_KABUM: Store = { id: "kabum", name: "KaBuM!", rating: 4.8, rating_count: 125000, is_official: true, url: "https://www.kabum.com.br" };
export const LOJA_PICHAU: Store = { id: "pichau", name: "Pichau", rating: 4.6, rating_count: 48000, is_official: true, url: "https://www.pichau.com.br" };
export const LOJA_DUVIDOSA: Store = { id: "duvidosa", name: "Loja Duvidosa", rating: 3.5, rating_count: 90, is_official: false, url: null };

export type OfferInput = {
  store: Store;
  price: number;
  installment?: number | null;
  count?: number | null;
  inStock?: boolean;
};

/** Cria um produto com ofertas a partir de uma lista compacta. */
export function makeProduct(slug: string, category: Category, offers: OfferInput[]): ProductWithOffers {
  const id = `p-${slug}`;
  return {
    id,
    slug,
    name: slug,
    category,
    brand: null,
    description: null,
    image_url: null,
    offers: offers.map((o, i): OfferWithStore => ({
      id: `o-${slug}-${o.store.id}-${i}`,
      product_id: id,
      store_id: o.store.id,
      url: o.store.url,
      price_pix: o.price,
      price_installment: o.installment === undefined ? Math.round(o.price * 1.1 * 100) / 100 : o.installment,
      installment_count: o.count === undefined ? 10 : o.count,
      in_stock: o.inStock ?? true,
      store: o.store,
    })),
  };
}

/** Cria uma peça já escolhida (para testes de pagamento/desempenho). */
export function makePart(
  spec: PartSpec,
  offer: OfferInput
): BuildPart {
  const product = makeProduct(spec.slug, spec.category, [offer]);
  return { category: spec.category, product, offer: product.offers[0], spec, price: offer.price };
}

/**
 * Gerador pseudoaleatório com semente (mulberry32): a mesma semente gera sempre
 * a mesma sequência, então os testes "aleatórios" são reproduzíveis.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SOCKETS: Socket[] = ["AM4", "AM5", "LGA1700"];
const FORMATOS: FormFactor[] = ["ATX", "mATX", "ITX"];
const POTENCIAS = [450, 550, 650, 750, 850, 1000];

/**
 * Catálogo sintético para testes de desempenho e de propriedade (V2-B1):
 * `perCategory` peças em cada uma das sete categorias, com specs coerentes,
 * preços que crescem com o desempenho (com ruído) e 1 a 3 ofertas por peça,
 * misturando lojas confiáveis e a "Loja Duvidosa" (às vezes bem mais barata,
 * para aparecer oferta suspeita) e algumas ofertas fora de estoque.
 */
export function syntheticCatalog(
  perCategory: number,
  seed = 2026
): { products: ProductWithOffers[]; specs: Record<string, PartSpec> } {
  const rnd = seededRandom(seed);
  const entre = (min: number, max: number) => min + rnd() * (max - min);
  const inteiro = (min: number, max: number) => Math.floor(entre(min, max + 1));
  const escolher = <T,>(lista: T[]): T => lista[Math.floor(rnd() * lista.length)];
  const preco = (base: number) => Math.round(base * entre(0.8, 1.3) * 100) / 100;

  const specs: Record<string, PartSpec> = {};
  const products: ProductWithOffers[] = [];

  const novaSpec = (cat: Category, i: number): { spec: PartSpec; base: number } => {
    const slug = `${cat}-${i}`;
    const aesthetics = inteiro(0, 100);
    switch (cat) {
      case "gpu": {
        const perf = inteiro(50, 250);
        return { spec: { slug, category: cat, perf, aesthetics, tdp: Math.round(60 + perf * entre(0.8, 1.2)) }, base: perf * 15 };
      }
      case "cpu": {
        const perf = inteiro(50, 200);
        return { spec: { slug, category: cat, perf, aesthetics, socket: escolher(SOCKETS), tdp: inteiro(35, 170) }, base: perf * 10 };
      }
      case "motherboard": {
        const socket = escolher(SOCKETS);
        const ramType: RamType = socket === "AM4" ? "DDR4" : socket === "AM5" ? "DDR5" : escolher<RamType>(["DDR4", "DDR5"]);
        const perf = inteiro(60, 140);
        return { spec: { slug, category: cat, perf, aesthetics, socket, ramType, formFactor: escolher(FORMATOS) }, base: perf * 9 };
      }
      case "ram": {
        const perf = inteiro(80, 160);
        return { spec: { slug, category: cat, perf, aesthetics, ramType: escolher<RamType>(["DDR4", "DDR5"]), capacityGb: escolher([16, 32, 64]) }, base: perf * 4 };
      }
      case "ssd": {
        const perf = inteiro(80, 200);
        return { spec: { slug, category: cat, perf, aesthetics, capacityGb: escolher([500, 1000, 2000]) }, base: perf * 5 };
      }
      case "psu": {
        const wattage = escolher(POTENCIAS);
        return { spec: { slug, category: cat, perf: inteiro(60, 140), aesthetics, wattage }, base: wattage * 0.6 };
      }
      case "case": {
        const caseSupports = FORMATOS.filter(() => rnd() < 0.6);
        if (caseSupports.length === 0) caseSupports.push(escolher(FORMATOS));
        return { spec: { slug, category: cat, perf: inteiro(40, 120), aesthetics, caseSupports }, base: 150 + aesthetics * 8 };
      }
    }
  };

  const CATEGORIAS: Category[] = ["gpu", "cpu", "motherboard", "ram", "ssd", "psu", "case"];
  for (const cat of CATEGORIAS) {
    for (let i = 0; i < perCategory; i++) {
      const { spec, base } = novaSpec(cat, i);
      const p = preco(base);
      const ofertas: OfferInput[] = [{ store: LOJA_KABUM, price: p, inStock: rnd() > 0.1 }];
      if (rnd() < 0.6) ofertas.push({ store: LOJA_PICHAU, price: preco(base), inStock: rnd() > 0.1 });
      // Marketplace: às vezes "boa demais" (30% abaixo), às vezes preço normal.
      if (rnd() < 0.4) {
        const fator = rnd() < 0.5 ? 0.7 : entre(0.9, 1.05);
        ofertas.push({ store: LOJA_DUVIDOSA, price: Math.round(p * fator * 100) / 100 });
      }
      specs[spec.slug] = spec;
      products.push(makeProduct(spec.slug, cat, ofertas));
    }
  }
  return { products, specs };
}
