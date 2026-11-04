// Lista das peças escolhidas, com loja, preço Pix e parcelado e link para a
// loja. Oferta "boa demais" (R-01) ganha um aviso.
//
// Confiança (T-5): a linha visível "Por que não marcamos como confiável: …" só
// aparece para loja NÃO confiável, que é quando o motivo ajuda a decidir. Para
// loja confiável, o selo basta; os motivos ficam no `title` e no texto para
// leitores de tela do StoreBadge (repetir a mesma frase em 7 peças virava ruído).
//
// "ou Nx de R$ X" vem de offerInstallment (F-12), a mesma conta da página da
// peça, do CSV e de "Como pagar". Com o resumo de pagamento (`payment`), o
// número de parcelas respeita a tabela de juros da loja.

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { BuildPart, PaymentSummary } from "@/models/builder-types";
import { categoryLabel } from "@/models/categories";
import { formatBRL } from "@/lib/format";
import { offerInstallment } from "@/services/builder/payments";
import { storeTrust } from "@/services/builder/trust";
import { StoreBadge } from "@/components/StoreBadge";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ButtonLink, safeHref } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/SectionTitle";

export function BuildSummary({
  parts,
  payment,
}: {
  parts: BuildPart[];
  /** Resumo de pagamento da montagem: traz a tabela de juros de cada loja. */
  payment?: PaymentSummary;
}) {
  return (
    <section>
      <SectionTitle title="Peças" description="Uma de cada categoria, todas compatíveis entre si." />
      <Card padding="none" className="mt-4 overflow-hidden">
        <ul>
          {parts.map((part, i) => {
            const { offer, product } = part;
            const trust = storeTrust(offer.store);
            const link = safeHref(offer.url);
            const tabela = payment?.stores.find((s) => s.store.id === offer.store.id)?.interestTable;
            const parcelado = offerInstallment(offer, tabela);
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
                        {/* Loja confiável: motivos só no title/leitor de tela. Não confiável: lista visível abaixo. */}
                        <StoreBadge store={offer.store} announceReasons={trust.trusted} />
                      </div>
                      {!trust.trusted && (
                        <p className="mt-1 text-xs text-ink-muted">
                          Por que não marcamos como confiável: {trust.reasons.join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-end justify-between gap-5 sm:justify-end">
                    <div className="text-right">
                      <p className="tnum text-lg font-semibold text-ink">{formatBRL(offer.price_pix)}</p>
                      {parcelado ? (
                        <p className="tnum text-xs text-ink-faint">
                          {parcelado.count > 1 ? `ou ${parcelado.count}x de ${formatBRL(parcelado.monthly)}` : `ou ${formatBRL(parcelado.total)} a prazo`}
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
