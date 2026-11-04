// Tabelas de juros por loja (V2, pacote E) usadas SÓ no modo de demonstração
// (Supabase não configurado). Valores ILUSTRATIVOS: servem para a tela mostrar
// a diferença entre "sem acréscimo" e "com acréscimo"; não são as condições
// reais das lojas. Com banco real, `getInstallmentTables` nunca devolve isto.
//
// Premissa (item 2 do Portão 1): no Brasil, "10x sem juros" é sobre o PREÇO A
// PRAZO, que já é ~10% maior que o Pix. Então (ver payments.ts):
// - até o número de parcelas que a OFERTA anuncia, vale o preço a prazo dela
//   (S-03): se a peça diz "ou 10x de R$ 195", a loja cobra isso em 10x;
// - acima disso, `factor` multiplica o preço do Pix: total = Pix × fator(n), mas
//   nunca abaixo do preço a prazo da oferta: vale max(preço a prazo, Pix × fator);
// - a loja parcela até o maior `count` da tabela.
// Os fatores "sem acréscimo" ficam em ~1,10, logo abaixo da diferença a
// prazo/Pix das ofertas de demonstração (10% a 16%, ver mock-data.ts). Fatores
// acima disso são juros de verdade, cobrados além do preço a prazo.
//
// Como ler: cada linha é uma faixa. Uma faixa vale para qualquer número de
// parcelas até o seu `count` (e acima da faixa anterior). Ex.: Kabum { 10x: 1,10 }
// e { 12x: 1,16 } quer dizer "1x a 10x pelo preço a prazo da oferta; 11x e 12x
// custam Pix + 16%". Os mesmos números estão em supabase/seed-payments.sql.
//
// Coerência com o mock (S-03): as ofertas de demonstração anunciam 10x ou 12x,
// e nenhuma tabela termina antes do que as ofertas da loja anunciam. Assim a
// lista de peças ("ou 10x de…") e "Como pagar" dizem a mesma coisa.

import type { InstallmentRate } from "./builder-types";

export const INSTALLMENT_TABLES: Record<string, InstallmentRate[]> = {
  // Até 10x pelo preço a prazo (~10% acima do Pix); 11x e 12x: Pix + 16%.
  kabum: [
    { count: 10, factor: 1.1 },
    { count: 12, factor: 1.16 },
  ],
  // Até 12x pelo preço a prazo.
  pichau: [{ count: 12, factor: 1.1 }],
  // Até 10x pelo preço a prazo; 11x e 12x: Pix + 15%.
  terabyte: [
    { count: 10, factor: 1.1 },
    { count: 12, factor: 1.15 },
  ],
  // Marketplace: até 12x, Pix + 15%. As ofertas de demonstração dela já
  // anunciam 12x, então até 12x vale o preço a prazo delas; o fator só pesa em
  // oferta que anuncia menos parcelas (ou nenhuma).
  promocenter: [{ count: 12, factor: 1.15 }],
};
