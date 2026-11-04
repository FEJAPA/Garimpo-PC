// Leitura e validação de valores em dinheiro digitados pelo usuário (pt-BR).
//
// Regras de parseMoney (S-01): na dúvida, NÃO chutamos. Um valor ambíguo vira
// NaN e a tela pede para corrigir, em vez de montar um PC 10 vezes mais caro.
// - Aceita espaços e o prefixo "R$". Vazio, lixo ou negativo → NaN.
// - COM vírgula: a vírgula é o decimal e os pontos só podem separar milhar
//   ("6.000,50" → 6000,5; "6000,50" → 6000,5; "1.2,50" → NaN).
// - SEM vírgula:
//   - pontos em grupos de 3 dígitos são milhar ("6.000" → 6000; "1.234.567");
//   - UM ponto seguido de 1 ou 2 dígitos no fim é decimal ("6000.5" → 6000,5;
//     "6.5" → 6,5). É o caso do teclado do celular em inglês, que só tem ponto;
//   - qualquer outra forma com ponto → NaN ("6.0000", "1.2.3", "1.23.456").

import { formatBRL } from "./currency";

/** Teto padrão para qualquer valor em dinheiro no site. */
export const MAX_MONEY = 1_000_000;

/** "1.234.567": pontos separando grupos de exatamente 3 dígitos. */
const MILHAR = /^\d{1,3}(\.\d{3})+$/;
/** "6000.5" ou "6000.50": um ponto só, com 1 ou 2 dígitos depois. */
const DECIMAL_COM_PONTO = /^\d+\.\d{1,2}$/;

export function parseMoney(text: string): number {
  const s = String(text ?? "")
    .replace(/R\$/gi, "")
    .replace(/\s+/g, "");
  if (s === "" || !/^[\d.,]+$/.test(s)) return NaN;

  let normalizado: string;
  const virgulas = (s.match(/,/g) ?? []).length;
  if (virgulas > 1) return NaN;

  if (virgulas === 1) {
    const [inteira, decimal] = s.split(",");
    if (!/^\d+$/.test(decimal)) return NaN;
    // Pontos na parte inteira só valem como milhar bem formado.
    if (inteira.includes(".") && !MILHAR.test(inteira)) return NaN;
    if (!/^[\d.]*$/.test(inteira)) return NaN;
    normalizado = `${inteira.replace(/\./g, "") || "0"}.${decimal}`;
  } else if (!s.includes(".")) {
    normalizado = s;
  } else if (MILHAR.test(s)) {
    normalizado = s.replace(/\./g, "");
  } else if (DECIMAL_COM_PONTO.test(s)) {
    normalizado = s;
  } else {
    return NaN;
  }

  const value = Number(normalizado);
  return Number.isFinite(value) && value >= 0 ? value : NaN;
}

/**
 * Prévia do valor entendido, para a dica do campo (F-14): "6000.5" →
 * "= R$ 6.000,50". Vazio ou inválido → null (a tela não mostra nada, ou o erro).
 */
export function formatMoneyPreview(text: string): string | null {
  const value = parseMoney(text);
  return Number.isFinite(value) ? `= ${formatBRL(value)}` : null;
}

function brl(value: number): string {
  return `R$ ${Math.round(value).toLocaleString("pt-BR")}`;
}

/** Mensagem de erro (pt-BR) para um valor lido, ou null se ele é aceitável. */
export function moneyError(
  value: number,
  { max = MAX_MONEY }: { max?: number } = {},
): string | null {
  if (!Number.isFinite(value) || value <= 0) return "Informe um valor maior que zero.";
  if (value > max) return `Valor acima do permitido (${brl(max)}).`;
  return null;
}
