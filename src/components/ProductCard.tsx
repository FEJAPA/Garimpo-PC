// Card de uma peça na listagem: categoria, nome, menor preço e a loja onde está
// mais barata. O card inteiro é um link para a página de detalhe.

import Link from "next/link";
import type { ProductWithOffers } from "@/models/types";
import { categoryLabel } from "@/models/categories";
import { formatBRL, getBestOffer } from "@/lib/format";
import { StoreBadge } from "./StoreBadge";
import { Badge } from "./ui/Badge";

export function ProductCard({ product }: { product: ProductWithOffers }) {
  const melhor = getBestOffer(product);
  const numLojas = product.offers.filter((o) => o.in_stock).length;

  return (
    <Link
      href={`/peca/${product.slug}`}
      className="group flex flex-col rounded-card border border-line bg-surface p-5 transition-[border-color,background-color] duration-150 hover:border-line-strong hover:bg-surface-2"
    >
      <div className="flex items-center justify-between gap-2">
        <Badge>{categoryLabel(product.category)}</Badge>
        {numLojas > 1 && <span className="text-xs text-ink-faint">em {numLojas} lojas</span>}
      </div>
      <h3 className="mt-3 line-clamp-2 text-base font-medium leading-snug text-ink">{product.name}</h3>

      <div className="mt-auto pt-6">
        {melhor ? (
          <>
            <p className="text-xs text-ink-faint">menor preço no Pix</p>
            <p className="font-display text-2xl font-semibold tracking-tight text-ink">
              {formatBRL(melhor.price_pix)}
            </p>
            <div className="mt-2">
              <StoreBadge store={melhor.store} />
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-faint">Sem ofertas no momento</p>
        )}
      </div>
    </Link>
  );
}
