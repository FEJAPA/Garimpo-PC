"use client";

// Gráfico de barras horizontais: a montagem da pessoa (ouro) entre os PCs de
// referência (cinza). Forma "ênfase" (dataviz): uma cor para a série que importa.
// V2 (pacote D): os "PCs parecidos com o seu" ficam num cinza um passo mais claro
// ("relacionado"; a ênfase continua única) e a legenda abaixo diz o que cada tom significa.
// As cores vêm de src/lib/chart-colors.ts (um lugar só, CON-10); texto nunca usa a cor
// da série. O gráfico é uma imagem para leitores de tela (role="img" + resumo), e a
// versão textual é a tabela do PerformancePanel.

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReferenceBuild } from "@/models/builder-types";
import { describeScorePosition } from "@/services/builder/performance";
import { CHART_COLORS } from "@/lib/chart-colors";
import { formatBRL } from "@/lib/format";

/** Espessura de cada barra (px). DESIGN.md: barras finas, nunca acima de 24px. */
const BARRA_PX = 18;
/** Altura reservada por linha (barra + respiro). */
const LINHA_PX = 34;

type Linha = {
  id: string;
  name: string;
  score: number;
  parts: string;
  approxPrice: number | null;
  sua: boolean;
  parecido: boolean;
};

function corDaLinha(l: Linha): string {
  if (l.sua) return CHART_COLORS.enfase;
  return l.parecido ? CHART_COLORS.relacionado : CHART_COLORS.contexto;
}

export function PerformanceChart({
  score,
  references,
  similarIds = [],
}: {
  score: number;
  references: ReferenceBuild[];
  /** Ids dos PCs parecidos (closestReferences), destacados de leve. */
  similarIds?: string[];
}) {
  const parecidos = new Set(similarIds);
  const linhas: Linha[] = [
    ...references.map((r) => ({
      id: r.id,
      name: r.name,
      score: r.score,
      parts: r.parts,
      approxPrice: r.approxPrice,
      sua: false,
      parecido: parecidos.has(r.id),
    })),
    { id: "sua", name: "Sua montagem", score, parts: "", approxPrice: null, sua: true, parecido: false },
  ].sort((a, b) => b.score - a.score);

  const max = Math.max(...linhas.map((l) => l.score));
  const altura = linhas.length * LINHA_PX + 36;
  const resumo = `${describeScorePosition(score, references)}. Gráfico de barras com ${references.length} PCs de referência; a tabela abaixo traz os mesmos dados.`;

  return (
    <div className="w-full">
      {/* Só o desenho é "imagem": a legenda fica de fora para continuar legível por leitores de tela. */}
      <div role="img" aria-label={resumo}>
        <ResponsiveContainer width="100%" height={altura}>
          <BarChart data={linhas} layout="vertical" margin={{ top: 4, right: 48, left: 4, bottom: 4 }} barCategoryGap={8}>
            <CartesianGrid stroke={CHART_COLORS.grade} horizontal={false} />
            <XAxis
              type="number"
              domain={[0, Math.ceil((max * 1.05) / 10) * 10]}
              tick={{ fontSize: 12, fill: CHART_COLORS.eixo }}
              axisLine={{ stroke: CHART_COLORS.grade }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tick={{ fontSize: 12, fill: CHART_COLORS.textoMuted }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const l = payload[0].payload as Linha;
                return (
                  <div className="rounded-card border border-line bg-surface-2 px-3 py-2 text-sm shadow-float">
                    <p className="tnum font-semibold text-ink">
                      {l.score} <span className="font-normal text-ink-muted">· índice</span>
                    </p>
                    <p className="text-ink-muted">
                      {l.name}
                      {l.parecido && <span className="text-ink-faint"> · parecido com o seu</span>}
                    </p>
                    {l.parts && <p className="text-xs text-ink-faint">{l.parts}</p>}
                    {l.approxPrice !== null && <p className="tnum text-xs text-ink-faint">≈ {formatBRL(l.approxPrice)}</p>}
                  </div>
                );
              }}
            />
            <Bar dataKey="score" barSize={BARRA_PX} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {linhas.map((l) => (
                <Cell key={l.id} fill={corDaLinha(l)} />
              ))}
              <LabelList
                dataKey="score"
                content={(props) => {
                  const { x, y, width, height, index } = props as { x: number; y: number; width: number; height: number; index: number };
                  const l = linhas[index];
                  if (!l?.sua) return null;
                  return (
                    <text x={x + width + 8} y={y + height / 2} dy={4} fontSize={12} fontWeight={600} fill={CHART_COLORS.texto}>
                      {l.score}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted" aria-label="Legenda do gráfico">
        <LegendaItem cor={CHART_COLORS.enfase} texto="Sua montagem" />
        {parecidos.size > 0 && <LegendaItem cor={CHART_COLORS.relacionado} texto="PCs parecidos com o seu" />}
        <LegendaItem cor={CHART_COLORS.contexto} texto="Outros PCs de referência" />
      </ul>
    </div>
  );
}

/** Item de legenda: amostra da cor + texto (o texto nunca usa a cor da série). */
function LegendaItem({ cor, texto }: { cor: string; texto: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: cor }} aria-hidden />
      {texto}
    </li>
  );
}
