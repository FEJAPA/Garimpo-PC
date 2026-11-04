// Card de uma peça na listagem: categoria, nome, melhor preço e a loja onde está.
// O card inteiro é um link para a página de detalhe.
//
// O preço vem de getBestOffer: ignora preço zero, loja bloqueada e oferta "boa
// demais" (suspeita). Se só sobrar oferta suspeita, ela aparece COM aviso.
// Por isso o rótulo é "melhor preço" (S-22, a mesma palavra do herói da /peca):
// pode existir uma oferta mais barata, a suspeita, que foi pulada de propósito.

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { ProductWithOffers } from "@/models/types";
import { categoryLabel } from "@/models/categories";
import { formatBRL, getBestOffer, offerWarning } from "@/lib/format";
import { validOffers } from "@/services/builder/trust";
import { StoreBadge } from "./StoreBadge";
import { Badge } from "./ui/Badge";

export function ProductCard({ product }: { product: ProductWithOffers }) {
  const melhor = getBestOffer(product);
  const aviso = melhor ? offerWarning(product, melhor) : null;
  // Só conta lojas de onde dá para comprar (em estoque, preço válido, não bloqueadas).
  const numLojas = validOffers(product, false).length;

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
            <p className="text-xs text-ink-faint">{aviso ? "oferta mais barata no Pix" : "melhor preço no Pix"}</p>
            <p className="font-display text-2xl font-semibold tracking-tight text-ink">
              {formatBRL(melhor.price_pix)}
            </p>
            <div className="mt-2">
              <StoreBadge store={melhor.store} showLabel />
            </div>
            {aviso && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-warn">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                <span>Preço bom demais? Confira a loja antes de pagar.</span>
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-ink-faint">Sem ofertas no momento</p>
        )}
      </div>
    </Link>
  );
}
