"use client";

// Gráfico de histórico de preços (Recharts). Uma série, cor da marca, grade
// hairline e tooltip com a mesma informação da lista de lojas (não gateia nada).
//
// Acessibilidade (A11Y-05): o gráfico é só imagem para leitor de tela, então tem
// `role="img"` com um resumo em texto, e os mesmos pontos ficam numa tabela dentro
// de um <details> ("Ver como tabela"). As cores vêm de CHART_COLORS (DESIGN.md).

import { ChevronDown } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS } from "@/lib/chart-colors";
import { formatBRL, formatDayMonth, priceHistorySummary } from "@/lib/format";

type Ponto = { date: string; price: number };

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
      {/* accessibilityLayer desligado no LineChart: o gráfico é uma imagem (role="img") e não
          pode ter algo focável dentro; quem usa teclado lê os mesmos dados na tabela abaixo. */}
      <div role="img" aria-label={priceHistorySummary(data)}>
        <ResponsiveContainer width="100%" height={260} minHeight={260}>
          <LineChart accessibilityLayer={false} data={data} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={CHART_COLORS.grade} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDayMonth}
              tick={{ fontSize: 12, fill: CHART_COLORS.eixo }}
              tickMargin={8}
              axisLine={{ stroke: CHART_COLORS.grade }}
              tickLine={false}
            />
            <YAxis
              domain={[Math.floor(min - folga), Math.ceil(max + folga)]}
              tickFormatter={(v: number) => formatBRL(Math.round(v)).replace(",00", "")}
              tick={{ fontSize: 12, fill: CHART_COLORS.eixo }}
              width={84}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => [formatBRL(Number(value)), "Menor preço"]}
              labelFormatter={(label) => `Dia ${formatDayMonth(String(label))}`}
              contentStyle={{
                borderRadius: 10,
                border: `1px solid ${CHART_COLORS.grade}`,
                background: CHART_COLORS.superficie2,
                color: CHART_COLORS.texto,
                fontSize: 13,
                boxShadow: "0 12px 28px -14px rgb(0 0 0 / 0.7)",
              }}
              labelStyle={{ color: CHART_COLORS.textoMuted }}
              itemStyle={{ color: CHART_COLORS.texto, fontWeight: 600 }}
              cursor={{ stroke: CHART_COLORS.enfase, strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              isAnimationActive={false}
              dataKey="price"
              stroke={CHART_COLORS.enfase}
              strokeWidth={2}
              dot={{ r: 4, fill: CHART_COLORS.enfase, stroke: CHART_COLORS.superficie, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: CHART_COLORS.enfase, stroke: CHART_COLORS.superficie, strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <details className="group mt-3 text-sm">
        <summary className="inline-flex cursor-pointer items-center gap-1 rounded-control text-ink-muted hover:text-ink">
          Ver como tabela
          <ChevronDown
            className="h-4 w-4 transition-transform duration-150 group-open:rotate-180"
            strokeWidth={1.75}
            aria-hidden
          />
        </summary>
        {/* Região rolável e focável: com muitos dias, quem usa teclado consegue rolar a tabela. */}
        <div
          role="region"
          aria-label="Tabela do histórico de preços"
          tabIndex={0}
          className="mt-2 max-h-72 overflow-y-auto rounded-control"
        >
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Menor preço no Pix, por dia, entre as lojas</caption>
            <thead className="text-xs text-ink-faint">
              <tr>
                <th scope="col" className="py-1.5 font-medium">
                  Dia
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Menor preço (Pix)
                </th>
              </tr>
            </thead>
            <tbody className="tnum">
              {data.map((ponto) => (
                <tr key={ponto.date} className="border-t border-line">
                  <th scope="row" className="py-1.5 font-normal text-ink-muted">
                    {formatDayMonth(ponto.date)}
                  </th>
                  <td className="py-1.5 text-right text-ink">{formatBRL(ponto.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
