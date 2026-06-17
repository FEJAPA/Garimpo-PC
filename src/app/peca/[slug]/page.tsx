// Página de detalhe de uma peça: comparação entre lojas (preço PIX vs.
// parcelado, confiabilidade) e o gráfico de histórico de preços.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getPriceHistory } from "@/services/products";
import { registerView } from "@/services/popularity";
import { formatBRL, getBestOffer } from "@/lib/format";
import { StoreBadge } from "@/components/StoreBadge";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { PriceAlertButton } from "@/components/PriceAlertButton";

export default async function ProductPage(props: PageProps<"/peca/[slug]">) {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  // Conta esta visita para o ranking de "mais procuradas" (não trava se falhar).
  await registerView(product.id);

  const history = await getPriceHistory(product);
  const melhor = getBestOffer(product);
  // Ofertas ordenadas da mais barata para a mais cara.
  const ofertas = [...product.offers].sort((a, b) => a.price_pix - b.price_pix);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/" className="text-sm text-accent hover:underline">
        ← Voltar para a lista
      </Link>

      <header className="mt-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-strong">
          {product.brand}
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{product.name}</h1>
        {product.description && (
          <p className="mt-2 max-w-2xl text-ink-muted">{product.description}</p>
        )}
      </header>

      {melhor && (
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-brand/30 bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-ink-muted">Melhor preço agora (PIX)</p>
            <p className="text-3xl font-extrabold text-good">{formatBRL(melhor.price_pix)}</p>
            <p className="mt-1 text-sm text-ink-muted">
              na <strong className="text-ink">{melhor.store.name}</strong>
            </p>
          </div>
          <PriceAlertButton
            productSlug={product.slug}
            productName={product.name}
            currentPrice={melhor.price_pix}
          />
        </div>
      )}

      {/* Comparação entre lojas */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Comparação entre lojas</h2>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {ofertas.map((oferta, i) => (
            <div
              key={oferta.id}
              className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${
                i > 0 ? "border-t border-line" : ""
              }`}
            >
              <div className="flex flex-col gap-1">
                <StoreBadge store={oferta.store} showLabel />
                {!oferta.in_stock && (
                  <span className="text-xs font-medium text-bad">Indisponível</span>
                )}
              </div>

              <div className="flex items-end justify-between gap-6 sm:justify-end">
                <div className="text-right">
                  <p className="text-xs text-ink-faint">à vista / PIX</p>
                  <p className="text-xl font-bold text-ink">{formatBRL(oferta.price_pix)}</p>
                  {oferta.price_installment && oferta.installment_count && (
                    <p className="text-xs text-ink-faint">
                      ou {oferta.installment_count}x de{" "}
                      {formatBRL(oferta.price_installment / oferta.installment_count)} (
                      {formatBRL(oferta.price_installment)})
                    </p>
                  )}
                </div>
                {oferta.url && oferta.in_stock && (
                  <a
                    href={oferta.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whitespace-nowrap rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong"
                  >
                    Ver na loja
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Histórico de preços */}
      <section className="mt-8">
        <h2 className="mb-1 text-lg font-semibold">Histórico de preços</h2>
        <p className="mb-3 text-sm text-ink-faint">
          Menor preço (PIX) entre as lojas ao longo do tempo.
        </p>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <PriceHistoryChart data={history} />
        </div>
      </section>
    </div>
  );
}
