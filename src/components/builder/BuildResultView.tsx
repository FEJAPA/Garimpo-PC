// Resultado da montagem: cabeçalho (total e situação), notas, peças, desempenho e pagamento.

import type { BuildSuccess } from "@/models/builder-types";
import { formatBRL } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { BuildSummary } from "./BuildSummary";
import { PerformancePanel } from "./PerformancePanel";
import { PaymentPlanner } from "./PaymentPlanner";

export function BuildResultView({ result }: { result: BuildSuccess }) {
  const { budget } = result;
  const noTeto = result.leftover < 1;
  const situacao = noTeto
    ? { tone: "brand" as const, texto: "No teto" }
    : result.usedWiggleRoom
      ? { tone: "warn" as const, texto: "Usou a folga" }
      : { tone: "good" as const, texto: "Dentro do alvo" };

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
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
          <p className="tnum text-sm text-ink-muted">
            ou {formatBRL(result.totalInstallment)} parcelado
          </p>
        </div>
      </Card>

      {result.notes.length > 0 && (
        <Callout tone="info" title="Como chegamos aqui">
          <ul className="list-disc space-y-1 pl-4">
            {result.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Callout>
      )}

      <BuildSummary parts={result.parts} />
      <PerformancePanel estimate={result.performance} />
      <PaymentPlanner payment={result.payment} />
    </div>
  );
}
