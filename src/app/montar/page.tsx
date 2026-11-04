// Tela do Montador de PC (/montar). O servidor carrega o catálogo; a montagem
// em si roda no navegador (BuilderForm), por isso o resultado aparece na hora.
//
// Aceita ?alvo=6000&teto=7000 (vem do formulário da página inicial).

import type { Metadata } from "next";
import { getProducts, usingRealData } from "@/services/products";
import { BuilderForm } from "@/components/builder/BuilderForm";
import { Callout } from "@/components/ui/Callout";
import { SectionTitle } from "@/components/ui/SectionTitle";

export const metadata: Metadata = {
  title: "Montar PC",
  description: "Monte um PC gamer completo dentro do seu orçamento, com peças compatíveis de lojas confiáveis.",
};

function numero(v: string | string[] | undefined): number | undefined {
  const n = Number(typeof v === "string" ? v : undefined);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default async function MontarPage(props: PageProps<"/montar">) {
  const params = await props.searchParams;
  const products = await getProducts();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SectionTitle
        as="h1"
        title="Montar PC"
        description="Diga quanto pode gastar e como prefere o computador. A gente escolhe peças compatíveis, de lojas confiáveis, e mostra o que esperar."
      />

      {!usingRealData() && (
        <Callout tone="warn" className="mt-5">
          <strong>Modo de demonstração.</strong> Peças, preços e índices de desempenho são de exemplo.
        </Callout>
      )}

      {products.length === 0 ? (
        <Callout tone="bad" className="mt-5" title="Catálogo vazio">
          O banco de dados não tem peças. Rode os scripts da pasta <code>supabase/</code> (ver README).
        </Callout>
      ) : (
        <div className="mt-6">
          <BuilderForm products={products} initialTarget={numero(params.alvo)} initialCap={numero(params.teto)} />
        </div>
      )}
    </div>
  );
}
