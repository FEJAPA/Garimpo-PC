// Desempenho esperado: Índice GarimpoPC (número-herói), comparável mais próximo,
// "PCs parecidos com o seu" (V2, pacote D), gráfico de comparáveis e a tabela de
// FPS (a versão textual do gráfico).

import type { PerformanceEstimate, ReferenceBuild } from "@/models/builder-types";
import { GAME_PROFILE_LABELS, REFERENCE_BUILDS, RESOLUTION_LABELS } from "@/models/reference-builds";
import { closestReferences, NOTA_UPSCALING } from "@/services/builder/performance";
import { formatBRL } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { PerformanceChart } from "./PerformanceChart";

const PERFIS = ["esports", "aaa-medio", "aaa-pesado"] as const;
const RESOLUCOES = ["1080p", "1440p"] as const;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-10" → "out/2026"; formato inesperado volta como veio. */
function formatarMes(aaaamm: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(aaaamm);
  const mes = m ? MESES[Number(m[2]) - 1] : undefined;
  return m && mes ? `${mes}/${m[1]}` : aaaamm;
}

/** Linha "Fonte: ... (out/2026)" de uma referência, ou null se não houver fonte. */
function textoFonte(r: ReferenceBuild): string | null {
  if (!r.source) return null;
  return r.measuredAt ? `Fonte: ${r.source} (${formatarMes(r.measuredAt)})` : `Fonte: ${r.source}`;
}

export function PerformancePanel({
  estimate,
  references = REFERENCE_BUILDS,
}: {
  estimate: PerformanceEstimate;
  /** Referências vindas de getReferenceBuilds() (servidor); sem elas, a lista local. */
  references?: ReferenceBuild[];
}) {
  // TODO(V2-D): a página /montar ainda não passa `references` do servidor (pacote F).
  const parecidos = closestReferences(estimate.score, references, 3);
  const idsParecidos = new Set(parecidos.map((r) => r.id));
  return (
    <section>
      <SectionTitle
        title="Desempenho esperado"
        description="Comparado com computadores de referência. Estimativa: o resultado real varia com jogo, drivers e configurações."
      />
      <Card className="mt-4 flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-ink-muted">Índice GarimpoPC</p>
            <p className="font-display text-5xl font-semibold leading-none tracking-tight text-ink">{estimate.score}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-sm text-ink-muted">Equivale a um</p>
            <p className="font-semibold text-ink">{estimate.closest.name}</p>
            <p className="text-sm text-ink-faint">{estimate.closest.parts}</p>
          </div>
        </div>

        {estimate.notes.map((n) => (
          <Callout key={n} tone={n === NOTA_UPSCALING ? "info" : "warn"}>
            {n}
          </Callout>
        ))}

        {parecidos.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-ink">PCs parecidos com o seu</h3>
            <p className="text-xs text-ink-faint">Os computadores de referência com índice mais perto do seu.</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              {parecidos.map((r) => {
                const fonte = textoFonte(r);
                return (
                  <li key={r.id} className="flex flex-col gap-1 rounded-card border border-line bg-surface-2 px-4 py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold text-ink">{r.name}</p>
                      <p className="tnum shrink-0 text-sm text-ink-muted">
                        {r.score} <span className="text-xs text-ink-faint">índice</span>
                      </p>
                    </div>
                    <p className="text-sm text-ink-muted">{r.parts}</p>
                    <p className="tnum text-sm text-ink">≈ {formatBRL(r.approxPrice)}</p>
                    {fonte && <p className="text-xs text-ink-faint">{fonte}</p>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-ink">Sua montagem entre os PCs de referência</h3>
          <p className="text-xs text-ink-faint">Índice GarimpoPC (maior é melhor).</p>
          <div className="mt-3">
            <PerformanceChart score={estimate.score} references={references} similarIds={[...idsParecidos]} />
          </div>
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-ink-muted hover:text-ink">Ver como tabela</summary>
            <table className="mt-2 w-full text-left text-sm">
              <thead className="text-xs text-ink-faint">
                <tr>
                  <th className="py-1 font-medium">Computador</th>
                  <th className="py-1 font-medium">Peças</th>
                  <th className="py-1 text-right font-medium">Preço aprox.</th>
                  <th className="py-1 text-right font-medium">Índice</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {[...references].sort((a, b) => b.score - a.score).map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="py-1.5 text-ink">
                      {r.name}
                      {idsParecidos.has(r.id) && <span className="ml-1 text-xs text-ink-faint">· parecido</span>}
                    </td>
                    <td className="py-1.5 text-ink-muted">{r.parts}</td>
                    <td className="py-1.5 text-right text-ink-muted">{formatBRL(r.approxPrice)}</td>
                    <td className="py-1.5 text-right text-ink">{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>

        <div>
          <h3 className="text-sm font-medium text-ink">FPS médio estimado</h3>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-xs text-ink-faint">
              <tr>
                <th className="py-2 font-medium">Tipo de jogo</th>
                {RESOLUCOES.map((r) => (
                  <th key={r} className="py-2 text-right font-medium">
                    {RESOLUTION_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERFIS.map((p) => (
                <tr key={p} className="border-t border-line">
                  <td className="py-2.5">
                    <p className="text-ink">{GAME_PROFILE_LABELS[p].label}</p>
                    <p className="text-xs text-ink-faint">{GAME_PROFILE_LABELS[p].examples}</p>
                  </td>
                  {RESOLUCOES.map((r) => (
                    <td key={r} className="tnum py-2.5 text-right text-lg font-semibold text-ink">
                      {estimate.fps[p][r]}
                      <span className="ml-1 text-xs font-normal text-ink-faint">fps</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
