"use client";

// Resultado da montagem: cabeçalho (total, situação e ações: salvar, copiar link,
// baixar lista), notas, peças, desempenho e pagamento.
//
// Acessibilidade (A11Y-04): ao montar, o foco vai para o cabeçalho do resultado
// (total e situação), que o leitor de tela lê; o resto fica para a navegação.

import { memo, useEffect, useRef, useState } from "react";
import { Check, Download, Link2 } from "lucide-react";
import type { BuildPreferences, BuildSuccess, ReferenceBuild } from "@/models/builder-types";
import { formatBRL } from "@/lib/format";
import { encodeBuild, shoppingListCsv } from "@/lib/share";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { BuildSummary } from "./BuildSummary";
import { PerformancePanel } from "./PerformancePanel";
import { PaymentPlanner } from "./PaymentPlanner";
import { SaveBuildButton } from "./SaveBuildButton";

function situacaoDe(result: BuildSuccess): { tone: BadgeTone; texto: string } {
  const { budget, totalPix, leftover, usedWiggleRoom } = result;
  if (usedWiggleRoom) return leftover < 1 ? { tone: "brand", texto: "Usou a folga até o teto" } : { tone: "warn", texto: "Usou a folga" };
  if (totalPix > budget.target) return { tone: "warn", texto: "Acima do alvo, dentro do teto" };
  return { tone: "good", texto: "Dentro do alvo" };
}

function linkDaMontagem(prefs: BuildPreferences, result: BuildSuccess): string {
  const code = encodeBuild(
    prefs,
    result.parts.map((p) => ({ slug: p.product.slug, storeId: p.offer.store_id })),
  );
  return `${window.location.origin}/montar?b=${code}`;
}

function CopiarLink({ prefs, result }: { prefs: BuildPreferences; result: BuildSuccess }) {
  const [estado, setEstado] = useState<"idle" | "copiado" | "falhou">("idle");
  const [url, setUrl] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copiar() {
    const link = linkDaMontagem(prefs, result);
    setUrl(link);
    try {
      await navigator.clipboard.writeText(link);
      setEstado("copiado");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setEstado("idle"), 2500);
    } catch {
      setEstado("falhou");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" onClick={copiar}>
        {estado === "copiado" ? <Check className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
        {estado === "copiado" ? "Link copiado" : "Copiar link"}
      </Button>
      <span role="status" className="sr-only">
        {estado === "copiado" ? "Link copiado" : ""}
      </span>
      {estado === "falhou" && (
        <label className="flex flex-col gap-1 text-xs text-ink-faint">
          Não deu para copiar sozinho. Copie o endereço abaixo:
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="h-8 w-full min-w-0 rounded-control border border-line-strong bg-surface-2 px-2 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
        </label>
      )}
    </div>
  );
}

function baixarLista(result: BuildSuccess) {
  const blob = new Blob([shoppingListCsv(result.parts)], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = "garimpopc-lista-de-compras.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function BuildResultViewImpl({
  result,
  prefs,
  references,
  focusOnMount = true,
}: {
  result: BuildSuccess;
  /** Preferências usadas nesta montagem (link, lista e "Salvar"). */
  prefs: BuildPreferences;
  /** PCs de referência vindos do servidor (getReferenceBuilds). */
  references?: ReferenceBuild[];
  /** Move o foco para o cabeçalho ao aparecer (montagem pedida pela pessoa). */
  focusOnMount?: boolean;
}) {
  const { budget } = result;
  const situacao = situacaoDe(result);
  const cabecalho = useRef<HTMLDivElement>(null);
  const ignoradas = result.ignored?.count ?? 0;

  useEffect(() => {
    if (focusOnMount) cabecalho.current?.focus();
  }, [focusOnMount]);

  return (
    <div className="flex flex-col gap-6">
      <Card
        ref={cabecalho}
        tabIndex={-1}
        aria-labelledby="resultado-titulo"
        className="flex scroll-mt-24 flex-col gap-5 outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <h2 id="resultado-titulo" className="sr-only">
          Sua montagem: {formatBRL(result.totalPix)} no Pix, {situacao.texto.toLowerCase()}
        </h2>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-ink-muted">Total no Pix</p>
            <p className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{formatBRL(result.totalPix)}</p>
            <p className="tnum mt-2 text-sm text-ink-muted">
              Alvo {formatBRL(budget.target)} · Teto {formatBRL(budget.hardCap)} · Sobra {formatBRL(result.leftover)}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Badge tone={situacao.tone} className="text-sm">
              {situacao.texto}
            </Badge>
            <p className="tnum text-sm text-ink-muted">ou {formatBRL(result.totalInstallment)} parcelado</p>
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2 border-t border-line pt-4">
          <SaveBuildButton prefs={prefs} result={result} />
          <CopiarLink prefs={prefs} result={result} />
          <Button type="button" variant="secondary" onClick={() => baixarLista(result)}>
            <Download className="h-4 w-4" aria-hidden />
            Baixar lista (CSV)
          </Button>
        </div>
      </Card>

      {(result.notes.length > 0 || ignoradas > 0) && (
        <Callout tone="info" title="Como chegamos aqui">
          <ul className="list-disc space-y-1 pl-4">
            {result.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            {ignoradas > 0 && (
              <li>
                {ignoradas === 1
                  ? "1 peça do catálogo ficou de fora porque não temos a especificação técnica dela."
                  : `${ignoradas} peças do catálogo ficaram de fora porque não temos a especificação técnica delas.`}
              </li>
            )}
          </ul>
        </Callout>
      )}

      <BuildSummary parts={result.parts} />
      <PerformancePanel estimate={result.performance} references={references} resolution={prefs.resolution ?? "1080p"} />
      <PaymentPlanner payment={result.payment} parts={result.parts} />
    </div>
  );
}

/** Memoizado (PERF-07): digitar no formulário não re-renderiza o resultado e o gráfico. */
export const BuildResultView = memo(BuildResultViewImpl);
