// Tipos que descrevem os dados do app (peças, lojas, ofertas e histórico).
// Eles espelham as tabelas do banco de dados (Supabase). Ver supabase/schema.sql.

/**
 * Categoria de peça: as sete que o Montador combina (placa de vídeo, processador,
 * memória, armazenamento, placa-mãe, fonte e gabinete). Nomes em português:
 * src/models/categories.ts.
 */
export type Category = "gpu" | "cpu" | "ram" | "ssd" | "motherboard" | "psu" | "case";

/** Uma loja onde uma peça pode ser vendida. */
export type Store = {
  id: string;
  name: string;
  /** Nota de reputação da loja, de 0 a 5. */
  rating: number;
  /** Quantidade de vendas/avaliações que sustentam a nota. */
  rating_count: number;
  /** Se é uma loja oficial/curada por nós (garantia de fábrica, confiável). */
  is_official: boolean;
  /** URL do site da loja. */
  url: string | null;
  /** V2 (pacote C): nota no Reclame Aqui (0 a 10), se conhecida. */
  reclame_aqui_score?: number | null;
  /** V2 (pacote C): anos de mercado, se conhecido. */
  years_active?: number | null;
  /** V2 (pacote C): loja bloqueada por golpe/má reputação. Nunca é confiável. */
  blocked?: boolean;
};

/** Uma peça (produto canônico), independente de loja. */
export type Product = {
  id: string;
  /** Identificador amigável usado na URL, ex.: "rtx-4060". */
  slug: string;
  name: string;
  category: Category;
  brand: string | null;
  /** Resumo em linguagem simples, para o público leigo. */
  description: string | null;
  image_url: string | null;
  /** Se a peça é um "destaque" curado manualmente (vitrine da home). */
  featured?: boolean;
};

/** Uma oferta: uma peça à venda em uma loja específica. */
export type Offer = {
  id: string;
  product_id: string;
  store_id: string;
  /** Link direto para o produto na loja. */
  url: string | null;
  /** Preço à vista/PIX (em reais). */
  price_pix: number;
  /** Preço parcelado total (em reais), normalmente maior que o do PIX. */
  price_installment: number | null;
  /** Em quantas vezes pode parcelar. */
  installment_count: number | null;
  /** Se a oferta está disponível no momento. */
  in_stock: boolean;
  /** V2 (pacote G): quando o preço desta oferta foi lido pela última vez (ISO 8601). */
  recorded_at?: string | null;
};

/** Um registro de preço de uma oferta em um momento do tempo. */
export type PricePoint = {
  id: string;
  offer_id: string;
  /** Data/hora da leitura do preço (ISO 8601). */
  recorded_at: string;
  price_pix: number;
};

// --- Tipos combinados, usados nas telas ---

/** Uma oferta já com os dados da loja embutidos. */
export type OfferWithStore = Offer & { store: Store };

/** Uma peça com todas as suas ofertas (cada uma com a loja). */
export type ProductWithOffers = Product & { offers: OfferWithStore[] };
