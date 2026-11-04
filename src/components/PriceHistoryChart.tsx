"use client";

// Gráfico de histórico de preços (Recharts). Uma série, cor da marca, grade
// hairline e tooltip com a mesma informação da lista de lojas (não gateia nada).

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL, formatDayMonth } from "@/lib/format";

type Ponto = { date: string; price: number };

const COR = {
  linha: "#f0b43a",
  grade: "#2b2f3a",
  eixo: "#8b8e99",
  superficie: "#15171c",
  superficie2: "#1c1f26",
  texto: "#f2efe6",
  textoMuted: "#aeb0b8",
};

export function PriceHistoryChart({ data }: { data: Ponto[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-control bg-surface-2 text-sm text-ink-faint">
        Ainda não há histórico de preços para esta peça.
      </div>
    );
  }

  const precos = data.map((d) => d.price);
  const min = Math.min(...precos);
  const max = Math.max(...precos);
  const folga = (max - min) * 0.08 || max * 0.05;

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={260} minHeight={260}>
        <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={COR.grade} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDayMonth}
            tick={{ fontSize: 12, fill: COR.eixo }}
            tickMargin={8}
            axisLine={{ stroke: COR.grade }}
            tickLine={false}
          />
          <YAxis
            domain={[Math.floor(min - folga), Math.ceil(max + folga)]}
            tickFormatter={(v: number) => formatBRL(Math.round(v)).replace(",00", "")}
            tick={{ fontSize: 12, fill: COR.eixo }}
            width={84}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => [formatBRL(Number(value)), "Menor preço"]}
            labelFormatter={(label) => `Dia ${formatDayMonth(String(label))}`}
            contentStyle={{
              borderRadius: 10,
              border: `1px solid ${COR.grade}`,
              background: COR.superficie2,
              color: COR.texto,
              fontSize: 13,
              boxShadow: "0 12px 28px -14px rgb(0 0 0 / 0.7)",
            }}
            labelStyle={{ color: COR.textoMuted }}
            itemStyle={{ color: COR.texto, fontWeight: 600 }}
            cursor={{ stroke: COR.linha, strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            isAnimationActive={false}
            dataKey="price"
            stroke={COR.linha}
            strokeWidth={2}
            dot={{ r: 4, fill: COR.linha, stroke: COR.superficie, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: COR.linha, stroke: COR.superficie, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
