// Funções de formatação e ajuda para exibir preços e ofertas.
//
// "Melhor preço" e aviso de oferta suspeita ficam aqui para a página da peça, os
// cards, o botão de alerta e a rota de alertas seguirem a MESMA regra (AGENTS.md).
// `formatBRL` mora em ./currency (módulo-folha) e é reexportada aqui: assim os
// serviços de confiança a usam sem importar este arquivo (que importa eles).

import type { OfferWithStore, ProductWithOffers, Store } from "@/models/types";
import { flagSuspiciousOffers } from "@/services/builder/suspicious";
import { trustLevel, validOffers } from "@/services/builder/trust";
import { formatBRL } from "./currency";

export { formatBRL };

/** Formata uma data ISO para "DD/MM", ex.: "2026-06-15" -> "15/06". */
export function formatDayMonth(isoDate: string): string {
  const [, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}`;
}

/** A mais barata (menor preço Pix) de uma lista não vazia. */
function maisBarata(ofertas: OfferWithStore[]): OfferWithStore {
  return ofertas.reduce((melhor, o) => (o.price_pix < melhor.price_pix ? o : melhor));
}

/**
 * A "melhor oferta" de uma peça: a mais barata (preço Pix) entre as que estão em
 * estoque, com preço maior que zero, de loja não bloqueada e NÃO suspeita.
 *
 * Se só restarem ofertas suspeitas, devolve a mais barata delas (para a peça não
 * sumir da tela); quem mostrar essa oferta deve avisar com `offerWarning`.
 * Devolve null quando não há oferta utilizável.
 */
export function getBestOffer(product: ProductWithOffers): OfferWithStore | null {
  const validas = validOffers(product, false);
  if (validas.length === 0) return null;
  const suspeitas = flagSuspiciousOffers(product);
  const normais = validas.filter((o) => !suspeitas.has(o.id));
  return maisBarata(normais.length > 0 ? normais : validas);
}

/**
 * Aviso para mostrar junto de uma oferta, ou null se não há o que avisar.
 * Oferta "boa demais" (≥ 25% abaixo da mediana das lojas confiáveis) e oferta de
 * loja bloqueada nunca são mostradas em silêncio.
 */
export function offerWarning(product: ProductWithOffers, offer: OfferWithStore): string | null {
  if (offer.store.blocked) {
    return "Loja bloqueada por denúncias: não recomendamos comprar aqui.";
  }
  return flagSuspiciousOffers(product).get(offer.id)?.reason ?? null;
}

/**
 * Rótulo curto de confiança de uma loja. Vem de `storeTrust` (a mesma régua do
 * filtro "só lojas confiáveis"), nunca da nota sozinha: a nota continua visível
 * como número ao lado.
 */
export function trustLabel(store: Store): "Confiável" | "Não verificada" | "Bloqueada" {
  const nivel = trustLevel(store);
  if (nivel === "blocked") return "Bloqueada";
  return nivel === "trusted" ? "Confiável" : "Não verificada";
}

/**
 * Resumo em texto do histórico de preços, para leitores de tela (o gráfico em si
 * é só imagem). Os pontos vêm em ordem de data, como `getPriceHistory` entrega.
 */
export function priceHistorySummary(data: { date: string; price: number }[]): string {
  if (data.length === 0) return "Ainda não há histórico de preços para esta peça.";
  const primeiro = data[0];
  const ultimo = data[data.length - 1];
  if (data.length === 1) {
    return `Histórico de preços: ${formatBRL(primeiro.price)} em ${formatDayMonth(primeiro.date)} (um único registro).`;
  }
  const precos = data.map((d) => d.price);
  return (
    `Histórico de preços: de ${formatBRL(primeiro.price)} em ${formatDayMonth(primeiro.date)} ` +
    `a ${formatBRL(ultimo.price)} em ${formatDayMonth(ultimo.date)}. ` +
    `No período, menor preço ${formatBRL(Math.min(...precos))}, maior ${formatBRL(Math.max(...precos))}.`
  );
}
