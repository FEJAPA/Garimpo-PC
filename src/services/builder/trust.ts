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

/** Número informado de verdade (nem null, nem undefined, nem NaN). */
function informado(valor: number | null | undefined): valor is number {
  return typeof valor === "number" && Number.isFinite(valor);
}

/**
 * Avalia se a loja é confiável e explica o porquê.
 *
 * Regras: bloqueada → nunca; senão precisa ser oficial E ter nota >= 4,5; se o
 * Reclame Aqui for informado e ficar abaixo de 6, deixa de ser confiável. Sem
 * Reclame Aqui informado, vale a regra da V1 (oficial + nota).
 */
export function storeTrust(store: Store): StoreTrust {
  if (store.blocked) {
    return { trusted: false, reasons: ["Loja bloqueada por denúncias"] };
  }

  const reasons: string[] = [];
  let trusted = store.is_official && store.rating >= TRUSTED_MIN_RATING;

  reasons.push(store.is_official ? "Loja oficial" : "Não é loja oficial");

  if (store.rating >= TRUSTED_MIN_RATING) {
    reasons.push(`Nota ${umaCasa(store.rating)} (${store.rating_count.toLocaleString("pt-BR")} avaliações)`);
  } else {
    reasons.push(`Nota ${umaCasa(store.rating)}, abaixo de ${umaCasa(TRUSTED_MIN_RATING)}`);
  }

  const ra = store.reclame_aqui_score;
  if (informado(ra)) {
    if (ra < RECLAME_AQUI_MIN) {
      trusted = false;
      reasons.push(`Reclame Aqui baixo (${umaCasa(ra)})`);
    } else if (ra >= RECLAME_AQUI_GOOD) {
      reasons.push(`Reclame Aqui ${umaCasa(ra)}`);
    }
  }

  const anos = store.years_active;
  if (informado(anos) && anos >= YEARS_ACTIVE_GOOD) {
    reasons.push(`${anos} anos de mercado`);
  }

  return { trusted, reasons };
}

/** Confiável = storeTrust(store).trusted (oficial, nota >= 4,5, sem bloqueio nem Reclame Aqui baixo). */
export function isTrustedStore(store: Store): boolean {
  return storeTrust(store).trusted;
}

/** Preço Pix utilizável: número finito e maior que zero (V2, A2). */
function precoValido(preco: number): boolean {
  return Number.isFinite(preco) && preco > 0;
}

/** Ofertas em estoque e com preço válido; se trustedOnly, só as de lojas confiáveis. */
export function validOffers(product: ProductWithOffers, trustedOnly: boolean): OfferWithStore[] {
  return product.offers.filter(
    (o) => o.in_stock && precoValido(o.price_pix) && (!trustedOnly || isTrustedStore(o.store)),
  );
}

/** A oferta válida mais barata (preço Pix), ou null se não houver. */
export function cheapestOffer(product: ProductWithOffers, trustedOnly: boolean): OfferWithStore | null {
  const ofertas = validOffers(product, trustedOnly);
  if (ofertas.length === 0) return null;
  return ofertas.reduce((melhor, o) => (o.price_pix < melhor.price_pix ? o : melhor));
}
