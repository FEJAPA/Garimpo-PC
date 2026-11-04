// Camada de acesso a dados: as telas chamam estas funções para obter peças.
// Se o Supabase estiver configurado, busca no banco; senão, usa os dados de
// exemplo (mock). Assim a troca para dados reais é automática.
//
// V2 (pacote G):
// - G3: cada oferta traz `recorded_at`, a hora da última leitura do preço (último
//   ponto de price_history), para a tela dizer "preço de hoje às HH:MM".
// - R-12: números das lojas (numeric do Postgres) podem chegar como texto; aqui
//   viram Number() e `blocked` vira Boolean() antes de qualquer regra de confiança.
// - SEG-05: o termo de busca é limpo antes de entrar no filtro .or() do PostgREST.
// - LOG-13: o histórico agrupa por dia no fuso de Brasília, não em UTC.
// - S-17: o histórico só junta ofertas honestas (sem loja bloqueada nem preço
//   "bom demais"), a mesma régua do "melhor preço" do herói da /peca.

import { getSupabase, isSupabaseConfigured } from "@/models/supabase";
import { MOCK_PRODUCTS, MOCK_HISTORY } from "@/models/mock-data";
import { categoriesMatching, categoryLabel } from "@/models/categories";
import { validOffers } from "@/services/builder/trust";
import { flagSuspiciousOffers } from "@/services/builder/suspicious";
import type { OfferWithStore, ProductWithOffers, PricePoint, Store } from "@/models/types";

// Alias em português para deixar o código da busca mais legível.
const categoriasQueCorrespondem = categoriesMatching;

const SELECT_PRODUTO = "*, offers(*, store:stores(*))";

// --- Normalização (R-12) ---------------------------------------------------

/** Número finito ou null (null/""/lixo viram null: dado desconhecido não vira zero). */
function numeroOuNull(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** Boolean de verdade: aceita true/"true"/1; o resto é false. */
function booleano(valor: unknown): boolean {
  return valor === true || valor === "true" || valor === 1 || valor === "1";
}

/** Loja com os campos numéricos como number e `blocked` como boolean. */
export function normalizeStore(store: Store): Store {
  return {
    ...store,
    rating: numeroOuNull(store.rating) ?? 0,
    rating_count: numeroOuNull(store.rating_count) ?? 0,
    reclame_aqui_score: numeroOuNull(store.reclame_aqui_score),
    years_active: numeroOuNull(store.years_active),
    blocked: booleano(store.blocked),
  };
}

function normalizeOffer(offer: OfferWithStore): OfferWithStore {
  return {
    ...offer,
    // Preço ilegível vira NaN, que as regras de oferta válida já descartam (preço ≤ 0 ou não finito).
    price_pix: numeroOuNull(offer.price_pix) ?? Number.NaN,
    price_installment: numeroOuNull(offer.price_installment),
    installment_count: numeroOuNull(offer.installment_count),
    store: normalizeStore(offer.store),
  };
}

/** Peça como o banco devolve → peça com números e booleanos confiáveis. */
export function normalizeProduct(product: ProductWithOffers): ProductWithOffers {
  return { ...product, offers: (product.offers ?? []).map(normalizeOffer) };
}

// --- Hora do preço (G3) ----------------------------------------------------

/** Data mais recente (ISO) de cada oferta numa lista de pontos de histórico. */
export function lastRecordedByOffer(points: { offer_id: string; recorded_at: string }[]): Record<string, string> {
  const ultimo: Record<string, string> = {};
  for (const p of points) {
    const atual = ultimo[p.offer_id];
    if (!atual || Date.parse(p.recorded_at) > Date.parse(atual)) ultimo[p.offer_id] = p.recorded_at;
  }
  return ultimo;
}

/** Cópia das peças com `offer.recorded_at` preenchido (null quando não há leitura). */
export function attachRecordedAt(products: ProductWithOffers[], lastByOffer: Record<string, string>): ProductWithOffers[] {
  return products.map((p) => ({
    ...p,
    offers: p.offers.map((o) => ({ ...o, recorded_at: lastByOffer[o.id] ?? null })),
  }));
}

// No mock, a "última leitura" é a última data de MOCK_HISTORY (calculada uma vez).
let ultimoMock: Record<string, string> | null = null;
function ultimaLeituraMock(): Record<string, string> {
  if (!ultimoMock) {
    ultimoMock = lastRecordedByOffer(
      Object.entries(MOCK_HISTORY).flatMap(([offer_id, pontos]) => pontos.map((p) => ({ offer_id, ...p }))),
    );
  }
  return ultimoMock;
}

function mockComHora(products: ProductWithOffers[]): ProductWithOffers[] {
  return attachRecordedAt(products, ultimaLeituraMock());
}

/** Quantos ids de oferta vão em cada `.in()` (a URL do PostgREST tem limite de tamanho). */
const LOTE_IDS = 150;

/**
 * Busca a última leitura de preço por oferta na view `offer_last_seen`
 * (max(recorded_at) agrupado por offer_id; ver supabase/schema-alerts.sql).
 * Em erro, devolve {} e o catálogo segue sem a hora (a tela não inventa horário).
 */
async function ultimaLeituraBanco(offerIds: string[]): Promise<Record<string, string>> {
  const supabase = getSupabase();
  if (!supabase || offerIds.length === 0) return {};

  const lotes: string[][] = [];
  for (let i = 0; i < offerIds.length; i += LOTE_IDS) lotes.push(offerIds.slice(i, i + LOTE_IDS));

  const respostas = await Promise.all(
    lotes.map((ids) => supabase.from("offer_last_seen").select("offer_id, recorded_at").in("offer_id", ids)),
  );
  const pontos: { offer_id: string; recorded_at: string }[] = [];
  for (const { data, error } of respostas) {
    if (error) {
      console.error("Erro ao buscar a hora dos preços (offer_last_seen):", error.message);
      return {};
    }
    pontos.push(...((data ?? []) as { offer_id: string; recorded_at: string }[]));
  }
  return lastRecordedByOffer(pontos);
}

/** Normaliza as peças do banco e junta a hora da última leitura de cada oferta. */
async function prepararDoBanco(brutas: ProductWithOffers[]): Promise<ProductWithOffers[]> {
  const products = brutas.map(normalizeProduct);
  const ids = products.flatMap((p) => p.offers.map((o) => o.id));
  return attachRecordedAt(products, await ultimaLeituraBanco(ids));
}

// --- Busca (SEG-05) ----------------------------------------------------------

/**
 * Limpa o termo para o filtro `.or()` do PostgREST: vírgula, parênteses, aspas,
 * `%`, `*`, `\` e `:` mudam o significado do filtro, então viram espaço.
 * Devolve em minúsculas e com espaços simples.
 */
export function sanitizeSearchTerm(termo: string): string {
  return termo
    .toLowerCase()
    .replace(/[,()"'%*\\:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
  if (!supabase) return mockComHora(MOCK_PRODUCTS);

  const { data, error } = await supabase.from("products").select(SELECT_PRODUTO).order("name");

  if (error) {
    console.error("Erro ao buscar peças no Supabase:", error.message);
    return [];
  }
  return prepararDoBanco((data ?? []) as ProductWithOffers[]);
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
    return mockComHora(MOCK_PRODUCTS.filter((p) => correspondeAoTermo(p, q)));
  }

  // No banco: busca por nome OU marca usando "ilike" (sem diferenciar maiúsculas).
  // Categoria é tratada à parte, traduzindo o termo em português para o código.
  const limpo = sanitizeSearchTerm(q);
  if (!limpo) return getProducts();
  const codigosCategoria = categoriasQueCorrespondem(limpo);
  const filtros = [`name.ilike.%${limpo}%`, `brand.ilike.%${limpo}%`];
  for (const cat of codigosCategoria) filtros.push(`category.eq.${cat}`);

  const { data, error } = await supabase
    .from("products")
    .select(SELECT_PRODUTO)
    .or(filtros.join(","))
    .order("name");

  if (error) {
    console.error("Erro na busca do Supabase:", error.message);
    return [];
  }
  return prepararDoBanco((data ?? []) as ProductWithOffers[]);
}

/** Busca uma peça pelo slug (ex.: "rtx-4060"). Retorna null se não existir. */
export async function getProductBySlug(slug: string): Promise<ProductWithOffers | null> {
  const supabase = getSupabase();
  if (!supabase) {
    const peca = MOCK_PRODUCTS.find((p) => p.slug === slug);
    return peca ? mockComHora([peca])[0] : null;
  }

  const { data, error } = await supabase.from("products").select(SELECT_PRODUTO).eq("slug", slug).maybeSingle();

  if (error) {
    console.error("Erro ao buscar a peça no Supabase:", error.message);
    return null;
  }
  if (!data) return null;
  const [peca] = await prepararDoBanco([data as ProductWithOffers]);
  return peca;
}

// --- Histórico (LOG-13) --------------------------------------------------------

const DIA_SAO_PAULO = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dia ("AAAA-MM-DD") de um instante ISO no fuso de Brasília. 01:30 UTC ainda é "ontem" aqui. */
export function dayInSaoPaulo(iso: string): string {
  return DIA_SAO_PAULO.format(new Date(iso));
}

/**
 * Histórico de preços de uma peça, juntando os pontos das ofertas honestas,
 * agrupados por data (usamos o MENOR preço do dia entre as lojas).
 */
export async function getPriceHistory(
  product: ProductWithOffers
): Promise<{ date: string; price: number }[]> {
  // S-17: só entram ofertas de hoje em estoque, de loja não bloqueada e que não
  // são "boas demais" (suspeitas). Senão o gráfico mostraria como "menor preço"
  // o valor de uma loja que o próprio site manda conferir (ex.: R$ 1.399,90 na
  // RTX 4060 do exemplo), enquanto o herói diz que o melhor preço é outro.
  const suspeitas = flagSuspiciousOffers(product);
  const offerIds = validOffers(product, false)
    .filter((o) => !suspeitas.has(o.id))
    .map((o) => o.id);
  if (offerIds.length === 0) return [];
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

  // Agrupa por dia (fuso de Brasília), guardando o menor preço observado naquele dia.
  const porDia = new Map<string, number>();
  for (const p of points) {
    const preco = Number(p.price_pix);
    if (!Number.isFinite(preco) || preco <= 0) continue;
    const dia = dayInSaoPaulo(p.recorded_at);
    const atual = porDia.get(dia);
    if (atual === undefined || preco < atual) {
      porDia.set(dia, preco);
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
