// Tela do Montador de PC (/montar). O servidor carrega o catálogo, as
// especificações, os PCs de referência e as tabelas de juros (R-02); a montagem
// em si roda no navegador (BuilderForm), por isso o resultado aparece na hora.
//
// Aceita ?alvo=6000&teto=7000 (vem do formulário da página inicial) e
// ?b=<código> (link de compartilhamento: restaura as escolhas e monta sozinho).

import type { Metadata } from "next";
import { getProducts, usingRealData } from "@/services/products";
import { getPartSpecs } from "@/services/specs";
import { getReferenceBuilds } from "@/services/references";
import { getInstallmentTables } from "@/services/installments";
import { parseMoney, MAX_MONEY } from "@/lib/money";
import { BuilderForm } from "@/components/builder/BuilderForm";
import { Callout } from "@/components/ui/Callout";
import { SectionTitle } from "@/components/ui/SectionTitle";

export const metadata: Metadata = {
  title: "Montar PC",
  description: "Monte um PC gamer completo dentro do seu orçamento, com peças compatíveis de lojas confiáveis.",
};

/** Lê um valor em reais da URL ("6000", "6.000", "6000,50"); fora do permitido → undefined. */
function numero(v: string | string[] | undefined): number | undefined {
  if (typeof v !== "string") return undefined;
  const n = parseMoney(v);
  return Number.isFinite(n) && n > 0 && n <= MAX_MONEY ? n : undefined;
}

function texto(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export default async function MontarPage(props: PageProps<"/montar">) {
  const params = await props.searchParams;
  const [products, specs, references, installmentTables] = await Promise.all([
    getProducts(),
    getPartSpecs(),
    getReferenceBuilds(),
    getInstallmentTables(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SectionTitle
        as="h1"
        title="Montar PC"
        description="Diga quanto pode gastar e como prefere o computador. A gente escolhe peças compatíveis, de lojas confiáveis, e mostra o que esperar."
      />

      {!usingRealData() && (
        <Callout tone="warn" className="mt-5">
          <strong>Modo de demonstração.</strong> Peças, preços, lojas e reputação (nota, Reclame Aqui), juros e índices
          de desempenho são de exemplo.
        </Callout>
      )}

      {usingRealData() && Object.keys(specs).length === 0 && (
        <Callout tone="warn" className="mt-5" title="Sem especificações cadastradas">
          O banco não tem a tabela <code>part_specs</code> preenchida, então nenhuma peça entra na montagem.
          Rode <code>npm run collect:specs</code> (ver docs/COLETA-SPECS.md).
        </Callout>
      )}

      {products.length === 0 ? (
        // F-17(a): lista vazia pode ser banco fora do ar OU tabela vazia; o texto não chuta qual.
        <Callout tone="bad" className="mt-5" title="Catálogo indisponível">
          Não conseguimos ler o catálogo agora, ou ele ainda está vazio. Se você administra o site, rode os scripts
          da pasta <code>supabase/</code>.
        </Callout>
      ) : (
        <div className="mt-6">
          <BuilderForm
            products={products}
            specs={specs}
            references={references}
            installmentTables={installmentTables}
            initialTarget={numero(params.alvo)}
            initialCap={numero(params.teto)}
            shareCode={texto(params.b)}
          />
        </div>
      )}
    </div>
  );
}
