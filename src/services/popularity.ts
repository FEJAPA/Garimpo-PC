// Serviço de popularidade das peças.
//
// - registerView(): registra uma visita a uma peça (chamado na página de detalhe).
// - getPopularProducts(): devolve as peças "mais procuradas".
//
// Estratégia (combinada, como o usuário pediu):
//   1) Tenta as mais VISITADAS de verdade (tabela product_views, últimos 30 dias).
//   2) Se não houver visitas suficientes, completa/usa os DESTAQUES manuais
//      (coluna products.featured).
//   3) Se nada disso existir (ex.: modo de exemplo), usa as primeiras peças.
//
// V2 (pacote G, R-12): as peças vindas do banco passam por normalizeProduct, para
// a nota da loja e o Reclame Aqui chegarem como número (e `blocked` como boolean)
// também na vitrine da home, como em products.ts.

import { getSupabase } from "@/models/supabase";
import { getAdminSupabase } from "@/models/supabase-admin";
import { MOCK_PRODUCTS } from "@/models/mock-data";
import { normalizeProduct } from "@/services/products";
import type { ProductWithOffers } from "@/models/types";

const SELECT = "*, offers(*, store:stores(*))";

/** Registra uma visita a uma peça (não trava a página se falhar). */
export async function registerView(productId: string): Promise<void> {
  const admin = getAdminSupabase();
  if (!admin) return; // sem chave de serviço, apenas ignora (ex.: modo de exemplo)
  try {
    await admin.from("product_views").insert({ product_id: productId });
  } catch {
    /* registrar visita nunca deve quebrar a navegação */
  }
}

/** Lista as peças mais procuradas (até `limit`). */
export async function getPopularProducts(limit = 6): Promise<ProductWithOffers[]> {
  const supabase = getSupabase();
  if (!supabase) {
    // Modo de exemplo: devolve as primeiras peças do mock (a ordem do arquivo faz de vitrine).
    return MOCK_PRODUCTS.slice(0, limit);
  }

  // 1) Mais visitadas nos últimos 30 dias (via a view popular_products).
  const populares = await maisVisitadas(limit);
  if (populares.length >= limit) return populares.map(normalizeProduct);

  // 2) Completa com destaques manuais (featured), sem repetir.
  const jaTem = new Set(populares.map((p) => p.id));
  const { data: destaques } = await supabase
    .from("products")
    .select(SELECT)
    .eq("featured", true)
    .limit(limit);

  const resultado = [...populares];
  for (const d of (destaques ?? []) as ProductWithOffers[]) {
    if (resultado.length >= limit) break;
    if (!jaTem.has(d.id)) {
      resultado.push(d);
      jaTem.add(d.id);
    }
  }

  // 3) Ainda faltando? Completa com quaisquer peças.
  if (resultado.length < limit) {
    const { data: quaisquer } = await supabase.from("products").select(SELECT).limit(limit);
    for (const p of (quaisquer ?? []) as ProductWithOffers[]) {
      if (resultado.length >= limit) break;
      if (!jaTem.has(p.id)) {
        resultado.push(p);
        jaTem.add(p.id);
      }
    }
  }

  return resultado.map(normalizeProduct);
}

/** Busca as peças mais visitadas (30 dias) que tenham ao menos 1 visita. */
async function maisVisitadas(limit: number): Promise<ProductWithOffers[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: ranking } = await supabase
    .from("popular_products")
    .select("product_id, views_30d")
    .gt("views_30d", 0)
    .order("views_30d", { ascending: false })
    .limit(limit);

  const ids = (ranking ?? []).map((r) => r.product_id as string);
  if (ids.length === 0) return [];

  const { data: produtos } = await supabase.from("products").select(SELECT).in("id", ids);
  const lista = (produtos ?? []) as ProductWithOffers[];

  // Mantém a ordem do ranking (mais visitada primeiro).
  const ordem = new Map(ids.map((id, i) => [id, i]));
  return lista.sort((a, b) => (ordem.get(a.id) ?? 0) - (ordem.get(b.id) ?? 0));
}
