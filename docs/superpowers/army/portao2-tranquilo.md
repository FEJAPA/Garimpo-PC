# Portão 2: parecer do Gerente Tranquilo

- Data: 2026-11-04. Diff avaliado: `git diff 24abc72..HEAD` (HEAD = `02772e9`, onda 2 integrada), 107 arquivos, +7.827/−1.280.
- Somente leitura. Este é o único arquivo criado. Nenhum git que muda estado. Não rodei `build`, `dev`/`start` nem e2e (isso é do Gerente Rigoroso).
- Para conferir o comportamento real, rodei sondas descartáveis de Vitest no scratchpad (fora do repositório). Elas chamaram `autoBuild` com o contexto de juros e referências, `installmentPlan`/`installmentBands`/`storeInstallment`, `mixedPlan`, `collectCandidates`, `getBestOffer` e `parseMoney` sobre o mock, com 8 orçamentos e o filtro ligado e desligado.

## Veredito

**APROVADA COM CORREÇÕES.**

1. A onda 2 entregou o que o estado do exército diz: a V2 agora está **ligada na tela**. Specs, referências e juros vêm do servidor, o pagamento usa as tabelas, a aba "Misturar" aparece e as montagens salvas e os alertas funcionam de ponta a ponta. Não achei nenhum fantasma.
2. Os dois problemas de dinheiro do Portão 1 foram resolvidos de verdade. O preço a prazo é o piso do parcelado, e a oferta "boa demais" não é mais recomendada nem vira "melhor preço" (testei sem filtro: o Montador fica com a Kabum a R$ 1.899,90 e não com a de R$ 1.399,90).
3. Sobrou **uma contradição de dinheiro nova**, criada pela própria correção. A tabela de juros por loja passa por cima do que a oferta anuncia: a peça diz "ou 10x de R$ 156,79", e o pagamento diz que a mesma loja cobra +R$ 51,89 em 10x. Por isso o seletor abre em 6x, enquanto todas as peças dizem 10x.
4. O resto são ajustes pequenos de texto e de ruído: nota duplicada, dica que promete o que o Montador não faz, motivos de confiança repetidos 7 vezes e trechos de código na /metodologia. Nenhum deles quebra uma invariante.
5. Verificação: tsc 0, lint 0, vitest 376/376 (21 arquivos).

## Fantasmas

**Nenhum.** Abri cada função. Não confiei no relatório.

| Entrega (estado-exercito.md) | Onde está | Funciona? |
|---|---|---|
| Oferta suspeita nunca em silêncio (B + Confiança) | `auto-build.ts` `ofertasDaPeca`/`escolherOferta`/`suspicionNotes`; `BuildSummary.tsx` (Callout por peça); `format.ts` `getBestOffer`/`offerWarning`; `/peca` (herói + aviso); `ProductCard`; `check-alerts` usa `getBestOffer` | **Sim.** Sonda 6000/7000, 5000/5000, 4500/6000 e 8000/9000 sem filtro: nenhuma peça vem de oferta suspeita. A RTX 4060 fica na Kabum. O caso "só sobrou a suspeita" é testado com detector injetado e gera aviso nas notas e na peça. O herói da /rtx-4060 é a Kabum, R$ 1.899,90. |
| Ligação de specs/referências/juros (F) | `montar/page.tsx` `Promise.all` de 4 serviços → `BuilderForm` → `autoBuild(…, { references, installmentTables })` → `BuildResultView` passa `references` ao painel e `parts` ao `PaymentPlanner` | **Sim.** O "Misturar" refaz as tabelas a partir de `payment.stores[].interestTable`, então os juros chegam lá também. No modo real, juros e specs vazios devolvem `{}` e não o mock (`installments.ts`, `specs.ts`). |
| Faixas do parcelado (Correções-Pagamentos) | `payments.ts` `montarPlano`/`installmentBands`/`formatSchedule`; `PaymentPlanner` `Faixas` | **Sim.** Σ parcelas = total, os centavos vão na 1ª parcela e a nota de arredondamento aparece. O seletor abre no maior n sem acréscimo, e a economia do Pix é calculada contra o parcelado mais barato ("em relação a 6x no cartão"). **Ressalva:** ver item 1 da lista final. |
| "Usou a folga" só com troca (B) | `autoBuild`: `usedWiggleRoom = upgrades.length > 0 && totalPix > target`; `situacaoDe` na view | **Sim.** 10000/12000: houve troca, mas o total ficou abaixo do alvo, então `false`. 4500/6000: já passava do alvo antes da troca, a nota explica e o selo diz "Usou a folga". Acima do alvo sem troca dá "Acima do alvo, dentro do teto". |
| Montagens salvas + alerta da montagem (G) | `saved-builds.ts`, `account/actions.ts` (`saveBuild` confere as ofertas no banco e grava o preço de lá; `createBuildAlert` faz upsert), `SaveBuildButton`, `/conta` | **Sim.** Sem login, o link "Entre para salvar" volta com `?b=`. O limite de montagens, o nome de até 60 caracteres e a validação das prefs estão lá. O total atual usa `getBestOffer` e respeita `trustedOnly`, e falta de peça não dispara o alerta. |
| Rota de alertas fechada (G) | `api/check-alerts/route.ts` | **Sim.** Sem `CRON_SECRET` responde 503, e com token errado responde 401 (comparação em tempo constante). E-mail simulado não marca o alerta. Ao avisar, desliga o alerta e grava `notified_at`, e a /conta mostra "avisado em DD/MM" com "Reativar". |
| Specs validadas, peças ignoradas (B + Dados) | `hasRequiredSpec`, `collectCandidates` (`ignored`), `converterLinha` em `specs.ts` | **Sim**, mas a nota aparece **duas vezes** na tela (item 2 da lista). |
| parseMoney (F) | `src/lib/money.ts`, usado no form, no planner, na URL e no alvo do alerta | **Parcial.** "6000.50" dá 6000,5 (ok), mas "1500.5" dá **15.005** e "1.5" dá 15. O teste `money.test.ts:16` fixa `parseMoney("6000.5") === 60005`. |
| Planejador exato, 150 peças < 200 ms | `makePlanner` + teste `auto-build.test.ts:539` | Sim (o teste passa). |
| Coletor com gravação verificada (PERF-06) | `scripts/collect-prices.mjs:161-182` | Sim, `error` agora é lido e devolvido. |

## Status dos 10 itens do Portão 1

| # | Item | Status | Observação |
|---|---|---|---|
| 1 | Ligar a onda 1 na tela | **Resolvido** | Tudo ligado, inclusive "Misturar" e "PCs parecidos" com as referências do servidor. |
| 2 | Juros não podem baratear o parcelado | **Resolvido** | Piso = preço a prazo, LOG-10/12 e o seletor abrindo sem acréscimo. Efeito colateral novo: a tabela contradiz a contagem anunciada pela oferta (item 1 abaixo). |
| 3 | Oferta "bom demais" não recomendada em silêncio | **Resolvido** | Montador, herói, card, alerta e e2e (`montar.spec.ts:156`). |
| 4 | `parseMoney` e teto | **Parcial** | Teto e "6000.50" ok. Ponto seguido de 1 dígito ainda vira milhar (item 3 abaixo). |
| 5 | Validar dados do banco | **Resolvido** | `hasRequiredSpec`, perf > 0, categoria, `mapReferenceRow` positivo. Na tela, a nota sai duplicada (item 2). |
| 6 | "Usou a folga" só com troca | **Resolvido** | Sem "+Infinity%" (`ganhoPct` devolve null). |
| 7 | Uma régua só de confiança | **Resolvido** | O `StoreBadge` usa `trustLevel`. O toggle diz "oficiais com nota 4,5 ou mais e sem reclamações graves". |
| 8 | Dado ilustrativo não vira fato | **Quase** | Os seeds têm cabeçalho "SÓ PARA DEMONSTRAÇÃO", a /peca tem o aviso de demonstração, e juros e specs ficam vazios no modo real. Falta uma coisa: `getReferenceBuilds` ainda cai no mock em erro ou tabela vazia no modo real (`references.ts:43-56`), contra a letra da regra nova do AGENTS.md. O dano é baixo (é estimativa rotulada), ver item 9. |
| 9 | Alertas que mentem | **Resolvido** | SEG-01, SEG-02 e DAD-05. |
| 10 | Coleta que finge sucesso | **Resolvido** | PERF-06. |
| extra | A11Y-01/02 | **Quase** | O skip link está ok. `/conta` ficou sem `metadata` (sem título próprio). |

## O que a pessoa vai sentir

1. **"A loja diz 10x, o site diz 6x."** Na lista de peças, a Terabyte aparece como "ou 10x de R$ 156,79". Em "Como pagar", a mesma loja mostra "sem acréscimo até 6x · +R$ 51,89 em 10x". O seletor abre em 6x, embora todas as peças anunciem 10x. A pessoa não sabe em quem acreditar, e essa é a única confusão de **dinheiro** que sobrou. A marketplace da 4070 SUPER faz o mesmo: anuncia 12x por R$ 4.299,90 e o plano cobra R$ 4.484,88 já em 1x.
2. **Resumo de peças denso demais.** Cada uma das 7 peças tem nome, selos (Oficial e nota), a linha "Por que confiável: Loja oficial · Nota 4,8 (125.000 avaliações) · Reclame Aqui 8,2 · 22 anos de mercado", o preço Pix, "ou 10x de…", "lido em 04/11, 14:00" e o botão. Com a Kabum em 3 ou 4 peças, a mesma frase de confiança se repete. Virou ruído: o motivo só ajuda quando a loja **não** é confiável. O "lido em" é útil e curto, então eu o manteria.
3. **"Quad HD pede placa de vídeo mais forte"** dá a entender que o Montador vai escolher uma placa melhor. Ele não muda nada: `resolution` só destaca a coluna da tabela de FPS. Quem escolhe Quad HD recebe o mesmo PC do Full HD.
4. **Nota repetida.** Com specs faltando no banco, "Como chegamos aqui" mostra "N peças do catálogo foram ignoradas…" e logo abaixo "N peças do catálogo ficaram de fora…".
5. **"Sobra R$ 200,70"** ao lado de "Usou a folga" e de um total acima do alvo: o leigo lê "sobrou dinheiro do que eu queria gastar". É a sobra **até o teto**.
6. **Notas da folga em linguagem de planilha.** "No total, as trocas usaram R$ 799,30 da folga (acima do alvo, dentro do teto); o resto veio do que sobrou dentro do alvo." Está correta, mas são duas notas para uma troca. Não vou mexer agora (ver "depois"), mas é o texto mais difícil da tela.
7. **/metodologia** começa muito bem ("a GarimpoPC não mediu nenhum FPS", ±10–15%, o que entra e o que não entra). No fim, porém, mostra a seção "Onde isso está no código" (caminhos `src/…`), o campo `measuredAt` e `docs/COLETA-SPECS.md`, que são jargão de desenvolvedor numa página pública.
8. **/conta:** com um alerta de montagem ativo, o formulário logo abaixo continua dizendo "Criar alerta", e ao enviar a resposta é "Alerta criado!", embora a ação **troque** o valor do alerta existente. A pessoa pode achar que agora tem dois alertas.

O que está bom e não deve mexer: "Por que confiável" na /peca com o contraste honesto; "Preço bom demais?" com instrução clara; "Misturar" em linguagem de gente ("Pague R$ 1.999,80 no Pix (2 peças) e parcele o resto em 12x de R$ 613,96 · Falta R$ 114,06 por mês"); a faixa "Base: estimativa · fontes consultadas em nov/2026 · ver metodologia", que substituiu a "Fonte:" longa em cada cartão; e a falha "Orçamento insuficiente: a mais barata custa R$ 4.699,30".

## Lista para a rodada final (≤ 12)

Ordem de prioridade. O item 1 é o único de dinheiro. Os itens 2 a 8 são de texto e cabem numa tarde. Os itens 9 a 11 são de coerência.

| # | O quê | Arquivo(s) | Tam. | Por quê |
|---|---|---|---|---|
| 1 | **O que a oferta anuncia vale até o número que ela anuncia.** Em `totalDaLoja`, para `n ≤` o menor `installment_count` das ofertas da loja, o total é o `installmentTotal` (preço a prazo anunciado). A tabela só decide **acima** disso, e aí também nunca abaixo do preço a prazo. Assim `storeNoExtraUpTo` e `defaultInstallmentCount` passam a abrir em 10x no demo. Alinhar o mock (`terabyte`, `promocenter`) e o `seed-payments.sql`, e trocar os testes que fixam 6x. Teste novo: "oferta anuncia 10x → sem acréscimo até 10x mesmo com tabela". | `src/services/builder/payments.ts`, `payments.test.ts`, `src/models/installment-tables.ts`, `supabase/seed-payments.sql` (e `mixed-plan.ts`/`custoEvitado`, se usar a mesma regra) | M | É a única contradição de dinheiro visível: a peça diz 10x, o pagamento diz que 10x tem acréscimo. |
| 2 | Tirar a 2ª nota de peças ignoradas. A `BuildResultView` repete o que `autoBuild` já põe em `notes`: apagar o `<li>` extra e o `ignoradas > 0` da condição. | `src/components/builder/BuildResultView.tsx` | P | Frase duplicada na caixa "Como chegamos aqui". |
| 3 | `parseMoney`: ponto seguido de **1 ou 2** dígitos no fim é decimal ("1500.5" → 1500,5), e ponto seguido de 3 dígitos é milhar. Corrigir o teste que fixa `"6000.5" → 60005`. | `src/lib/money.ts`, `src/lib/money.test.ts` | P | No celular, o teclado `inputMode="decimal"` em inglês só tem ponto: "1500.5" vira R$ 15.005 e o plano misto põe tudo no Pix. |
| 4 | Dica de resolução honesta: "Destacamos os FPS em Quad HD. Para jogar bem nessa resolução, costuma ser preciso um orçamento maior." O texto não deve prometer que o Montador escolhe uma placa melhor. | `src/components/builder/BuilderForm.tsx` (`RESOLUCOES`) | P | Hoje promete um comportamento que não existe. |
| 5 | No resumo de peças, mostrar a linha "Por que…" **só para loja não confiável**. Para a confiável, ficam o selo e os motivos no `title`/`sr-only` (o `StoreBadge` já faz isso com `announceReasons`). | `src/components/builder/BuildSummary.tsx` | P | Corta 7 linhas repetidas e deixa o aviso onde ele importa. |
| 6 | "Sobra" → "Sobra até o teto" no cabeçalho do resultado. | `src/components/builder/BuildResultView.tsx` | P | Evita ler "sobrou do alvo" quando passou do alvo. |
| 7 | /metodologia sem trechos de desenvolvedor: parar a renderização antes de "## 7. Onde isso está no código" (ou mover essa seção para um comentário), e tirar do texto público a frase do `measuredAt` e o caminho `docs/COLETA-SPECS.md`. | `docs/METODOLOGIA-DESEMPENHO.md` e/ou `src/app/metodologia/page.tsx` | P | É a página pública de confiança. Caminhos de código confundem quem não programa. |
| 8 | /conta: com alerta de montagem existente, o botão diz "Mudar alerta" e a mensagem diz "Alerta atualizado". Junto: `metadata` com título "Minha conta" (A11Y-02). | `src/components/builder/SaveBuildButton.tsx` (`SavedBuildAlertForm` recebe `hasAlert`), `src/app/account/actions.ts`, `src/app/conta/page.tsx` | P | Hoje parece que cria um segundo alerta. A página é a única sem título próprio. |
| 9 | Referências no modo real: decidir e deixar coerente. (a) `getReferenceBuilds` devolve `[]` em erro ou tabela vazia com Supabase configurado, e o painel já tem o caminho `SEM_REFERENCIA`; **ou** (b) registrar no AGENTS.md a exceção "referências são estimativas públicas rotuladas e podem cair no padrão local". Recomendo (b) se a rodada estiver apertada. | `src/services/references.ts` (+ teste) **ou** `AGENTS.md` | P | A regra nova do AGENTS.md diz uma coisa e o serviço faz outra. Agente futuro vai tropeçar. |
| 10 | Comentários velhos que mentem para o próximo agente: `PerformancePanel.tsx:23-28` diz que não há página de metodologia, e `:55` diz que /montar não passa `references`. | `src/components/builder/PerformancePanel.tsx` | P | O projeto é didático, e um comentário errado é um bug de documentação. |
| 11 | e2e das faixas do parcelado (resto do R-14), **depois do item 1**: com o demo 6000/7000, o seletor abre em 10x "sem acréscimo" e a manchete fecha com o total. | `tests/e2e/montar.spec.ts` | P | Trava a correção de dinheiro do item 1. |

Somando tudo: 1 item M e 10 itens P. Cabe numa rodada Opus só, com o item 1 primeiro.

## Deixar para depois da V2

| O quê | Motivo |
|---|---|
| Resolução mudar de fato a montagem (mais fatia para a GPU em 1440p) | É mudança de algoritmo, com testes e calibração. O item 4 resolve o engano com uma frase. |
| Reescrever as notas da folga em uma frase só | O texto está correto e testado (`auto-build.test.ts` "duas trocas…"). Mexer agora quebra testes por estética. Vale um lote de UX writing. |
| Callouts de "Sem especificações cadastradas" e "Catálogo vazio" em /montar falando "rode `npm run collect:specs`" | Só aparecem num deploy mal configurado, e quem vê primeiro é o dono do site. Trocar por um texto para a pessoa e um log para o dono num lote de "estados de erro". |
| `getBestOffer` devolver a suspeita quando só sobra ela, e o e-mail de alerta sem aviso nesse caso | Com a regra atual de C3 é inalcançável: só há suspeita se existe oferta confiável em estoque, e essa entra em `normais`. Rever se a regra mudar. |
| Alerta de montagem com nome de loja/peça no e-mail e com o "total atual" na /conta (hoje mostra o total salvo, rotulado "salva em DD/MM") | Está rotulado e não engana. Melhoria de produto. |
| Mistura gulosa × ótima, cupons sem UI (`TODO(V2-E)`) | Já estava adiado no Portão 1, e a mistura por custo evitado está honesta. |
| Guloso → otimização global (`TODO(V2-B)`) | O planejador exato já garante a mais barata compatível e o teto. O resto é ganho de qualidade, não de honestidade. |
| DAD-01, SEG-07 (headers já entraram), PERF-02/03/04, A11Y-05..12, CON-* | Mesmos motivos do Portão 1: nenhum muda o que a pessoa vê ou paga hoje. |

Recado para a rodada final: comece pelo item 1, que é dinheiro, e só depois passe aos textos. Não reabra o algoritmo nem os alertas: estão corretos e bem testados.
