// Página de resultados da busca: /busca?q=termo

import type { Metadata } from "next";
import Link from "next/link";
import { searchProducts, usingRealData } from "@/services/products";
import { ProductCard } from "@/components/ProductCard";
import { CategoryChips } from "@/components/CategoryChips";
import { Callout } from "@/components/ui/Callout";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/SectionTitle";

/** O termo digitado, ou "" quando não há busca. */
function termoDaBusca(params: { [key: string]: string | string[] | undefined }): string {
  return typeof params.q === "string" ? params.q : "";
}

// Título por página (A11Y-02): "Busca: rtx". Sem termo, a página lista tudo.
export async function generateMetadata(props: PageProps<"/busca">): Promise<Metadata> {
  const q = termoDaBusca(await props.searchParams).trim();
  return { title: q ? `Busca: ${q.slice(0, 80)}` : "Todas as peças" };
}

export default async function BuscaPage(props: PageProps<"/busca">) {
  const params = await props.searchParams;
  const q = termoDaBusca(params);
  const results = await searchProducts(q);
  const dadosReais = usingRealData();
  const contagem = `${results.length} ${results.length === 1 ? "peça encontrada" : "peças encontradas"}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SectionTitle
        as="h1"
        title={q ? <>Resultados para “{q}”</> : "Todas as peças"}
        description={contagem}
      />
      <div className="mt-5">
        <CategoryChips />
      </div>

      {!dadosReais && (
        <Callout tone="warn" className="mt-6">
          <strong>Modo de demonstração.</strong> A busca funciona, mas só encontra as peças de exemplo.
        </Callout>
      )}

      {results.length > 0 ? (
        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </section>
      ) : (
        <Card className="mt-8 text-center" padding="lg">
          <p className="text-ink">Nenhuma peça encontrada para “{q}”.</p>
          <p className="mt-1 text-sm text-ink-muted">
            Tente outro termo (ex.: “RTX”, “Ryzen”, “SSD”) ou veja{" "}
            <Link href="/busca" className="font-medium text-brand hover:underline">
              todas as peças
            </Link>
            .
          </p>
        </Card>
      )}
    </div>
  );
}
