// Camada de acesso a dados: as telas chamam estas funções para obter peças.
// Se o Supabase estiver configurado, busca no banco; senão, usa os dados de
// exemplo (mock). Assim a troca para dados reais é automática.

import { getSupabase, isSupabaseConfigured } from "@/models/supabase";
import { MOCK_PRODUCTS, MOCK_HISTORY } from "@/models/mock-data";
import { categoriesMatching, categoryLabel } from "@/models/categories";
import type { ProductWithOffers, PricePoint } from "@/models/types";

// Alias em português para deixar o código da busca mais legível.
const categoriasQueCorrespondem = categoriesMatching;

/** Diz se uma peça (mock) corresponde a um termo de busca já em minúsculas. */
function correspondeAoTermo(p: ProductWithOffers, q: string): boolean {
  const cats = categoriasQueCorrespondem(q);
  return (
    p.name.toLowerCase().includes(q) ||
    (p.brand ?? "").toLowerCase().includes(q) ||
    categoryLabel(p.category).toLowerCase().includes(q) ||
    cats.includes(p.category)
  );
}

/** Lista todas as peças com suas ofertas (cada oferta já traz a loja). */
export async function getProducts(): Promise<ProductWithOffers[]> {
  const supabase = getSupabase();
  if (!supabase) return MOCK_PRODUCTS;

  const { data, error } = await supabase
    .from("products")
    .select("*, offers(*, store:stores(*))")
    .order("name");

  if (error) {
    console.error("Erro ao buscar peças no Supabase:", error.message);
    return [];
  }
  return (data ?? []) as ProductWithOffers[];
}

/**
 * Pesquisa peças por texto livre (nome, marca ou categoria).
 * Ex.: "rtx", "amd", "memória", "processador". Sem termo, devolve tudo.
 */
export async function searchProducts(termo: string): Promise<ProductWithOffers[]> {
  const q = termo.trim().toLowerCase();
  if (!q) return getProducts();

  const supabase = getSupabase();
  if (!supabase) {
    // Modo de exemplo: filtra a lista mock localmente.
    return MOCK_PRODUCTS.filter((p) => correspondeAoTermo(p, q));
  }

  // No banco: busca por nome OU marca usando "ilike" (sem diferenciar maiúsculas).
  // Categoria é tratada à parte, traduzindo o termo em português para o código.
  const codigosCategoria = categoriasQueCorrespondem(q);
  const filtros = [`name.ilike.%${q}%`, `brand.ilike.%${q}%`];
  for (const cat of codigosCategoria) filtros.push(`category.eq.${cat}`);

  const { data, error } = await supabase
    .from("products")
    .select("*, offers(*, store:stores(*))")
    .or(filtros.join(","))
    .order("name");

  if (error) {
    console.error("Erro na busca do Supabase:", error.message);
    return [];
  }
  return (data ?? []) as ProductWithOffers[];
}

/** Busca uma peça pelo slug (ex.: "rtx-4060"). Retorna null se não existir. */
export async function getProductBySlug(slug: string): Promise<ProductWithOffers | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return MOCK_PRODUCTS.find((p) => p.slug === slug) ?? null;
  }

  const { data, error } = await supabase
    .from("products")
    .select("*, offers(*, store:stores(*))")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar a peça no Supabase:", error.message);
    return null;
  }
  return (data as ProductWithOffers) ?? null;
}

/**
 * Histórico de preços de uma peça, juntando os pontos de todas as ofertas,
 * agrupados por data (usamos o MENOR preço do dia entre as lojas).
 */
export async function getPriceHistory(
  product: ProductWithOffers
): Promise<{ date: string; price: number }[]> {
  const offerIds = product.offers.map((o) => o.id);
  let points: { recorded_at: string; price_pix: number }[] = [];

  const supabase = getSupabase();
  if (!supabase) {
    points = offerIds.flatMap((id) => MOCK_HISTORY[id] ?? []);
  } else {
    const { data, error } = await supabase
      .from("price_history")
      .select("recorded_at, price_pix, offer_id")
      .in("offer_id", offerIds)
      .order("recorded_at");
    if (error) {
      console.error("Erro ao buscar histórico no Supabase:", error.message);
      return [];
    }
    points = (data as PricePoint[]) ?? [];
  }

  // Agrupa por dia, guardando o menor preço observado naquele dia.
  const porDia = new Map<string, number>();
  for (const p of points) {
    const dia = p.recorded_at.slice(0, 10); // "AAAA-MM-DD"
    const atual = porDia.get(dia);
    if (atual === undefined || p.price_pix < atual) {
      porDia.set(dia, p.price_pix);
    }
  }

  return [...porDia.entries()]
    .map(([date, price]) => ({ date, price }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Atalho para as telas saberem se estamos usando dados reais ou de exemplo. */
export function usingRealData(): boolean {
  return isSupabaseConfigured();
}
