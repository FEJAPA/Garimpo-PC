// Desempenho esperado: Índice GarimpoPC (número-herói), comparável mais próximo,
// "PCs parecidos com o seu" (V2, pacote D), gráfico de comparáveis e a tabela de
// FPS (a versão textual do gráfico).

import { Info } from "lucide-react";
import type { PerformanceEstimate, ReferenceBuild, Resolution } from "@/models/builder-types";
import {
  FONTES_CONSULTADAS_EM,
  GAME_PROFILE_LABELS,
  REFERENCE_BUILDS,
  RESOLUTION_LABELS,
} from "@/models/reference-builds";
import { closestReferences, isUpscalingNote, SEM_REFERENCIA } from "@/services/builder/performance";
import { formatBRL } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { PerformanceChart } from "./PerformanceChart";

const PERFIS = ["esports", "aaa-medio", "aaa-pesado"] as const;
const RESOLUCOES = ["1080p", "1440p"] as const;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Nota de metodologia (docs/METODOLOGIA-DESEMPENHO.md). O app ainda não tem uma página
 * para ela, então o link vai para o arquivo no repositório.
 * TODO(V2-D): trocar por uma página interna (ex.: /metodologia) que renderize o documento.
 */
const URL_METODOLOGIA = "/metodologia";

/** "2026-10" → "out/2026"; formato inesperado volta como veio. */
function formatarMes(aaaamm: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(aaaamm);
  const mes = m ? MESES[Number(m[2]) - 1] : undefined;
  return m && mes ? `${mes}/${m[1]}` : aaaamm;
}

/** Mês de referência mais recente entre as referências (AAAA-MM), ou null se nenhuma tiver. */
function mesDeReferenciaDasFontes(refs: ReferenceBuild[]): string | null {
  const meses = refs.map((r) => r.measuredAt).filter((m): m is string => /^\d{4}-\d{2}$/.test(m ?? ""));
  return meses.length > 0 ? meses.sort()[meses.length - 1] : null;
}

export function PerformancePanel({
  estimate,
  references = REFERENCE_BUILDS,
  resolution = "1080p",
}: {
  estimate: PerformanceEstimate;
  /** Referências vindas de getReferenceBuilds() (servidor); sem elas, a lista local. */
  references?: ReferenceBuild[];
  /** Resolução-alvo escolhida pela pessoa (BuildPreferences.resolution): destaca a coluna na tabela de FPS. */
  resolution?: Resolution;
}) {
  // TODO(V2-D): a página /montar ainda não passa `references` do servidor (pacote F).
  const semBase = estimate.closest.id === SEM_REFERENCIA.id;
  const parecidos = semBase ? [] : closestReferences(estimate.score, references, 3);
  const idsParecidos = new Set(parecidos.map((r) => r.id));
  // A nota de upscaling é só informação (uma vez, discreta); os demais avisos pedem atenção.
  const notaUpscaling = estimate.notes.find(isUpscalingNote);
  const avisos = estimate.notes.filter((n) => !isUpscalingNote(n));
  const mesDasFontes = mesDeReferenciaDasFontes(references);

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
          {!semBase && (
            <div className="sm:text-right">
              <p className="text-sm text-ink-muted">Equivale a um</p>
              <p className="font-semibold text-ink">{estimate.closest.name}</p>
              <p className="text-sm text-ink-faint">{estimate.closest.parts}</p>
            </div>
          )}
        </div>

        {avisos.map((n) => (
          <Callout key={n} tone="warn">
            {n}
          </Callout>
        ))}

        {semBase ? null : (
          <>
            {parecidos.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-ink">PCs parecidos com o seu</h3>
                <p className="text-xs text-ink-faint">Os computadores de referência com índice mais perto do seu.</p>
                <ul className="mt-3 grid gap-3 sm:grid-cols-3">
                  {parecidos.map((r) => (
                    <li key={r.id} className="flex flex-col gap-1 rounded-card border border-line bg-surface-2 px-4 py-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-semibold text-ink">{r.name}</p>
                        <p className="tnum shrink-0 text-sm text-ink-muted">
                          {r.score} <span className="text-xs text-ink-faint">índice</span>
                        </p>
                      </div>
                      <p className="text-sm text-ink-muted">{r.parts}</p>
                      <p className="tnum text-sm text-ink">≈ {formatBRL(r.approxPrice)}</p>
                    </li>
                  ))}
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
                <summary className="cursor-pointer text-ink-muted hover:text-ink">
                  Ver os {references.length} PCs de referência em tabela (os mesmos dados do gráfico)
                </summary>
                <table className="mt-2 w-full text-left text-sm">
                  <caption className="sr-only">
                    Computadores de referência, do maior para o menor índice GarimpoPC, com peças e preço aproximado
                  </caption>
                  <thead className="text-xs text-ink-faint">
                    <tr>
                      <th scope="col" className="py-1 font-medium">Computador</th>
                      <th scope="col" className="py-1 font-medium">Peças</th>
                      <th scope="col" className="py-1 text-right font-medium">Preço aprox.</th>
                      <th scope="col" className="py-1 text-right font-medium">Índice</th>
                    </tr>
                  </thead>
                  <tbody className="tnum">
                    {[...references].sort((a, b) => b.score - a.score).map((r) => (
                      <tr key={r.id} className="border-t border-line">
                        <th scope="row" className="py-1.5 text-left font-normal text-ink">
                          {r.name}
                          {idsParecidos.has(r.id) && <span className="ml-1 text-xs text-ink-faint">· parecido</span>}
                        </th>
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
                <caption className="sr-only">
                  FPS médio estimado da sua montagem, por tipo de jogo e resolução. A coluna da resolução que você
                  escolheu vem destacada.
                </caption>
                <thead className="text-xs text-ink-faint">
                  <tr>
                    <th scope="col" className="py-2 font-medium">Tipo de jogo</th>
                    {RESOLUCOES.map((r) => (
                      <th key={r} scope="col" className={`px-3 py-2 text-right font-medium ${r === resolution ? "text-ink" : ""}`}>
                        {RESOLUTION_LABELS[r]}
                        {r === resolution && <span className="block text-xs font-normal text-ink-faint">sua escolha</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERFIS.map((p) => (
                    <tr key={p} className="border-t border-line">
                      <th scope="row" className="py-2.5 text-left font-normal">
                        <p className="text-ink">{GAME_PROFILE_LABELS[p].label}</p>
                        <p className="text-xs text-ink-faint">{GAME_PROFILE_LABELS[p].examples}</p>
                      </th>
                      {RESOLUCOES.map((r) => (
                        <td
                          key={r}
                          className={`tnum px-3 py-2.5 text-right ${
                            r === resolution ? "bg-surface-2 text-lg font-semibold text-ink" : "text-base text-ink-muted"
                          }`}
                        >
                          {estimate.fps[p][r]}
                          <span className="ml-1 text-xs font-normal text-ink-faint">fps</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {notaUpscaling &&
                (resolution === "1440p" ? (
                  <Callout tone="info" className="mt-3">
                    {notaUpscaling}
                  </Callout>
                ) : (
                  <p className="mt-3 flex items-start gap-2 text-xs text-ink-faint">
                    <Info className="mt-px h-4 w-4 shrink-0" aria-hidden />
                    {notaUpscaling}
                  </p>
                ))}
            </div>

            <p className="border-t border-line pt-3 text-xs text-ink-faint">
              Base: estimativa · fontes consultadas em {formatarMes(FONTES_CONSULTADAS_EM)}
              {mesDasFontes && ` (dados de ${formatarMes(mesDasFontes)})`} ·{" "}
              <a
                href={URL_METODOLOGIA}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-ink-muted underline underline-offset-2 hover:text-ink"
              >
                ver metodologia<span className="sr-only"> (abre em nova aba)</span>
              </a>
            </p>
          </>
        )}
      </Card>
    </section>
  );
}
