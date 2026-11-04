// Tabelas de juros por loja (V2, pacote E) usadas enquanto o Supabase não está
// configurado. Valores ILUSTRATIVOS: servem para a tela mostrar a diferença
// entre "sem juros" e "com acréscimo"; não são as condições reais das lojas.
//
// Como ler: cada linha é uma faixa. `factor` multiplica o preço do Pix.
// Uma faixa vale para qualquer número de parcelas até o seu `count` (e acima da
// faixa anterior). Ex.: Kabum { 10x: 1 } e { 12x: 1,06 } quer dizer
// "1x a 10x pelo preço do Pix; 11x ou 12x custam 6% a mais".
// Os mesmos números estão em supabase/seed-payments.sql.

import type { InstallmentRate } from "./builder-types";

export const INSTALLMENT_TABLES: Record<string, InstallmentRate[]> = {
  // Até 10x sem juros; 11x e 12x com 6% de acréscimo sobre o Pix.
  kabum: [
    { count: 10, factor: 1 },
    { count: 12, factor: 1.06 },
  ],
  // Até 12x sem juros.
  pichau: [{ count: 12, factor: 1 }],
  // Qualquer parcelamento (até 10x) custa 5% a mais que o Pix.
  terabyte: [{ count: 10, factor: 1.05 }],
  // Marketplace: até 12x, sempre 15% acima do Pix.
  promocenter: [{ count: 12, factor: 1.15 }],
};
