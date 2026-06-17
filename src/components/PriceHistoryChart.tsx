"use client";

// Gráfico de histórico de preços. Roda no navegador (por isso "use client"),
// usando a biblioteca Recharts. Mostra a evolução do menor preço ao longo do
// tempo, ajudando a saber se uma "promoção" é real.

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatBRL, formatDayMonth } from "@/lib/format";

type Ponto = { date: string; price: number };

export function PriceHistoryChart({ data }: { data: Ponto[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg bg-surface-2 text-sm text-ink-faint">
        Ainda não há histórico de preços para esta peça.
      </div>
    );
  }

  const precos = data.map((d) => d.price);
  const min = Math.min(...precos);
  const max = Math.max(...precos);
  // Folga de 5% acima/abaixo para o gráfico não ficar colado nas bordas.
  const folga = (max - min) * 0.05 || max * 0.05;

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={256} minHeight={256}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="linhaPreco" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#9d7bff" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a3050" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDayMonth}
            tick={{ fontSize: 12, fill: "#9aa3c7" }}
            tickMargin={8}
            stroke="#2a3050"
          />
          <YAxis
            domain={[Math.floor(min - folga), Math.ceil(max + folga)]}
            tickFormatter={(v: number) => `R$ ${Math.round(v)}`}
            tick={{ fontSize: 12, fill: "#9aa3c7" }}
            width={70}
            stroke="#2a3050"
          />
          <Tooltip
            formatter={(value) => [formatBRL(Number(value)), "Menor preço"]}
            labelFormatter={(label) => `Dia ${formatDayMonth(String(label))}`}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #2a3050",
              background: "#151829",
              color: "#eef1ff",
              fontSize: 13,
            }}
            labelStyle={{ color: "#9aa3c7" }}
            cursor={{ stroke: "#7c5cff", strokeWidth: 1, strokeDasharray: "4 4" }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="url(#linhaPreco)"
            strokeWidth={3}
            dot={{ r: 3, fill: "#22d3ee" }}
            activeDot={{ r: 6, fill: "#22d3ee" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
