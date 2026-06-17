// Página de resultados da busca: /busca?q=termo
// Pesquisa por nome, marca ou categoria e mostra os cards das peças encontradas.

import Link from "next/link";
import { searchProducts, usingRealData } from "@/services/products";
import { ProductCard } from "@/components/ProductCard";
import { CATEGORIES } from "@/models/categories";

export default async function BuscaPage(props: PageProps<"/busca">) {
  const params = await props.searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const results = await searchProducts(q);
  const dadosReais = usingRealData();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight">
        {q ? (
          <>
            Resultados para “<span className="text-gradient">{q}</span>”
          </>
        ) : (
          "Todas as peças"
        )}
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        {results.length} {results.length === 1 ? "peça encontrada" : "peças encontradas"}
      </p>

      {/* Atalhos de categoria */}
      <div className="mt-4 flex flex-wrap gap-2">
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

      {!dadosReais && (
        <div className="mt-6 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
          <strong>Modo de demonstração.</strong> A busca funciona, mas só encontra as peças de
          exemplo cadastradas.
        </div>
      )}

      {results.length > 0 ? (
        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </section>
      ) : (
        <div className="mt-10 rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="text-ink">Nenhuma peça encontrada para “{q}”.</p>
          <p className="mt-1 text-sm text-ink-muted">
            Tente outro termo, ou veja{" "}
            <Link href="/busca" className="text-accent hover:underline">
              todas as peças
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
