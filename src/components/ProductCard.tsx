// Card de uma peça na listagem: nome, categoria, menor preço e a loja onde está
// mais barata. O card inteiro é um link para a página de detalhe.

import Link from "next/link";
import type { ProductWithOffers } from "@/models/types";
import { formatBRL, getBestOffer } from "@/lib/format";
import { StoreBadge } from "./StoreBadge";

const CATEGORIA_LABEL: Record<string, string> = {
  gpu: "Placa de vídeo",
  cpu: "Processador",
  ram: "Memória RAM",
  ssd: "Armazenamento",
  motherboard: "Placa-mãe",
  psu: "Fonte",
  case: "Gabinete",
};

export function ProductCard({ product }: { product: ProductWithOffers }) {
  const melhor = getBestOffer(product);
  const numLojas = product.offers.filter((o) => o.in_stock).length;

  return (
    <Link
      href={`/peca/${product.slug}`}
      className="glow-hover group flex flex-col rounded-2xl border border-line bg-surface p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-brand-strong">
        {CATEGORIA_LABEL[product.category] ?? product.category}
      </span>
      <h3 className="mt-1 line-clamp-2 text-base font-semibold text-ink group-hover:text-white">
        {product.name}
      </h3>

      <div className="mt-auto pt-5">
        {melhor ? (
          <>
            <p className="text-xs text-ink-faint">menor preço (PIX)</p>
            <p className="text-2xl font-extrabold text-good">{formatBRL(melhor.price_pix)}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <StoreBadge store={melhor.store} />
              {numLojas > 1 && (
                <span className="whitespace-nowrap text-xs text-ink-faint">
                  em {numLojas} lojas
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-faint">Sem ofertas no momento</p>
        )}
      </div>
    </Link>
  );
}
