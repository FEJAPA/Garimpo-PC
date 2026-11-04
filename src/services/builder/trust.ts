// Filtro de "lojas confiáveis" do Montador (toggle da tela). Spec §2 e §5.1.
//
// V2 (pacote C): a confiança agora vem com motivos em linguagem simples
// (loja oficial, nota, Reclame Aqui, tempo de mercado, lista de bloqueio).
//
// TODO(V2-C): tornar os limiares configuráveis e alimentar o Reclame Aqui com
// dados reais (hoje os valores do mock são ilustrativos).

import type { OfferWithStore, ProductWithOffers, Store } from "@/models/types";
import type { StoreTrust } from "@/models/builder-types";

/** Nota mínima para uma loja oficial ser considerada confiável. */
export const TRUSTED_MIN_RATING = 4.5;
/** Abaixo desta nota no Reclame Aqui (0 a 10) a loja deixa de ser confiável. */
export const RECLAME_AQUI_MIN = 6;
/** A partir desta nota no Reclame Aqui ela vira um motivo de confiança. */
export const RECLAME_AQUI_GOOD = 7;
/** A partir de quantos anos de mercado isso vira um motivo de confiança. */
export const YEARS_ACTIVE_GOOD = 3;

/** Número com uma casa decimal no formato brasileiro, ex.: 4.8 -> "4,8". */
function umaCasa(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * Lê um campo numérico da loja que pode chegar como número OU como texto
 * ("4.8", vindo de `numeric` do banco). Devolve null quando não foi informado
 * (null, undefined, texto vazio) ou não dá para ler (NaN, "abc").
 */
function lerNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "string" && valor.trim() === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/**
 * A decisão "confiável ou não", sem montar texto nenhum (V2, S-14).
 *
 * Regras: bloqueada → nunca; senão precisa ser oficial E ter nota >= 4,5; se o
 * Reclame Aqui for informado e ficar abaixo de 6, deixa de ser confiável. Sem
 * Reclame Aqui informado, vale a regra da V1 (oficial + nota).
 *
 * Por que separada: `getBestOffer` e `flagSuspiciousOffers` perguntam isto 2 a
 * 3 vezes por oferta em /busca, /peca e nos alertas. Montar os motivos (com
 * `toLocaleString`) só para devolver um sim/não custava ~37 µs por chamada.
 * `storeTrust` usa esta mesma função, então as duas nunca discordam.
 *
 * Nota e Reclame Aqui podem chegar como texto; passam por `Number()` (ver
 * `lerNumero`) para a regra nunca ser pulada em silêncio.
 */
export function isTrustedStore(store: Store): boolean {
  if (store.blocked) return false;
  // Nota ilegível vale 0: nunca é confiável.
  const nota = lerNumero(store.rating) ?? 0;
  if (!store.is_official || nota < TRUSTED_MIN_RATING) return false;
  const ra = lerNumero(store.reclame_aqui_score);
  return !(ra !== null && ra < RECLAME_AQUI_MIN);
}

/**
 * Avalia se a loja é confiável e explica o porquê em linguagem simples.
 * A decisão vem de `isTrustedStore`; aqui só se escrevem os motivos.
 *
 * Nota, avaliações, Reclame Aqui e anos podem chegar como texto; todos passam
 * por `Number()` (ver `lerNumero`).
 */
export function storeTrust(store: Store): StoreTrust {
  if (store.blocked) {
    return { trusted: false, reasons: ["Loja bloqueada por denúncias"] };
  }

  const trusted = isTrustedStore(store);
  const nota = lerNumero(store.rating) ?? 0;
  const avaliacoes = lerNumero(store.rating_count) ?? 0;
  const reasons: string[] = [];

  reasons.push(store.is_official ? "Loja oficial" : "Não é loja oficial");

  if (nota >= TRUSTED_MIN_RATING) {
    reasons.push(`Nota ${umaCasa(nota)} (${avaliacoes.toLocaleString("pt-BR")} avaliações)`);
  } else {
    reasons.push(`Nota ${umaCasa(nota)}, abaixo de ${umaCasa(TRUSTED_MIN_RATING)}`);
  }

  const ra = lerNumero(store.reclame_aqui_score);
  if (ra !== null) {
    if (ra < RECLAME_AQUI_MIN) {
      reasons.push(`Reclame Aqui baixo (${umaCasa(ra)})`);
    } else if (ra >= RECLAME_AQUI_GOOD) {
      reasons.push(`Reclame Aqui ${umaCasa(ra)}`);
    }
  }

  const anos = lerNumero(store.years_active);
  if (anos !== null && anos >= YEARS_ACTIVE_GOOD) {
    reasons.push(`${anos} anos de mercado`);
  }

  return { trusted, reasons };
}

/** Os três estados de confiança que a tela mostra (selo, rótulo e cor). */
export type TrustLevel = "trusted" | "unverified" | "blocked";

/**
 * Estado de confiança para a tela, vindo da MESMA régua do filtro do Montador
 * (`isTrustedStore`, que `storeTrust` também usa). Selo, rótulo e cor usam isto, nunca a nota sozinha: uma loja
 * não oficial com nota 4,7 é "unverified", não "confiável".
 */
export function trustLevel(store: Store): TrustLevel {
  if (store.blocked) return "blocked";
  return isTrustedStore(store) ? "trusted" : "unverified";
}

/** Preço Pix utilizável: número finito e maior que zero (V2, A2). */
function precoValido(preco: number): boolean {
  return Number.isFinite(preco) && preco > 0;
}

/**
 * Ofertas em estoque e com preço válido; se trustedOnly, só as de lojas
 * confiáveis. Loja BLOQUEADA (denúncias de golpe) fica de fora SEMPRE, com o
 * filtro ligado ou não: nada a recomenda, nem em silêncio.
 */
export function validOffers(product: ProductWithOffers, trustedOnly: boolean): OfferWithStore[] {
  return product.offers.filter(
    (o) => o.in_stock && precoValido(o.price_pix) && !o.store.blocked && (!trustedOnly || isTrustedStore(o.store)),
  );
}

/** A oferta válida mais barata (preço Pix), ou null se não houver. */
export function cheapestOffer(product: ProductWithOffers, trustedOnly: boolean): OfferWithStore | null {
  const ofertas = validOffers(product, trustedOnly);
  if (ofertas.length === 0) return null;
  return ofertas.reduce((melhor, o) => (o.price_pix < melhor.price_pix ? o : melhor));
}
