"use client";

// Formulário do Montador: entradas (orçamento, teto, perfil de uso, resolução,
// lojas confiáveis, slider) e o resultado (peças, desempenho, pagamento). Spec §3 e §8.
//
// Os dados (catálogo, especificações, referências e juros) chegam do servidor
// (montar/page.tsx, R-02). A montagem roda aqui, no navegador; o código da
// montagem e o resultado (com o gráfico) são carregados sob demanda (PERF-01).
//
// ?b=<código> (link de compartilhamento): restaura as escolhas e monta sozinho.
// Depois de cada montagem pedida pela pessoa, a URL vira /montar?b=<código> da
// montagem na tela (history.replaceState, sem navegar): recarregar a página ou
// voltar do "Entre para salvar a montagem" remonta a mesma coisa.

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Cpu, Wrench } from "lucide-react";
import type { ProductWithOffers } from "@/models/types";
import type {
  BuildContext,
  BuildPreferences,
  BuildResult,
  PartSpec,
  Resolution,
  UsageProfile,
} from "@/models/builder-types";
import { DEFAULT_BUDGET, normalizeBudget } from "@/services/builder/budget";
import { formatBRL } from "@/lib/format";
import { formatMoneyPreview, moneyError, parseMoney } from "@/lib/money";
import { decodeBuild, encodeBuild, type SharedBuild } from "@/lib/share";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { Field, MoneyInput } from "@/components/ui/Field";
import { Toggle } from "@/components/ui/Toggle";
import { Slider } from "@/components/ui/Slider";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";

const BuildResultView = dynamic(() => import("./BuildResultView").then((m) => m.BuildResultView), {
  loading: () => <ResultSkeleton />,
});

const USOS: SegmentedOption<UsageProfile>[] = [
  { value: "jogos", label: "Jogos", hint: "Mais dinheiro na placa de vídeo, para rodar jogos." },
  { value: "trabalho", label: "Trabalho", hint: "Processador e memória para estudo, escritório e muitas abas." },
  { value: "criacao", label: "Criação", hint: "Processador, memória e placa de vídeo equilibrados para editar vídeo, foto e 3D." },
];

// A resolução não muda as peças escolhidas: só destaca a coluna da tabela de
// FPS (T-4). A dica não pode prometer uma placa de vídeo mais forte.
const RESOLUCOES: SegmentedOption<Resolution>[] = [
  { value: "1080p", label: "Full HD", hint: "1920 × 1080, o monitor mais comum. Destaca a coluna da sua resolução na tabela de FPS." },
  { value: "1440p", label: "Quad HD", hint: "2560 × 1440, imagem mais nítida. Destaca a coluna da sua resolução na tabela de FPS." },
];

function dicaDe<T extends string>(opcoes: SegmentedOption<T>[], valor: T): string | undefined {
  return opcoes.find((o) => o.value === valor)?.hint;
}

function rotuloDoSlider(a: number): string {
  if (a <= 15) return "Máximo desempenho";
  if (a < 40) return "Prioriza desempenho";
  if (a <= 60) return "Equilibrado";
  if (a < 85) return "Prioriza o visual";
  return "Máxima estética";
}

/** "6000" -> "6000"; "6000.5" -> "6000,50" (a pessoa digita com vírgula). */
function paraTexto(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(2).replace(".", ",");
}

/**
 * Dica do campo de dinheiro com o valor entendido na frente (F-14):
 * "= R$ 6.000,50 · O valor que você tem em mente." Assim quem digita "6000.5"
 * vê na hora como o site leu.
 */
function comPrevia(texto: string, dica: string): ReactNode {
  const previa = formatMoneyPreview(texto);
  if (!previa) return dica;
  return (
    <>
      <span className="tnum font-medium text-ink-muted">{previa}</span> · {dica}
    </>
  );
}

/**
 * Slug "bem-comportado" (minúsculas, números e hífen, até 60). Só esse é repetido
 * na tela (F-10): o link é de quem o enviou, e um texto livre ali viraria uma
 * frase "oficial" do site escrita por outra pessoa.
 */
const SLUG_SEGURO = /^[a-z0-9-]{1,60}$/;

/** Código do link da montagem na tela (mesmo formato de "Copiar link"). */
function codigoDaMontagem(prefs: BuildPreferences, result: BuildResult): string | null {
  if (!result.ok) return null;
  return encodeBuild(
    prefs,
    result.parts.map((p) => ({ slug: p.product.slug, storeId: p.offer.store_id })),
  );
}

/** Notas sobre as peças do link que não existem mais (ou mudaram) na montagem de hoje. */
function notasDoLink(shared: SharedBuild, products: ProductWithOffers[], result: BuildResult): string[] {
  const notas: string[] = [];
  const escolhidas = new Set(result.ok ? result.parts.map((p) => p.product.slug) : []);
  for (const peca of shared.parts) {
    const produto = products.find((p) => p.slug === peca.slug);
    if (!produto) {
      notas.push(
        SLUG_SEGURO.test(peca.slug)
          ? `A peça “${peca.slug}” do link não está mais no catálogo.`
          : "Uma peça do link não está mais no catálogo.",
      );
    } else if (!produto.offers.some((o) => o.store_id === peca.storeId && o.in_stock)) {
      notas.push(`${produto.name} não está mais à venda na loja do link.`);
    } else if (result.ok && !escolhidas.has(peca.slug)) {
      notas.push(`${produto.name} saiu da montagem: com os preços de hoje, outra peça ficou melhor.`);
    }
  }
  return notas;
}

type Entrada = {
  result: BuildResult;
  /** Preferências usadas nesta montagem (para compartilhar/salvar o que está na tela). */
  prefs: BuildPreferences;
  /** Montagem pedida pela pessoa (move o foco) ou automática do link (não move). */
  focar: boolean;
  notasDoLink?: string[];
};

export function BuilderForm({
  products,
  specs,
  references,
  installmentTables,
  initialTarget,
  initialCap,
  shareCode,
}: {
  products: ProductWithOffers[];
  specs: Record<string, PartSpec>;
  references: NonNullable<BuildContext["references"]>;
  installmentTables: NonNullable<BuildContext["installmentTables"]>;
  initialTarget?: number;
  initialCap?: number;
  /** Código do link de compartilhamento (?b=). */
  shareCode?: string;
}) {
  const [shared] = useState<SharedBuild | null>(() => (shareCode ? decodeBuild(shareCode) : null));
  const linkInvalido = Boolean(shareCode) && !shared;
  const inicial = shared?.prefs;

  const [alvoTexto, setAlvoTexto] = useState(() =>
    paraTexto(inicial?.budget.target ?? initialTarget ?? DEFAULT_BUDGET.target),
  );
  const [tetoTexto, setTetoTexto] = useState(() =>
    paraTexto(inicial?.budget.hardCap ?? initialCap ?? Math.max(initialTarget ?? 0, DEFAULT_BUDGET.hardCap)),
  );
  const [trustedOnly, setTrustedOnly] = useState(inicial?.trustedOnly ?? true);
  const [aesthetics, setAesthetics] = useState(inicial?.aesthetics ?? 25);
  const [usage, setUsage] = useState<UsageProfile>(inicial?.usage ?? "jogos");
  const [resolution, setResolution] = useState<Resolution>(inicial?.resolution ?? "1080p");
  const [entrada, setEntrada] = useState<Entrada | null>(null);
  const [versao, setVersao] = useState(0);
  const [pending, startTransition] = useTransition();

  const alvo = parseMoney(alvoTexto);
  const tetoVazio = tetoTexto.trim() === "";
  const teto = tetoVazio ? alvo : parseMoney(tetoTexto);
  const alvoErro = moneyError(alvo);
  const tetoErro = tetoVazio ? null : moneyError(teto);
  const tetoMenor = !alvoErro && !tetoErro && teto < alvo;
  const orcamento = normalizeBudget({ target: alvoErro ? 0 : alvo, hardCap: tetoErro ? 0 : teto });
  const folga = orcamento.hardCap - orcamento.target;
  const podeMontar = !alvoErro && !tetoErro;

  function executar(prefs: BuildPreferences, focar: boolean, link?: SharedBuild) {
    startTransition(async () => {
      // Import tardio: o algoritmo só entra no navegador quando a pessoa monta.
      const { autoBuild } = await import("@/services/builder/auto-build");
      const result = autoBuild(products, specs, prefs, { references, installmentTables });
      // Montagem pedida pela pessoa: a URL passa a apontar para ela (só troca o
      // endereço, sem navegar nem remontar). A montagem automática do link não
      // mexe na URL, que já é o próprio link.
      const codigo = focar ? codigoDaMontagem(prefs, result) : null;
      if (codigo) window.history.replaceState(null, "", `${window.location.pathname}?b=${codigo}`);
      startTransition(() => {
        setEntrada({ result, prefs, focar, notasDoLink: link ? notasDoLink(link, products, result) : undefined });
        setVersao((v) => v + 1);
      });
    });
  }

  function montar(e: React.FormEvent) {
    e.preventDefault();
    if (!podeMontar) return;
    executar({ budget: orcamento, trustedOnly, aesthetics, usage, resolution }, true);
  }

  // Link compartilhado: monta uma vez ao abrir a página.
  const montouDoLink = useRef(false);
  useEffect(() => {
    if (!shared || montouDoLink.current) return;
    montouDoLink.current = true;
    executar({ ...shared.prefs, budget: normalizeBudget(shared.prefs.budget) }, false, shared);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só no primeiro carregamento
  }, []);

  const result = entrada?.result ?? null;
  const carregando = !entrada && (pending || Boolean(shared));

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
      {/* Painel de entradas */}
      <Card className="lg:sticky lg:top-24">
        <form onSubmit={montar} className="flex flex-col gap-5" aria-describedby="montador-ajuda" noValidate>
          <Field label="Quero gastar" htmlFor="alvo" hint={comPrevia(alvoTexto, "O valor que você tem em mente.")} error={alvoErro}>
            <MoneyInput id="alvo" value={alvoTexto} onChange={setAlvoTexto} placeholder="6.000" />
          </Field>

          <Field
            label="No máximo (teto)"
            htmlFor="teto"
            hint={comPrevia(
              tetoTexto,
              tetoMenor
                ? "Teto menor que o alvo: vamos considerar o teto igual ao alvo (sem folga)."
                : folga > 0
                  ? `Folga de ${formatBRL(folga)}, usada só se destravar uma peça bem melhor.`
                  : "Sem folga: a montagem fica dentro do valor que você quer gastar.",
            )}
            error={tetoErro}
          >
            <MoneyInput id="teto" value={tetoTexto} onChange={setTetoTexto} placeholder="7.000" />
          </Field>

          <SegmentedControl
            name="uso"
            label="Para que você vai usar?"
            value={usage}
            onChange={setUsage}
            options={USOS}
            description={dicaDe(USOS, usage)}
          />

          <SegmentedControl
            name="resolucao"
            label="Resolução do monitor"
            value={resolution}
            onChange={setResolution}
            options={RESOLUCOES}
            description={dicaDe(RESOLUCOES, resolution)}
          />

          <Toggle
            id="lojas-confiaveis"
            checked={trustedOnly}
            onChange={setTrustedOnly}
            label="Só lojas confiáveis"
            description="Lojas oficiais com nota 4,5 ou mais e sem reclamações graves. Desligue para ver ofertas de marketplaces (avisamos se o preço for bom demais)."
          />

          <Slider
            id="balanco"
            value={aesthetics}
            onChange={setAesthetics}
            label="O que importa mais?"
            leftLabel="Desempenho"
            rightLabel="Estética"
            valueLabel={rotuloDoSlider(aesthetics)}
          />

          <Button type="submit" size="lg" loading={pending} disabled={!podeMontar}>
            {result ? <Wrench className="h-4 w-4" aria-hidden /> : <Cpu className="h-4 w-4" aria-hidden />}
            {result ? "Montar de novo" : "Montar meu PC"}
          </Button>
          <p id="montador-ajuda" className="text-xs text-ink-faint">
            O total nunca passa do teto. Os preços são os da última coleta nas lojas, no Pix.
          </p>
        </form>
      </Card>

      {/* Resultado. O anúncio para leitor de tela fica no cabeçalho do resultado (foco) e no aviso de erro. */}
      <div className={`flex min-w-0 flex-col gap-6 transition-opacity duration-150 ${pending && entrada ? "opacity-60" : ""}`} aria-busy={pending}>
        {linkInvalido && !entrada && (
          <Callout tone="warn" title="Não conseguimos abrir este link">
            O link de montagem está incompleto ou foi alterado. Preencha os campos e clique em “Montar meu PC”.
          </Callout>
        )}
        {entrada?.notasDoLink && entrada.notasDoLink.length > 0 && (
          <Callout tone="info" title="Montagem compartilhada, com os preços de hoje">
            <ul className="list-disc space-y-1 pl-4">
              {entrada.notasDoLink.map((n, i) => (
                // Índice na chave: duas peças estranhas do link dão a mesma frase.
                <li key={`${i}-${n}`}>{n}</li>
              ))}
            </ul>
          </Callout>
        )}

        {carregando && <ResultSkeleton />}
        {!entrada && !carregando && <EstadoVazio />}
        {result && !result.ok && (
          <Callout tone="bad" title="Não deu para montar">
            {result.reason}
          </Callout>
        )}
        {entrada && result && result.ok && (
          <div key={versao} className="reveal">
            <BuildResultView result={result} prefs={entrada.prefs} references={references} focusOnMount={entrada.focar} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Esqueleto do resultado (cabeçalho, peças, desempenho) enquanto a montagem carrega. */
function ResultSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Montando seu PC…">
      <Card className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-11 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </Card>
      <Card padding="none" className="overflow-hidden">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className={`flex items-center gap-3 p-4 ${i > 0 ? "border-t border-line" : ""}`}>
            <Skeleton className="h-9 w-9 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <Skeleton className="h-6 w-20 shrink-0" />
          </div>
        ))}
      </Card>
      <Card>
        <Skeleton className="h-40 w-full" />
      </Card>
    </div>
  );
}

function EstadoVazio() {
  return (
    <Card padding="lg">
      <h2 className="font-display text-xl font-semibold tracking-tight text-ink">O que vai acontecer</h2>
      <ol className="mt-4 flex flex-col gap-3 text-sm text-ink-muted">
        <li className="flex gap-3">
          <span className="tnum font-display font-semibold text-brand">1</span>
          Dividimos o seu orçamento entre placa de vídeo, processador, placa-mãe, memória, SSD, fonte e gabinete, conforme o uso que você escolheu.
        </li>
        <li className="flex gap-3">
          <span className="tnum font-display font-semibold text-brand">2</span>
          Em cada categoria, escolhemos a melhor peça que cabe e combina com as outras (socket, memória, fonte, gabinete).
        </li>
        <li className="flex gap-3">
          <span className="tnum font-display font-semibold text-brand">3</span>
          Se a folga destravar uma peça bem melhor (placa de vídeo ou processador, conforme o uso), usamos; senão, ficamos no valor que você quer gastar.
        </li>
        <li className="flex gap-3">
          <span className="tnum font-display font-semibold text-brand">4</span>
          Mostramos o desempenho esperado comparado com PCs de referência e como pagar: Pix, parcelado ou misturando os dois.
        </li>
      </ol>
    </Card>
  );
}
