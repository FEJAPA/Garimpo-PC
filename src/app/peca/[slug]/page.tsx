// Página de detalhe de uma peça: comparação entre lojas (Pix × parcelado,
// confiabilidade) e o gráfico de histórico de preços.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getProductBySlug, getPriceHistory } from "@/services/products";
import { registerView } from "@/services/popularity";
import { categoryLabel } from "@/models/categories";
import { formatBRL, getBestOffer } from "@/lib/format";
import { StoreBadge } from "@/components/StoreBadge";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { PriceAlertButton } from "@/components/PriceAlertButton";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/SectionTitle";

export default async function ProductPage(props: PageProps<"/peca/[slug]">) {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  await registerView(product.id);

  const history = await getPriceHistory(product);
  const melhor = getBestOffer(product);
  const ofertas = [...product.offers].sort((a, b) => a.price_pix - b.price_pix);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/busca" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Todas as peças
      </Link>

      <header className="mt-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{product.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge>{categoryLabel(product.category)}</Badge>
          {product.brand && <Badge>{product.brand}</Badge>}
        </div>
        {product.description && <p className="mt-4 max-w-[65ch] text-ink-muted">{product.description}</p>}
      </header>

      {melhor && (
        <Card className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-ink-muted">Melhor preço agora (Pix)</p>
            <p className="font-display text-4xl font-semibold tracking-tight text-ink">{formatBRL(melhor.price_pix)}</p>
            <p className="mt-1 text-sm text-ink-muted">
              na <strong className="text-ink">{melhor.store.name}</strong>
            </p>
          </div>
          <PriceAlertButton productSlug={product.slug} productName={product.name} currentPrice={melhor.price_pix} />
        </Card>
      )}

      <section className="mt-10">
        <SectionTitle title="Comparação entre lojas" description="Ordenado do menor para o maior preço no Pix." />
        <Card padding="none" className="mt-4 overflow-hidden">
          <ul>
            {ofertas.map((oferta, i) => (
              <li
                key={oferta.id}
                className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${i > 0 ? "border-t border-line" : ""}`}
              >
                <div className="flex flex-col items-start gap-1.5">
                  <StoreBadge store={oferta.store} showLabel />
                  {!oferta.in_stock && <Badge tone="bad">Indisponível</Badge>}
                  {i === 0 && oferta.in_stock && <Badge tone="good">Menor preço</Badge>}
                </div>

                <div className="flex items-end justify-between gap-6 sm:justify-end">
                  <div className="text-right">
                    <p className="text-xs text-ink-faint">à vista / Pix</p>
                    <p className="tnum text-xl font-semibold text-ink">{formatBRL(oferta.price_pix)}</p>
                    {oferta.price_installment && oferta.installment_count && (
                      <p className="tnum text-xs text-ink-faint">
                        ou {oferta.installment_count}x de {formatBRL(oferta.price_installment / oferta.installment_count)} (
                        {formatBRL(oferta.price_installment)})
                      </p>
                    )}
                  </div>
                  {oferta.url && oferta.in_stock && (
                    <ButtonLink href={oferta.url} external size="sm">
                      Ver na loja
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </ButtonLink>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="mt-10">
        <SectionTitle title="Histórico de preços" description="Menor preço (Pix) entre as lojas ao longo do tempo." />
        <Card className="mt-4">
          <PriceHistoryChart data={history} />
        </Card>
      </section>
    </div>
  );
}
