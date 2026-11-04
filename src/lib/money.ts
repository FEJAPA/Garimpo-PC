// Leitura e validação de valores em dinheiro digitados pelo usuário (pt-BR).
//
// Regras de parseMoney:
// - Vírgula é o separador decimal ("6000,50" → 6000.5).
// - Ponto é separador de milhar ("6.000" → 6000), EXCETO quando é o último
//   separador e vem seguido de exatamente 2 dígitos no fim ("6000.50" → 6000.5).
// - Aceita espaços e o prefixo "R$".
// - Vazio, lixo ou negativo → NaN.

/** Teto padrão para qualquer valor em dinheiro no site. */
export const MAX_MONEY = 1_000_000;

export function parseMoney(text: string): number {
  let s = String(text ?? "")
    .replace(/R\$/gi, "")
    .replace(/\s+/g, "");
  if (s === "" || !/^[\d.,]+$/.test(s)) return NaN;

  const commas = (s.match(/,/g) ?? []).length;
  if (commas > 1) return NaN;

  if (commas === 1) {
    const [inteira, decimal] = s.split(",");
    if (!/^\d*$/.test(decimal) || decimal === "") return NaN;
    s = `${inteira.replace(/\./g, "")}.${decimal}`;
  } else {
    const m = s.match(/^(.*)\.(\d{2})$/);
    s = m ? `${m[1].replace(/\./g, "")}.${m[2]}` : s.replace(/\./g, "");
  }

  if (!/^\d*(\.\d+)?$/.test(s) || s === "" || s === ".") return NaN;
  const value = Number(s.startsWith(".") ? `0${s}` : s);
  return Number.isFinite(value) && value >= 0 ? value : NaN;
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
