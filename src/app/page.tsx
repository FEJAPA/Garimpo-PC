// Página inicial: convence a montar um PC ou comparar peças, e mostra as mais procuradas.

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Cpu, LineChart, MessageCircle, ShieldCheck, Wallet } from "lucide-react";
import { getPopularProducts } from "@/services/popularity";
import { usingRealData } from "@/services/products";
import { ProductCard } from "@/components/ProductCard";
import { CategoryChips } from "@/components/CategoryChips";
import { ButtonLink, Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { DEFAULT_BUDGET } from "@/services/builder/budget";

// O layout acrescenta " · GarimpoPC" ao título (A11Y-02: cada página tem o seu).
export const metadata: Metadata = {
  title: "Monte e compare seu PC gamer",
};

const PASSOS = [
  {
    titulo: "Diga quanto pode gastar",
    texto: "Um valor que você quer gastar e um teto que não passa. A folga entre os dois só é usada se valer a pena.",
  },
  {
    titulo: "Escolha o estilo",
    texto: "Só lojas confiáveis? Mais desempenho ou mais visual? Dois controles, sem jargão.",
  },
  {
    titulo: "Veja o que esperar",
    texto: "Peças compatíveis, desempenho comparado com PCs de referência e como pagar: Pix ou parcelado.",
  },
];

const DIFERENCIAIS = [
  { icon: ShieldCheck, titulo: "Lojas confiáveis", texto: "Reputação visível e filtro para só considerar lojas oficiais." },
  { icon: LineChart, titulo: "Histórico de preço real", texto: "O gráfico mostra se a promoção é de verdade ou preço inflado." },
  { icon: Wallet, titulo: "Pix ou parcelado", texto: "Os dois preços, por loja, e quanto você economiza à vista." },
  { icon: MessageCircle, titulo: "Linguagem simples", texto: "Explicamos cada escolha para quem não entende de hardware." },
];

export default async function HomePage() {
  const populares = await getPopularProducts(6);
  const dadosReais = usingRealData();

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* Abertura */}
      <section className="grid gap-10 py-12 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-20">
        <div>
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            Monte seu PC gamer pelo preço certo, sem cair em golpe.
          </h1>
          <p className="mt-5 max-w-[60ch] text-lg text-ink-muted">
            Diga quanto pode gastar. O GarimpoPC escolhe peças compatíveis em lojas confiáveis, mostra o
            desempenho que você pode esperar e como pagar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/montar" size="lg">
              <Cpu className="h-5 w-5" aria-hidden />
              Montar meu PC
            </ButtonLink>
            <ButtonLink href="/busca" variant="secondary" size="lg">
              Comparar peças
            </ButtonLink>
          </div>
          <div className="mt-8">
            <CategoryChips />
          </div>
        </div>

        <Card padding="lg" className="shadow-float">
          {/* F-01: sem validação nativa e com step="any". Com step={100} o navegador
              recusava 6550 com uma mensagem própria; o /montar já lê e valida o valor. */}
          <form action="/montar" method="get" className="flex flex-col gap-4" noValidate>
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight text-ink">Quanto você pode gastar?</h2>
              <p className="mt-1 text-sm text-ink-muted">Comece com o valor que quer gastar e o máximo que aceita.</p>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Quero gastar
              <span className="relative block">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-normal text-ink-faint">R$</span>
                <input
                  name="alvo"
                  type="number"
                  min={0}
                  step="any"
                  defaultValue={DEFAULT_BUDGET.target}
                  className="tnum h-11 w-full rounded-control border border-line-strong bg-surface-2 pl-10 pr-3 font-normal text-ink outline-none transition-[border-color,box-shadow] duration-150 hover:border-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
              </span>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              No máximo
              <span className="relative block">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-normal text-ink-faint">R$</span>
                <input
                  name="teto"
                  type="number"
                  min={0}
                  step="any"
                  defaultValue={DEFAULT_BUDGET.hardCap}
                  className="tnum h-11 w-full rounded-control border border-line-strong bg-surface-2 pl-10 pr-3 font-normal text-ink outline-none transition-[border-color,box-shadow] duration-150 hover:border-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
              </span>
            </label>
            <Button type="submit" size="lg">
              Montar com esse orçamento
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
            <p className="text-xs text-ink-faint">A folga entre os dois valores só é usada quando destrava uma peça bem melhor.</p>
          </form>
        </Card>
      </section>

      {/* Como funciona */}
      <section className="py-10">
        <SectionTitle title="Como funciona" description="Três passos; o resto é com a gente." />
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {PASSOS.map((p, i) => (
            <li key={p.titulo} className="flex gap-4">
              <span className="font-display text-3xl font-bold leading-none text-brand tnum" aria-hidden>
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold text-ink">{p.titulo}</h3>
                <p className="mt-1 text-sm text-ink-muted">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Mais procuradas */}
      <section className="py-10">
        <SectionTitle
          title="Mais procuradas"
          description="As peças que a galera mais acompanha agora."
          action={
            <Link href="/busca" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
              Ver todas <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          }
        />
        {!dadosReais && (
          <Callout tone="warn" className="mt-5">
            <strong>Modo de demonstração.</strong> Peças e preços são de exemplo.
          </Callout>
        )}
        {populares.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {populares.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-ink-faint">Nenhuma peça cadastrada ainda.</p>
        )}
      </section>

      {/* Diferenciais */}
      <section className="py-10">
        <SectionTitle title="Por que o GarimpoPC" />
        <ul className="mt-6 grid gap-x-10 gap-y-5 sm:grid-cols-2">
          {DIFERENCIAIS.map((d) => (
            <li key={d.titulo} className="flex gap-3">
              <d.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" strokeWidth={1.75} aria-hidden />
              <div>
                <h3 className="font-semibold text-ink">{d.titulo}</h3>
                <p className="mt-0.5 text-sm text-ink-muted">{d.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
