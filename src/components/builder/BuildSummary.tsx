// Lista das peças escolhidas, com loja (e por que ela é confiável), preço Pix e
// parcelado e link para a loja. Oferta "boa demais" (R-01) ganha um aviso.

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { BuildPart } from "@/models/builder-types";
import { categoryLabel } from "@/models/categories";
import { formatBRL } from "@/lib/format";
import { storeTrust } from "@/services/builder/trust";
import { StoreBadge } from "@/components/StoreBadge";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ButtonLink, safeHref } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
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
            const trust = storeTrust(offer.store);
            const motivos = trust.reasons.join(" · ");
            const link = safeHref(offer.url);
            const parcelado =
              offer.price_installment && offer.price_installment > 0 && offer.installment_count && offer.installment_count > 0
                ? { count: offer.installment_count, valor: offer.price_installment / offer.installment_count }
                : null;
            return (
              <li key={product.id} className={`flex flex-col gap-3 p-4 ${i > 0 ? "border-t border-line" : ""}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-control bg-surface-2 text-ink-muted">
                      <CategoryIcon category={part.category} className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-ink-faint">{categoryLabel(part.category)}</p>
                      <Link href={`/peca/${product.slug}`} className="font-medium break-words text-ink hover:text-brand">
                        {product.name}
                      </Link>
                      <div className="mt-1">
                        <StoreBadge store={offer.store} announceReasons={false} />
                      </div>
                      <p className="mt-1 text-xs text-ink-faint" title={motivos}>
                        {trust.trusted ? "Por que confiável: " : "Por que não marcamos como confiável: "}
                        {motivos}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-end justify-between gap-5 sm:justify-end">
                    <div className="text-right">
                      <p className="tnum text-lg font-semibold text-ink">{formatBRL(offer.price_pix)}</p>
                      {parcelado ? (
                        <p className="tnum text-xs text-ink-faint">
                          ou {parcelado.count}x de {formatBRL(parcelado.valor)}
                        </p>
                      ) : (
                        <p className="text-xs text-ink-faint">só à vista</p>
                      )}
                      {offer.recorded_at && (
                        <p className="text-xs text-ink-faint">
                          lido em {new Date(offer.recorded_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                        </p>
                      )}
                    </div>
                    {link ? (
                      <ButtonLink href={link} external size="sm" variant="secondary">
                        Ver na loja
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        <span className="sr-only">: {product.name}</span>
                      </ButtonLink>
                    ) : (
                      <span className="text-xs text-ink-faint">sem link</span>
                    )}
                  </div>
                </div>

                {part.suspicious && (
                  <Callout tone="warn" title="Preço bom demais?">
                    {part.suspicious.reason} Confira se a loja existe mesmo e se o anúncio é do produto certo antes de pagar.
                  </Callout>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
