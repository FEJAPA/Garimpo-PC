// Tabelas de juros por loja (V2, pacote E) usadas SÓ no modo de demonstração
// (Supabase não configurado). Valores ILUSTRATIVOS: servem para a tela mostrar
// a diferença entre "sem acréscimo" e "com acréscimo"; não são as condições
// reais das lojas. Com banco real, `getInstallmentTables` nunca devolve isto.
//
// Premissa (item 2 do Portão 1): no Brasil, "10x sem juros" é sobre o PREÇO A
// PRAZO, que já é ~10% maior que o Pix. Então:
// - `factor` multiplica o preço do Pix: total em n parcelas = Pix × fator(n);
// - mas o total da loja NUNCA fica abaixo do preço a prazo que a oferta informa
//   (`price_installment`): vale max(preço a prazo, Pix × fator).
// Por isso os fatores "sem acréscimo" ficam em ~1,10, logo abaixo da diferença
// a prazo/Pix das ofertas de demonstração (10% a 12%, ver mock-data.ts): nessa
// faixa a pessoa paga exatamente o preço a prazo anunciado. Fatores acima disso
// são juros de verdade, cobrados além do preço a prazo.
//
// Como ler: cada linha é uma faixa. Uma faixa vale para qualquer número de
// parcelas até o seu `count` (e acima da faixa anterior). Ex.: Kabum { 10x: 1,10 }
// e { 12x: 1,16 } quer dizer "1x a 10x pelo preço a prazo da oferta; 11x e 12x
// custam Pix + 16%". Os mesmos números estão em supabase/seed-payments.sql.

import type { InstallmentRate } from "./builder-types";

export const INSTALLMENT_TABLES: Record<string, InstallmentRate[]> = {
  // Até 10x pelo preço a prazo (~10% acima do Pix); 11x e 12x: Pix + 16%.
  kabum: [
    { count: 10, factor: 1.1 },
    { count: 12, factor: 1.16 },
  ],
  // Até 12x pelo preço a prazo.
  pichau: [{ count: 12, factor: 1.1 }],
  // Até 6x pelo preço a prazo; 7x a 10x: Pix + 15%.
  terabyte: [
    { count: 6, factor: 1.1 },
    { count: 10, factor: 1.15 },
  ],
  // Marketplace: até 12x, sempre Pix + 15% (em geral acima do preço a prazo anunciado).
  promocenter: [{ count: 12, factor: 1.15 }],
};
