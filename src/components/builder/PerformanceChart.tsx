"use client";

// Gráfico de barras horizontais: a montagem da pessoa (ouro) entre os PCs de
// referência (cinza). Forma "ênfase" (dataviz): uma cor para a série que importa.

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReferenceBuild } from "@/models/builder-types";
import { formatBRL } from "@/lib/format";

const COR = {
  enfase: "#f0b43a",
  contexto: "#626877",
  grade: "#2b2f3a",
  eixo: "#8b8e99",
  texto: "#f2efe6",
  textoMuted: "#aeb0b8",
  superficie2: "#1c1f26",
};

type Linha = { id: string; name: string; score: number; parts: string; approxPrice: number | null; sua: boolean };

export function PerformanceChart({ score, references }: { score: number; references: ReferenceBuild[] }) {
  const linhas: Linha[] = [
    ...references.map((r) => ({ id: r.id, name: r.name, score: r.score, parts: r.parts, approxPrice: r.approxPrice, sua: false })),
    { id: "sua", name: "Sua montagem", score, parts: "", approxPrice: null, sua: true },
  ].sort((a, b) => b.score - a.score);

  const max = Math.max(...linhas.map((l) => l.score));
  const altura = linhas.length * 34 + 36;

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={altura}>
        <BarChart data={linhas} layout="vertical" margin={{ top: 4, right: 48, left: 4, bottom: 4 }} barCategoryGap={8}>
          <CartesianGrid stroke={COR.grade} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, Math.ceil((max * 1.05) / 10) * 10]}
            tick={{ fontSize: 12, fill: COR.eixo }}
            axisLine={{ stroke: COR.grade }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={{ fontSize: 12, fill: COR.textoMuted }}
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
                  <p className="text-ink-muted">{l.name}</p>
                  {l.parts && <p className="text-xs text-ink-faint">{l.parts}</p>}
                  {l.approxPrice !== null && <p className="tnum text-xs text-ink-faint">≈ {formatBRL(l.approxPrice)}</p>}
                </div>
              );
            }}
          />
          <Bar dataKey="score" barSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {linhas.map((l) => (
              <Cell key={l.id} fill={l.sua ? COR.enfase : COR.contexto} />
            ))}
            <LabelList
              dataKey="score"
              content={(props) => {
                const { x, y, width, height, index } = props as { x: number; y: number; width: number; height: number; index: number };
                const l = linhas[index];
                if (!l?.sua) return null;
                return (
                  <text x={x + width + 8} y={y + height / 2} dy={4} fontSize={12} fontWeight={600} fill={COR.texto}>
                    {l.score}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
