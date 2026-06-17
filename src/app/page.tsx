// Página inicial (vitrine): apresenta o GarimpoPC, mostra as peças mais
// procuradas/destaques e leva para a busca completa.

import Link from "next/link";
import { Suspense } from "react";
import { getPopularProducts } from "@/services/popularity";
import { usingRealData } from "@/services/products";
import { ProductCard } from "@/components/ProductCard";
import { SearchBar } from "@/components/SearchBar";
import { CATEGORIES } from "@/models/categories";

const DIFERENCIAIS = [
  {
    emoji: "🎮",
    titulo: "Focado em hardware gamer",
    texto: "Especializado em peças de PC gamer, com dados e curadoria que comparadores genéricos não têm.",
  },
  {
    emoji: "🛡️",
    titulo: "Lojas confiáveis (anti-golpe)",
    texto: "Mostramos a reputação de cada loja e priorizamos vendedores oficiais com garantia.",
  },
  {
    emoji: "📉",
    titulo: "Histórico de preço real",
    texto: "Gráficos honestos revelam se a “promoção” é de verdade ou preço inflado.",
  },
  {
    emoji: "💬",
    titulo: "Simples para todos",
    texto: "Linguagem acessível para quem não entende de hardware, sem perder o detalhe técnico.",
  },
];

export default async function HomePage() {
  const populares = await getPopularProducts(6);
  const dadosReais = usingRealData();

  return (
    <div className="mx-auto max-w-5xl px-4">
      {/* Vitrine / apresentação */}
      <section className="py-12 text-center sm:py-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-muted">
          ⛏️ garimpe o melhor preço de hardware
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          O preço certo do seu <span className="text-gradient">PC gamer</span>, sem cair em
          falsas promoções
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-ink-muted">
          Compare preços de peças entre lojas confiáveis do Brasil e veja o histórico real para
          comprar na hora certa.
        </p>
        <div className="mt-8 flex justify-center">
          <Suspense fallback={null}>
            <SearchBar />
          </Suspense>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((c) => (
            <Link
              key={c.code}
              href={`/busca?q=${encodeURIComponent(c.label)}`}
              className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-muted transition hover:border-brand hover:text-ink"
            >
              {c.emoji} {c.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Diferenciais */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DIFERENCIAIS.map((d) => (
          <div key={d.titulo} className="rounded-2xl border border-line bg-surface p-5">
            <div className="text-2xl" aria-hidden>
              {d.emoji}
            </div>
            <h3 className="mt-2 font-semibold text-ink">{d.titulo}</h3>
            <p className="mt-1 text-sm text-ink-muted">{d.texto}</p>
          </div>
        ))}
      </section>

      {/* Mais procuradas / destaques */}
      <section className="py-12">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">🔥 Mais procuradas</h2>
            <p className="mt-1 text-sm text-ink-muted">
              As peças que a galera mais acompanha agora.
            </p>
          </div>
          <Link href="/busca" className="whitespace-nowrap text-sm text-accent hover:underline">
            Ver todas →
          </Link>
        </div>

        {!dadosReais && (
          <div className="mb-6 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
            <strong>Modo de demonstração.</strong> Peças e preços abaixo são de exemplo.
          </div>
        )}

        {populares.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {populares.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-ink-faint">Nenhuma peça cadastrada ainda.</p>
        )}
      </section>
    </div>
  );
}
