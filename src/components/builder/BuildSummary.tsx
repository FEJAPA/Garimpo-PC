// Lista das peças escolhidas, com loja, preço Pix e parcelado e link para a loja.

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { BuildPart } from "@/models/builder-types";
import { categoryLabel } from "@/models/categories";
import { formatBRL } from "@/lib/format";
import { StoreBadge } from "@/components/StoreBadge";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/SectionTitle";

export function BuildSummary({ parts }: { parts: BuildPart[] }) {
  return (
    <section>
      <SectionTitle title="Peças" description="Uma de cada categoria, todas compatíveis entre si." />
      <Card padding="none" className="mt-4 overflow-hidden">
        <ul>
          {parts.map((part, i) => {
            const { offer, product } = part;
            return (
              <li
                key={product.id}
                className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${i > 0 ? "border-t border-line" : ""}`}
              >
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-control bg-surface-2 text-ink-muted">
                    <CategoryIcon category={part.category} className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-ink-faint">{categoryLabel(part.category)}</p>
                    <Link href={`/peca/${product.slug}`} className="font-medium text-ink hover:text-brand">
                      {product.name}
                    </Link>
                    <div className="mt-1">
                      <StoreBadge store={offer.store} />
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-end justify-between gap-5 sm:justify-end">
                  <div className="text-right">
                    <p className="tnum text-lg font-semibold text-ink">{formatBRL(offer.price_pix)}</p>
                    {offer.price_installment && offer.installment_count ? (
                      <p className="tnum text-xs text-ink-faint">
                        ou {offer.installment_count}x de {formatBRL(offer.price_installment / offer.installment_count)}
                      </p>
                    ) : (
                      <p className="text-xs text-ink-faint">só à vista</p>
                    )}
                  </div>
                  {offer.url ? (
                    <ButtonLink href={offer.url} external size="sm" variant="secondary">
                      Ver na loja
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </ButtonLink>
                  ) : (
                    <span className="text-xs text-ink-faint">sem link</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
