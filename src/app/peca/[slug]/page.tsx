// Página de detalhe de uma peça: comparação entre lojas (Pix × parcelado,
// confiabilidade) e o gráfico de histórico de preços.
//
// V2 (pacote C): cada loja mostra "Por que confiável" (motivos de storeTrust) e
// ofertas "boas demais" (flagSuspiciousOffers) ganham um aviso.
//
// O herói "Melhor preço agora" usa getBestOffer: pula preço zero, loja bloqueada e
// oferta suspeita. Loja bloqueada aparece na lista com o selo "Bloqueada" e SEM o
// botão "Ver na loja". O botão também some se a URL não for http/https (safeHref) ou se
// a peça estiver sem estoque.
//
// "ou Nx de R$ X (R$ total)" vem de offerInstallment, a MESMA regra da lista de peças
// e de "Como pagar" no Montador, com a tabela de juros da loja (F-12): dado ruim (zero,
// negativo) não aparece, as parcelas ficam entre 1 e 24 e no máximo o que a tabela da
// loja aceita, e o total nunca fica abaixo do Pix. Antes, a tela testava
// `price_installment && installment_count` e o React escrevia "0" quando um deles era 0 (S-13).

import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import { getProductBySlug, getPriceHistory, usingRealData } from "@/services/products";
import { registerView } from "@/services/popularity";
import { storeTrust } from "@/services/builder/trust";
import { flagSuspiciousOffers } from "@/services/builder/suspicious";
import { offerInstallment } from "@/services/builder/payments";
import { getInstallmentTables } from "@/services/installments";
import { categoryLabel } from "@/models/categories";
import { formatBRL, getBestOffer, offerWarning } from "@/lib/format";
import { StoreBadge } from "@/components/StoreBadge";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { PriceAlertButton } from "@/components/PriceAlertButton";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink, safeHref } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/SectionTitle";

// A busca da peça roda duas vezes por visita (título e página); `cache` faz o banco
// ser consultado uma vez só.
const carregarPeca = cache(getProductBySlug);

export async function generateMetadata(props: PageProps<"/peca/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await carregarPeca(slug);
  if (!product) return { title: "Peça não encontrada" };
  return {
    title: product.name,
    description:
      product.description ??
      `Compare o preço de ${product.name} em lojas confiáveis, no Pix e parcelado, e veja o histórico de preços.`,
  };
}

export default async function ProductPage(props: PageProps<"/peca/[slug]">) {
  const { slug } = await props.params;
  const product = await carregarPeca(slug);
  if (!product) notFound();

  await registerView(product.id);

  const [history, tabelasDeJuros] = await Promise.all([getPriceHistory(product), getInstallmentTables()]);
  const dadosReais = usingRealData();
  const melhor = getBestOffer(product);
  // Se a melhor oferta for suspeita (só sobrou ela), o herói avisa ao lado do preço.
  const avisoMelhor = melhor ? offerWarning(product, melhor) : null;
  const ofertas = [...product.offers].sort((a, b) => a.price_pix - b.price_pix);
  const suspeitas = flagSuspiciousOffers(product);

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

      {!dadosReais && (
        <Callout tone="warn" className="mt-6">
          <strong>Modo de demonstração.</strong> Peças, lojas e preços são de exemplo.
        </Callout>
      )}

      {melhor && (
        <Card className="mt-6 flex flex-col gap-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-ink-muted">Melhor preço agora (Pix)</p>
              <p className="font-display text-4xl font-semibold tracking-tight text-ink">{formatBRL(melhor.price_pix)}</p>
              <p className="mt-1 text-sm text-ink-muted">
                na <strong className="text-ink">{melhor.store.name}</strong>
              </p>
            </div>
            <PriceAlertButton productSlug={product.slug} productName={product.name} currentPrice={melhor.price_pix} />
          </div>
          {avisoMelhor && (
            <Callout tone="warn" title="Preço bom demais?">
              {avisoMelhor}
            </Callout>
          )}
        </Card>
      )}

      <section className="mt-10">
        <SectionTitle title="Comparação entre lojas" description="Ordenado do menor para o maior preço no Pix." />
        <Card padding="none" className="mt-4 overflow-hidden">
          <ul>
            {ofertas.map((oferta, i) => {
              const confianca = storeTrust(oferta.store);
              const suspeita = suspeitas.get(oferta.id);
              const bloqueada = Boolean(oferta.store.blocked);
              const parcelado = offerInstallment(oferta, tabelasDeJuros[oferta.store.id]);
              // Uma guarda só: link seguro (http/https), em estoque e de loja não bloqueada.
              const linkDaLoja = oferta.in_stock && !bloqueada ? safeHref(oferta.url) : null;
              const IconeConfianca = confianca.trusted ? ShieldCheck : ShieldAlert;
              return (
                <li key={oferta.id} className={`flex flex-col gap-3 p-4 ${i > 0 ? "border-t border-line" : ""}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col items-start gap-1.5">
                      <StoreBadge store={oferta.store} showLabel announceReasons={false} />
                      {!oferta.in_stock && <Badge tone="bad">Indisponível</Badge>}
                      {melhor?.id === oferta.id && !suspeita && <Badge tone="good">Melhor preço</Badge>}
                      <div className="mt-1">
                        <p className="text-xs font-medium text-ink-muted">
                          {confianca.trusted ? "Por que confiável" : "Por que não marcamos como confiável"}
                        </p>
                        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          {confianca.reasons.map((motivo) => (
                            <li
                              key={motivo}
                              className={`inline-flex items-center gap-1 text-xs ${confianca.trusted ? "text-good" : "text-warn"}`}
                            >
                              <IconeConfianca className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                              {motivo}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="flex items-end justify-between gap-6 sm:justify-end">
                      <div className="text-right">
                        <p className="text-xs text-ink-faint">à vista / Pix</p>
                        <p className="tnum text-xl font-semibold text-ink">{formatBRL(oferta.price_pix)}</p>
                        {parcelado && (
                          <p className="tnum text-xs text-ink-faint">
                            ou {parcelado.count}x de {formatBRL(parcelado.monthly)} ({formatBRL(parcelado.total)})
                          </p>
                        )}
                      </div>
                      {linkDaLoja && (
                        <ButtonLink href={linkDaLoja} external size="sm">
                          Ver na loja
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </ButtonLink>
                      )}
                    </div>
                  </div>
                  {bloqueada && (
                    <Callout tone="warn" title="Loja bloqueada por denúncias">
                      Não recomendamos comprar aqui: por isso não mostramos o botão da loja e ela não entra no melhor preço.
                    </Callout>
                  )}
                  {suspeita && (
                    <Callout tone="warn" title="Preço bom demais?">
                      {suspeita.reason}
                    </Callout>
                  )}
                </li>
              );
            })}
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
