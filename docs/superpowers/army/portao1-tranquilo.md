# Portão 1: parecer do Gerente Tranquilo

- Data: 2026-11-04. Diff avaliado: `git diff e709af0..HEAD` (HEAD = `b2acfd5` na leitura; durante o portão entraram `f6499ea` e `8b69a4d`, só diagramas e README).
- Somente leitura. Este é o único arquivo escrito. Nenhum git que muda estado. Não rodei `build`, `dev`/`start` nem e2e (isso é do Gerente Rigoroso).
- Para conferir comportamento real, rodei uma sonda descartável de Vitest no scratchpad (fora do repositório) chamando `autoBuild`, `flagSuspiciousOffers`, `buildPaymentSummary` e `mixedPlan` sobre o mock.

## Veredito

**APROVADA COM CORREÇÕES.**

1. Os cinco pacotes entregaram o que reportaram: código real, testado (136/136 testes, tsc e lint limpos), sem conclusão-fantasma.
2. Quase nada disso chega à tela do Montador ainda. `getPartSpecs`, `getReferenceBuilds` e `getInstallmentTables` não são chamados por ninguém, `autoBuild` monta o pagamento sem tabela de juros e `BuildResultView` não passa `parts` (o modo "Misturar" fica escondido). Era esperado pela reserva de arquivos, mas a onda 2 (F) precisa ligar tudo, senão a V2 não aparece para a pessoa.
3. Dois problemas de dinheiro precisam ser corrigidos antes de ligar: (a) as tabelas de juros dizem "sem juros = preço do Pix", e o parcelado fica mais barato que o preço que a própria oferta informa; (b) com "Só lojas confiáveis" desligado, o Montador escolhe sem aviso a oferta de R$ 1.399,90 que a página da peça chama de "Preço bom demais?", e essa mesma oferta aparece como "Melhor preço agora".
4. Os achados LOG-01 (parseMoney "6000.50"), SEG-01 e SEG-02 (alertas) continuam valendo e são baratos.
5. O resto dos 68 achados pode esperar, e a onda 2 deve focar em ligar a V2 na tela com números honestos.

## Conclusões-fantasma

| Pacote | Reportado | Confirmado no diff / na leitura |
|---|---|---|
| A | `specs.ts` (+7 testes), part-specs com `capacityGb`/`upscaling`/`source`, SQL, `collect-specs.mjs` + `specs-catalogo.json`, `docs/COLETA-SPECS.md` | **Sim.** `getPartSpecs` com fallback para mock (sem banco, com erro ou com tabela vazia), `rowToPartSpec` funcional, 7 testes, 20 peças no JSON com validação no coletor (`--dry-run`). **Fora do relatório, mas é critério de aceite do plano:** A1 passo 4 (ligar na página) não foi feito, porque o arquivo estava reservado. A nota "N peças ignoradas" não existe. A validação de categoria ficou como TODO. |
| C | `storeTrust` com motivos, `validOffers` ignora preço ≤ 0, `suspicious.ts` (11 testes), StoreBadge com motivos, /peca com "Por que confiável" e aviso, mock e SQL das lojas | **Sim.** `storeTrust` (bloqueada, oficial + 4,5, Reclame Aqui < 6 derruba, anos de mercado), `precoValido`, mediana de lojas confiáveis −25%, `sr-only` no badge, lista visível e `Callout` na /peca. trust.test foi de 5 para 14 testes. **Fora da tela:** C2 no BuildSummary e o aviso C3 no Montador (arquivos de F). |
| D | 12 referências com fonte e data, `references.ts` (+8), `closestReferences`, penalidade de 16 GB, nota de upscaling, painel "PCs parecidos", destaque no gráfico | **Sim.** 12 referências no TS e no `seed-references.sql`. O mapeamento valida o `fps` completo e nunca devolve lista vazia. −8% em AAA pesado com ≤ 16 GB. performance.test foi de 10 para 24 testes. O painel e a legenda do gráfico aparecem hoje (usam a lista local). `references` do servidor não é passado. |
| E | juros por loja, `installments.ts`, `installmentPlan` por loja, `mixed-plan.ts`, `coupons.ts`, PaymentPlanner com Misturar, schema e seed | **Sim, com ressalva de modelo** (ver item 2 abaixo). O código faz o que diz: `rateFor`, `storeInstallment`, `maxInstallments` = maior quando há tabela, mistura gulosa (10 testes), cupom sem UI nem tabela (o relatório não prometeu). **Na tela hoje:** nada de juros por loja nem "Misturar" (`parts` não é passado, `autoBuild` não recebe tabelas). |
| H | `playwright.config.ts`, e2e (11 passam), `ci.yml`, `coleta.yml`, monitor > 30% → exit 2 → issue | **Sim.** São 6 testes × 2 projetos − 1 `skip` = 11. O CI roda typecheck, lint, test, build e e2e. A coleta grava `coleta-resultado.json` por loja, e o workflow trata o código 2 e abre ou comenta a issue. O badge está no README. |
| Diagramas | `docs/diagramas` | **Em andamento.** São 7 arquivos (README, arquitetura, fluxo-dados, fluxo-montador, fluxo-pagamento, jornada-usuario, mapa-de-telas), com 18 blocos mermaid, commitados como wip em `f6499ea`. Não avaliei o conteúdo. |

**Fantasmas: nenhum.** Os relatórios não afirmam nada que o diff não tenha. A divergência é outra: funcionalidade entregue e testada que ainda não está ligada à tela, por causa da reserva de arquivos.

## Verificação

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | exit 0, sem erros |
| `npm run lint` (eslint) | exit 0, sem avisos |
| `npx vitest run` | 13 arquivos, **136/136** passam (1,8 s) |

Sonda no mock (scratchpad, fora do repo):
- 6.000/7.000, só confiáveis: R$ 6.849,30, troca de GPU para a RX 7700 XT com nota coerente, índice 129, notas de 16 GB e de DLSS/FSR.
- **6.000/7.000, sem filtro de lojas:** escolhe `promocenter:rtx-4060` a R$ 1.399,90, oferta que `flagSuspiciousOffers` marca como suspeita. Nenhum aviso no resultado.
- Com `INSTALLMENT_TABLES`: Kabum em 10x sai pelo preço do Pix (R$ 1.899,90), mas a própria oferta mock diz 10x = R$ 2.099,90. O total parcelado com tabela (R$ 6.964,79 em 12x) fica **abaixo** do parcelado das ofertas (R$ 7.671,23 em 10x).
- 4.000/4.000: "Não deu para montar", com a mensagem clara e o valor mínimo (R$ 4.699,30).

## O que realmente importa

Ordem de prioridade. Os itens 1 a 4 decidem se a V2 chega à pessoa com números honestos.

| # | O quê | Arquivo(s) | Pacote | Tam. | Modelo |
|---|---|---|---|---|---|
| 1 | **Ligar a onda 1 na tela.** `montar/page.tsx` chama no servidor `getPartSpecs()`, `getReferenceBuilds()` e `getInstallmentTables()` e passa tudo ao `BuilderForm`. `autoBuild` (ou `BuildResultView`) monta o pagamento com as tabelas. `PaymentPlanner` recebe `parts` e `PerformancePanel` recebe `references`. Sem isso, juros, "Misturar" e specs do banco ficam invisíveis (LOG-09). | `src/app/montar/page.tsx`, `BuilderForm.tsx`, `BuildResultView.tsx`, `auto-build.ts` (só a assinatura do pagamento) | F (com B) | M | Opus |
| 2 | **Juros não podem baratear o parcelado.** Hoje "sem juros" é igual ao preço do Pix, mas no Brasil o "10x sem juros" vale sobre o preço a prazo, que é maior que o Pix. Correção mínima: o total com tabela nunca fica abaixo do `price_installment` da oferta, e o mock de juros fica coerente com as ofertas mock. Junto: tratar `price_installment ≤ 0` como ausente (LOG-10), limitar `installment_count` a 1..24 (LOG-12) e os testes (TST-01). Abrir o seletor no maior número de parcelas **sem juros**, não no máximo com acréscimo. | `payments.ts`, `installment-tables.ts`, `seed-payments.sql`, `PaymentPlanner.tsx`, testes | E (dono) / F na onda 2 | M | Opus |
| 3 | **A oferta "bom demais" não pode ser recomendada em silêncio.** O BuildSummary mostra o `Callout` "Preço bom demais?" na peça marcada (C3 diz isso para o caso sem filtro). O "Melhor preço agora" da /peca e o `ProductCard` ignoram preço ≤ 0 e preferem a oferta não suspeita (`getBestOffer`, LOG-18). O alerta de preço não deve usar o preço suspeito como "preço atual". | `BuildSummary.tsx`, `src/lib/format.ts`, `peca/[slug]/page.tsx`, `ProductCard.tsx` | F (BuildSummary) + Comandante (format) | P | Sonnet |
| 4 | **`parseMoney` e limite superior** (LOG-01, LOG-08, TST-04). "6000.50" vira 600.050 e passa por cima do teto. Já é a tarefa F1. Aplicar a mesma regra a `lerReais` do PaymentPlanner, que tem o mesmo bug. | `src/lib/money.ts` (novo), `BuilderForm.tsx`, `PaymentPlanner.tsx`, `montar/page.tsx` (`numero()`) | F | P | Sonnet |
| 5 | **Validar dados do banco antes de montar.** Com o item 1 ligado, specs incompletas passam a valer. `rowToPartSpec` rejeita categoria desconhecida e `perf` não finito ou ≤ 0, e exige os campos de compatibilidade por categoria (LOG-02, -03, -16). `autoBuild` conta as peças ignoradas e gera a nota "N peças ignoradas por falta de especificação" (LOG-04, critério de aceite do A). `mapReferenceRow` rejeita score ≤ 0 (LOG-14). Testes TST-02 e TST-03. | `specs.ts`, `auto-build.ts`, `compatibility.ts`, `references.ts` | B | M | Sonnet |
| 6 | **"Usou a folga" só com troca de verdade** e nota de ganho sem "+Infinity%" (LOG-05, LOG-06). O tempo com 150 peças por categoria (LOG-07) já é a B1/B2. | `auto-build.ts`, `BuildResultView.tsx` | B | P | Sonnet (dentro do trabalho Opus do B) |
| 7 | **Uma régua só de confiança** (LOG-17). Cor e rótulo do badge vêm de `storeTrust`, não de `rating >= 4`. Uma loja não oficial com nota 4,7 hoje aparece verde, como "Muito confiável", logo acima de "Por que não marcamos como confiável". Ajustar também o texto do toggle ("Lojas oficiais com nota 4,5 ou mais"), que não cita Reclame Aqui nem o bloqueio. | `StoreBadge.tsx`, `src/lib/format.ts` (`trustLabel`), `BuilderForm.tsx` (descrição do Toggle) | C → F | P | Sonnet |
| 8 | **Dado ilustrativo não pode virar fato no modo real.** `seed-stores.sql` grava Reclame Aqui e anos de mercado inventados para Kabum, Pichau e Terabyte, e `seed-payments.sql` grava juros inventados. Com o banco ligado, isso aparece sem o aviso de "Modo de demonstração", e a /peca não tem esse aviso nem no modo de demonstração. Correção barata: avisos explícitos nos seeds ("só para demonstração; não rode em produção"), o aviso de demonstração na /peca e `getInstallmentTables` sem uso no modo real até existir dado conferido. | `supabase/seed-stores.sql`, `seed-payments.sql`, `peca/[slug]/page.tsx`, `installments.ts` | C/E → Comandante | P | Sonnet |
| 9 | **Alertas de preço que mentem** (SEG-01, SEG-02, DAD-05). A rota fica aberta sem `CRON_SECRET`. Sem a chave do Resend o alerta é marcado como enviado. Um alerta já disparado continua aparecendo como ativo. O G já mexe nesses arquivos no G2. | `api/check-alerts/route.ts`, `services/email.ts`, `conta/page.tsx` | G | P | Sonnet |
| 10 | **Coleta que finge sucesso** (PERF-06). `update`/`insert` sem ler `error` deixa o monitor novo do H verde enquanto o histórico para. São duas linhas. | `scripts/collect-prices.mjs` | H (ou Comandante) | P | Sonnet |

Extra barato, se sobrar fôlego: A11Y-01 (link "Pular para o conteúdo") e A11Y-02 (título por página). São WCAG nível A, cada um leva minutos no `layout.tsx` e nas páginas (Comandante, P, Sonnet). Marquei os dois como "corrigir" na triagem.

### Leitura do ponto de vista da pessoa leiga

O que funciona bem e não precisa mexer:
- **"Por que confiável"** na /peca: os motivos são concretos ("Loja oficial", "Nota 4,8 (125.000 avaliações)", "Reclame Aqui 8,2", "22 anos de mercado") e o contraste "Por que não marcamos como confiável" é honesto. O `Callout` "Preço bom demais?" diz exatamente o que fazer ("confira se a loja existe mesmo antes de pagar").
- **"PCs parecidos com o seu"** em três cartões, com peças e preço aproximado, é a parte mais útil para quem não entende de índice. A legenda do gráfico explica as cores.
- **Misturar**: "Tenho à vista" e "Cabe por mês", com as notas "Pague R$ X no Pix (2 peças) e parcele o resto em 12x de R$ Y" e "Falta R$ Z por mês", em linguagem de gente. Bom, quando estiver ligado.

O que confunde ou engana (está nos itens acima):
- Item 3: a mesma tela diz "Melhor preço agora R$ 1.399,90" e, logo abaixo, "Preço bom demais?" para a mesma oferta.
- Item 2: depois de ligado, o parcelado mostraria "Sem juros: mesmo preço do Pix" enquanto a lista de peças diz "ou 10x de R$ 209,99", acima do Pix.
- Item 7: verde e "Muito confiável" ao lado de "não marcamos como confiável".
- Menor, sem item próprio: a linha "Fonte: estimativa GarimpoPC a partir de agregados públicos: checkfps.io (…), índice MaxMyBuild (…) e PC4Games/Tom's Hardware (…)" se repete em cada cartão de "PCs parecidos". É honesta mas pesada. Uma nota de rodapé única resolveria quando F tocar o painel. Não é engano.
- Menor: no modo Parcelado, "12x de R$ X" soma a primeira parcela de cada loja. A dica embaixo do seletor já explica que as últimas ficam menores. Aceitável por ora.

## Triagem das trufas

Total: **27 corrigir · 35 adiar · 6 descartar** (68). Dos 27, 12 já estão no escopo planejado de B, F ou G (LOG-01, -05, -06, -07, -08, -09, A11Y-03, -04, TST-03, TST-04, SEG-01, SEG-02). O custo extra real é de uns 15 itens pequenos, quase todos dentro dos itens 2, 3, 5, 7, 8, 9 e 10.

| Id | Decisão | Motivo |
|---|---|---|
| SEG-01 | corrigir (G) | Job com service_role aberto a qualquer um. A correção é barata e o G já mexe na rota. |
| SEG-02 | corrigir (G) | O alerta morre em silêncio: a pessoa nunca recebe o aviso e ninguém fica sabendo. |
| SEG-03 | adiar | Os nomes vêm do nosso catálogo. Risco baixo. Fazer junto se o G2 reescrever o e-mail. |
| SEG-04 | adiar | As URLs vêm do seed e do coletor, não da pessoa. É endurecimento para depois. |
| SEG-05 | adiar | Vírgula na busca é caso raro e o RLS limita o estrago. |
| SEG-06 | adiar | Infla o ranking "mais procuradas", mas não afeta preço nem montagem. |
| SEG-07 | adiar | Headers de segurança entram num lote de endurecimento pós-V2. |
| SEG-08 | adiar | O log de visitas não tem identidade. Leitura pública sem dano. |
| SEG-09 | adiar | Guarda preventiva. Hoje não há import cliente. |
| SEG-10 | adiar | Um teto absurdo no alerta só prejudica quem digitou. |
| SEG-11 | adiar | Raro, e o efeito visível é pequeno. |
| LOG-01 | corrigir (F1) | Erro de dinheiro na entrada principal: viola "respeita o orçamento". |
| LOG-02 | corrigir (B) | Com specs do banco ligadas (item 1), spec incompleta pode gerar PC incompatível. |
| LOG-03 | corrigir (B, em `specs.ts`) | Clique em "Montar" sem resposta. Validação de uma linha. |
| LOG-04 | corrigir (B) | Critério de aceite do pacote A que não foi entregue. |
| LOG-05 | corrigir (B) | A tela diz "Usou a folga" sem ter usado. |
| LOG-06 | corrigir (B) | Nota com "+Infinity%" ou ganho que não existe. Entra na reescrita B2. |
| LOG-07 | corrigir (B) | Já é a B1/B2. Catálogo real trava o navegador. |
| LOG-08 | corrigir (F1) | Mesma tarefa do LOG-01. |
| LOG-09 | corrigir (F) | Sem isso a V2 não aparece (item 1). |
| LOG-10 | corrigir (item 2) | "Parcelado R$ 0,00" sai de dado ruim. Uma linha. |
| LOG-11 | adiar | A dica do seletor já explica a parcela variável. Diferença de centavos. |
| LOG-12 | corrigir (item 2) | Um dado ruim trava o navegador. Basta um `Math.min(…, 24)`. |
| LOG-13 | adiar | O cupom não tem UI. No histórico, a diferença é de 3 h na madrugada. |
| LOG-14 | corrigir (item 5) | Score zero vindo do banco vira NaN na tela. Validação barata em `mapReferenceRow`. |
| LOG-15 | descartar | `getReferenceBuilds` nunca devolve lista vazia e o painel tem padrão local. Não há caminho real até o erro. |
| LOG-16 | corrigir (item 5) | `perf` inválido mostra FPS falso sem aviso. |
| LOG-17 | corrigir (C/F) | Contradição visível no diferencial anti-golpe. |
| LOG-18 | corrigir (item 3) | O "Melhor preço" pode ser R$ 0 ou a oferta suspeita. |
| DAD-01 | adiar | Migração de constraints. A validação em código cobre a tela por ora. |
| DAD-02 | adiar | O catálogo tem bem menos de 1000 ofertas. Rever com o catálogo real. |
| DAD-03 | adiar | Política de documentação. O caso dos juros já está justificado no código. |
| DAD-04 | adiar | Problema de volume que não existe hoje. |
| DAD-05 | corrigir (G) | A pessoa acha que está monitorada e não está. O G já mexe em /conta. |
| A11Y-01 | corrigir (Comandante) | WCAG A em todas as páginas, e a correção leva minutos. |
| A11Y-02 | corrigir (Comandante) | WCAG A, `metadata` por página, barato. |
| A11Y-03 | corrigir (F4) | Já está no escopo do F4. O erro do campo não é lido. |
| A11Y-04 | corrigir (F4) | Já está no escopo do F4 (foco no resumo). |
| A11Y-05 | adiar | A tabela de FPS é visível e a de referências está num `<details>` acessível. O histórico de preços fica para o lote de acessibilidade. |
| A11Y-06 | adiar | Entra no F4 se sair de graça. |
| A11Y-07 | adiar | Detalhe semântico. As tabelas são simples. |
| A11Y-08 | adiar | O ícone é padrão. Baixo impacto. |
| A11Y-09 | adiar | São só dois links na navegação. |
| A11Y-10 | adiar | O G pode fazer de carona, mas não é obrigatório. |
| A11Y-11 | descartar | Já resolvido no C: `sr-only` com os motivos no badge e lista visível na /peca. |
| A11Y-12 | adiar | O `aria-valuetext` já descreve o valor. |
| PERF-01 | adiar | O catálogo de demonstração é pequeno. Medir com dado real antes de otimizar. |
| PERF-02 | adiar | Refatoração de sessão e cache, fora do escopo da V2. |
| PERF-03 | adiar | Mesma refatoração do PERF-02. |
| PERF-04 | adiar | Paginação só é necessária com centenas de peças. |
| PERF-05 | adiar | Cabe em cerca de 900 ofertas hoje, e o monitor do H avisa. |
| PERF-06 | corrigir (H/Comandante) | A coleta fica "verde" sem gravar e anula o monitor recém-entregue. São duas linhas. |
| PERF-07 | adiar | Memo e Worker só se a B1 medir mais de 200 ms. |
| PERF-08 | descartar | Não entra no bundle do Next, e o `npm ci` da coleta precisa dele de qualquer jeito. |
| CON-01 | adiar | Cor do e-mail. Fazer se o G2 reescrever o template. |
| CON-02 | descartar | Campo morto sem efeito. Não vale um commit agora. |
| CON-03 | adiar | Estética, sem impacto para a pessoa. |
| CON-04 | adiar | Só morde quando entrar `cooler` (A4, opcional). |
| CON-05 | adiar | Comentários desatualizados. Fazer num lote de limpeza. |
| CON-06 | descartar | Convenção de nomes, sem efeito para ninguém. Decidir quando for refatorar. |
| CON-07 | adiar | Peculiaridade da busca, rara. |
| CON-08 | adiar | Ajuste fino do anel de foco. Entra no F4 se sobrar. |
| CON-09 | adiar | "Preços de hoje às HH:MM" já é a G3. A mensagem de cadastro fica para o lote de auth. |
| CON-10 | descartar | Duplicação de cores, cosmético. Não muda nada na tela. |
| TST-01 | corrigir (item 2) | Protege a correção dos LOG-10 e LOG-12. |
| TST-02 | corrigir (item 5) | Protege a correção dos LOG-14 e LOG-16. |
| TST-03 | corrigir (B) | Já é a B1. Protege o LOG-04 e o tempo de resposta. |
| TST-04 | corrigir (F1) | Já é a F1. |

## O que eu NÃO corrigiria agora e por quê

- **Endurecimento geral de segurança** (SEG-03 a SEG-11, headers, `server-only`, RLS de visitas). Nada disso é explorável hoje com o dado que temos, e cada item puxa discussão própria. Vale um lote "segurança pós-V2" com revisão dedicada, não espalhado na onda 2.
- **Desempenho de infraestrutura** (PERF-01 a PERF-05, PERF-07). O catálogo é pequeno. Otimizar antes de ter dados reais é chute. A B1 vai medir o que importa (o algoritmo).
- **Consistência e limpeza** (CON-*). Nenhum desses itens muda o que a pessoa vê ou paga.
- **Acessibilidade de segundo nível** (A11Y-05 a A11Y-12, exceto o que o F4 já cobre). Os dois de nível A (01 e 02) entram porque são baratos. O resto vai para um lote dedicado com `design:accessibility-review`.
- **Penalidade de 16 GB contra referências que já são de 16 GB.** Quando a montagem cai entre referências de 16 GB (índices 80 a 110), os −8% em AAA pesado são aplicados de novo sobre FPS que já vêm de PCs de 16 GB, e o painel diz "Equivale a um PC de entrada (… 16 GB)" com FPS 8% menor. É uma heurística sobre estimativas, com nota explicando. Corrigir quando o D tiver benchmarks medidos.
- **Cupons sem UI e mistura gulosa.** O `coupons.ts` não tem tela nem tabela. Deixe como está até existir cupom real. A mistura gulosa é simples de explicar, e o ótimo combinatório não vale o custo agora.
- **Diagramas.** Ainda estão em edição. Avaliar no Portão 2 com o conteúdo final.
- **O 1-em-2 do monitor de coleta** (TODO do H). Pode abrir issue falsa numa loja com poucas ofertas, mas é ruído operacional, não dano.

Recado para a onda 2: o risco maior não é bug escondido, é a V2 ficar pronta e desligada. Ligar a tela (item 1) e corrigir os dois problemas de dinheiro (itens 2 e 3) vem antes de qualquer outra coisa.
