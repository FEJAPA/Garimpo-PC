// Formatação de moeda. Fica num módulo-folha (sem imports do projeto) para
// `format.ts` e os serviços usarem sem criar import circular.

/** Formata um valor em reais, ex.: 1899.9 -> "R$ 1.899,90". */
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
