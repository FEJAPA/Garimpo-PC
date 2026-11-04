# Portão 2: veredito do Gerente Rigoroso (onda 2)

- Data: 2026-11-04. Diff revisado: `git diff 24abc72..02772e9` (onda 2 integrada): **108 arquivos, +7.923/−1.280**.
  O número citado na ordem (124 arquivos, +13.094/−947) é o de `e709af0..HEAD`, ou seja, onda 1 + onda 2. Não é
  fantasma, só a base errada. Durante a revisão entrou `abbc677` (só o parecer do Tranquilo), sem mudar código.
- Somente leitura. Este é o único arquivo criado. Nenhum git que muda estado, nenhum `npm install`. O `next dev` foi
  encerrado (`pkill -f "next dev"`) ao fim dos e2e.
- Método: leitura do diff de B, F, G, Pagamentos, Desempenho, Confiança-A11y, Dados-Scripts e da integração do
  Comandante, mais três sondas Vitest descartáveis em
  `/tmp/claude-0/-home-user-Garimpo-PC/febd64dc-4f68-5d7c-ad4a-8a7fff850b2c/scratchpad/rigoroso2/probe/` (fora do repo).
  As sondas foram:
  1. `inv.sonda.ts`: `autoBuild` sobre o mock em 11 orçamentos × 3 perfis × 4 posições do slider × filtro ligado/desligado ×
     com/sem `ctx` (`REFERENCE_BUILDS` + `INSTALLMENT_TABLES`), que dá 528 execuções. Também roda 80 catálogos sintéticos
     de 3 peças/categoria, com o planejador conferido contra **força bruta**, e mais 3.420 montagens sintéticas. Em todos os
     resultados `ok`, confere o teto, a compatibilidade par a par, as 7 categorias, a ausência de loja bloqueada e de peça sem
     estoque, as lojas confiáveis com o filtro ligado, a oferta suspeita sempre com aviso, `Σ count×monthly = total` para todo n,
     o total ≥ o preço a prazo, as faixas + arredondamento = total, `pixSavings` = melhor n>1 − Pix (≥ 0) e o plano misto
     (Pix ≤ à vista, nenhuma peça perdida, faixas fecham). Mede ainda o tempo com 150 peças/categoria.
  2. `bordas.sonda.ts`: `parseMoney`, `decodeBuild` com 19 tipos de lixo, `safeHref` e bordas de pagamento.
  3. `uso.sonda.ts`: o efeito do perfil de uso na montagem final.

## Veredito

**APROVADA COM CORREÇÕES.**

1. **Nenhuma invariante quebrou.** Mock: 432 montagens ok e 96 falhas legítimas (orçamento curto), com **0 violações**.
   Sintético: 3.420 casos e **0 violações**. O planejador "mais barata compatível" bate com a força bruta nos 80 catálogos. Com
   "só lojas confiáveis" nenhuma peça vem de loja não confiável. Loja bloqueada nunca entra. A oferta de R$ 1.399,90 não é
   mais escolhida (a RTX 4060 sai da Kabum a R$ 1.899,90) e nenhum cenário do mock precisou usar oferta suspeita. A
   aritmética do parcelado fecha ao centavo em todos os n.
2. **Os 19 achados do Portão 1:** 15 resolvidos, 3 parciais (R-14, R-18 e, por consequência de A11Y-02, a parte de títulos)
   e nenhum aberto. Ver a tabela abaixo. Das 27 trufas "corrigir", 25 estão resolvidas e 2 parciais (LOG-01 e A11Y-02).
3. **Um achado alto novo, que é resíduo do LOG-01 (S-01):** `parseMoney("6000.5")` dá **60.005**, `"6.5"` dá 65 e
   `"1.2.3"` dá 123. Digitado no alvo, "6000.5" vira um alvo de R$ 60.005 e o teto menor é igualado a ele: a montagem sai
   10 vezes mais cara. O teste `money.test.ts:16` **fixa o bug como comportamento**.
4. **Achados médios novos:**
   - o perfil "Trabalho" gasta a folga na placa de vídeo (S-02);
   - a regra V1 "o carrinho todo segue a loja que parcela menos" derruba o parcelado para 1x no modo real (S-04);
   - `getReferenceBuilds` cai no mock em erro ou tabela vazia, contra a regra nova do AGENTS.md (S-07);
   - a contradição "a oferta diz 10x, a tabela diz 6x" (S-03, a mesma do Tranquilo, item 1);
   - os diagramas dizem que B, F e G "ainda não existem" (S-19).
5. Verificação completa: tsc, lint, Vitest (376/376), build e e2e (23 passam, 1 ignorado de propósito) **PASS**.

## Conclusões-fantasma

**Nenhuma.** Conferi cada entrega do `estado-exercito.md` (onda 2) no código. Há só três divergências de grau:

| Entrega declarada | Conferido | Divergência |
|---|---|---|
| B: "perfis de uso" | `scoring.ts:56-75` muda as fatias do guloso | Parcial: o passo de folga (`auto-build.ts:490`) sempre sobe a GPU primeiro, para qualquer perfil, o que desfaz o "Trabalho" (S-02) |
| Confiança-A11y: "títulos" | `metadata` em `/`, `/busca`, `/entrar`, `/montar`, `/metodologia`, `generateMetadata` em `/peca` | `/conta` ficou sem título próprio (S-11) |
| Comandante: "diagrama de pagamento" | 2 linhas de `fluxo-pagamento.md` | O mesmo arquivo ainda diz que a aba Misturar está "escondida" (linhas 22, 85, 101, 148), e os outros diagramas dizem que B, F e G não existem (S-19) |

O resto confere: o planejador exato (meu tempo foi de 20 a 35 ms com 150 peças/categoria), `ctx` de ponta a ponta, parseMoney
(com o resíduo S-01), `?b=`, CSV com fórmulas neutralizadas, salvar, alertas de montagem, rota fechada, `recorded_at` via view,
faixas, piso a prazo, economia honesta, misto por custo evitado, RAM sem dupla contagem, fontes honestas, guardas, metodologia,
régua única, melhor preço honesto, bloqueio, skip link, gráficos acessíveis, specs validadas, gravação verificada e e2e
contra `next start` no CI.

## Status de R-01..R-19

| id | status | evidência |
|---|---|---|
| R-01 | **resolvido** | `auto-build.ts:136-146` (prefere a não suspeita), `:176` (`Candidate.suspicious`), `:548-555` (nota); `BuildSummary.tsx:82-86` (Callout); `format.ts:34-40` (`getBestOffer` pula a suspeita); `peca/[slug]/page.tsx:56-58,96-100`; `ProductCard.tsx`; `check-alerts/route.ts:219`. Sonda: 0 suspeitas sem aviso |
| R-02 | **resolvido** | `montar/page.tsx:36-41` (`Promise.all` dos 4 serviços); `BuilderForm.tsx:145` (`autoBuild(…, { references, installmentTables })`); `auto-build.ts:652,674`; `BuildResultView.tsx:172-173` (`references`, `parts`) |
| R-03 | **resolvido** | `payments.ts:129-164` (faixas e centavos na 1ª parcela); `PaymentPlanner.tsx:108-113,206-231`. Sonda: Σ faixas + arredondamento = total em todos os n |
| R-04 | **resolvido** | `payments.ts:311-318` (melhor n>1); `PaymentPlanner.tsx:96-101` ("em relação a Nx") |
| R-05 | **resolvido** | `PaymentPlanner.tsx:36-42,247-251` usa `parseMoney` de `lib/money.ts` (com o resíduo S-01) |
| R-06 | **resolvido** | `mixed-plan.ts:64-71,83-86` (custo evitado) |
| R-07 | **resolvido** | `performance.ts:189-197` (só desconta contra vizinhas com mais RAM). Sonda: 7700 XT entre referências de 32 GB → −8%; 4060 Ti entre 16 e 32 GB → −2% |
| R-08 | **resolvido** | `performance.ts:222-231` (a partir de `spec.upscaling`: "Com FSR" para AMD); `PerformancePanel.tsx:194-204` (linha informativa; Callout só em 1440p) |
| R-09 | **resolvido** | `seed-references.sql` e `reference-builds.ts`: nova `source`, mês 2026-05; `measuredAt` mantido, mas documentado (`references.ts:25-29`, METODOLOGIA §2); `PerformancePanel.tsx:207-218` ("Base: estimativa…") |
| R-10 | **resolvido** | `seed-builder.sql` sem o bloco de `reference_builds`; TODO apagado de `seed-references.sql` |
| R-11 | **resolvido** | `trust.ts:113-117` (bloqueada fora sempre); `peca/[slug]/page.tsx:149,157-161` |
| R-12 | **resolvido** | `trust.ts:31-36` (`lerNumero`); `products.ts:38-58` (`normalizeStore`/`normalizeOffer`); `popularity.ts` normaliza também |
| R-13 | **resolvido** | `playwright.config.ts:61-66` (`next start` no CI, `reuseExistingServer: !CI`); `ci.yml` (`push` só na `main`) |
| R-14 | **parcial** | Há e2e do filtro desligado (`montar.spec.ts:156-171`), mas ele é **condicional** e passa por acaso (S-16). Ficam sem e2e: as faixas do parcelado e o aviso/herói em `/peca/rtx-4060` (`navegacao.spec.ts:35-40` só confere o h1) |
| R-15 | **resolvido** | `docs/COLETA-SPECS.md:39-45,118` usa `npm run collect:specs` |
| R-16 | **resolvido** | `auto-build.ts:448-452` (nota única, `categoryLabel` em minúsculas) |
| R-17 | **resolvido** | `auto-build.ts:536-545` (preço de cada troca) e `:628-636` (total da folga) |
| R-18 | **resolvido** (com ressalva) | `DESIGN.md` documenta o tom "relacionado"; `lib/chart-colors.ts` é a fonte única. Ressalva: `email.ts:67-75` repete hex, mas o comentário justifica (e-mail não lê CSS). Aceito |
| R-19 | **resolvido** | `collect-specs.mjs:58-110` (`OBRIGATORIOS` por categoria, enums, inteiros) |

## Status das 27 trufas "corrigir" (triagem do Tranquilo, Portão 1)

| id | status | evidência |
|---|---|---|
| SEG-01 | resolvido | `check-alerts/route.ts:91-101` (503 sem segredo; 401 com `timingSafeEqual` sobre sha256, mesmo tamanho) |
| SEG-02 | resolvido | `email.ts:28-31` (`simulated: true`); `route.ts:136-141` (não marca) |
| LOG-01 | **parcial** | "6000.50" → 6000,5 ok (`money.ts:27-28`); "6000.5" → 60.005 (S-01) |
| LOG-02 | resolvido | `compatibility.ts:30-51` (`hasRequiredSpec`); `auto-build.ts:168` |
| LOG-03 | resolvido | `specs.ts:121-124`; `auto-build.ts:168` (categoria da spec = do produto) |
| LOG-04 | resolvido | `auto-build.ts:644-650`. Na tela sai **duas vezes** (S-08) |
| LOG-05 | resolvido | `auto-build.ts:669` |
| LOG-06 | resolvido | `auto-build.ts:495-498,528-534` |
| LOG-07 | resolvido | Planejador `auto-build.ts:236-324`; 20 a 35 ms com 150 peças/categoria (sonda) |
| LOG-08 | resolvido | `montar/page.tsx:24-28`; `BuilderForm.tsx:131-139` (`moneyError`, `MAX_MONEY`) |
| LOG-09 | resolvido | = R-02 |
| LOG-10 | resolvido | `payments.ts:58-61`; `BuildSummary.tsx:28-31`. Resto na /peca: S-13 |
| LOG-12 | resolvido | `payments.ts:35,63-85`; `installments.ts:34`; `schema-payments.sql` (CHECK 1..24) |
| LOG-14 | resolvido | `references.ts:69-70` |
| LOG-16 | resolvido | `specs.ts:126-127`; `performance.ts:242-250` |
| LOG-17 | resolvido | `trust.ts:98-101` (`trustLevel`); `StoreBadge.tsx:18-22,57-64`; `format.ts:59-63` |
| LOG-18 | resolvido | `format.ts:34-40`; `route.ts:219`; `ProductCard.tsx` |
| DAD-05 | resolvido | `route.ts:142-145`; `conta/page.tsx` ("avisado em", Reativar) |
| A11Y-01 | resolvido | `layout.tsx:26-31,34`. O link fica fora da tela (`-translate-y-24`) e aparece só no foco (`focus:translate-y-0`), e `main#conteudo` tem `tabIndex=-1` |
| A11Y-02 | **parcial** | `/conta` sem `metadata` (S-11) |
| A11Y-03 | resolvido | `Field.tsx:32-50` (`aria-describedby` por contexto, `aria-invalid`) |
| A11Y-04 | resolvido | `BuildResultView.tsx:114-128` (foco no cabeçalho com h2 sr-only) |
| PERF-06 | resolvido | `collect-prices.mjs:161-182` (lê `error`; sai com código 1) |
| TST-01 | resolvido | `payments.test.ts` (+266 linhas) |
| TST-02 | resolvido | `performance.test.ts` (score 0, perf NaN, lista vazia) |
| TST-03 | resolvido | `auto-build.test.ts:316-380,527-560` (ignoradas, catálogo vazio, força bruta, 150 peças, 200 combinações) |
| TST-04 | resolvido, com teste errado | `money.test.ts` existe, mas a linha 16 fixa `"6000.5" → 60005` (S-01) |

Também conferi o que ficou com o Comandante: SEG-04 resolvido (`Button.tsx:76-91`, `share.ts:116-126`), SEG-05 resolvido
(`products.ts:143-149`), SEG-07 resolvido (`next.config.ts:5-25`, headers básicos, sem HSTS: o host cuida), SEG-10/11
resolvidos (`saved-builds.ts:209-216`, `account/actions.ts:64-69`), DAD-04 resolvido (paginação + concorrência 5), LOG-13
resolvido (`products.ts:232-242`) e PERF-05 resolvido (não há `waitForTimeout` nos e2e). **SEG-06 continua aberto**
(`peca/[slug]/page.tsx:52`, `await registerView` bloqueia a página), mas foi adiado de propósito.

## Verificação

| Comando | Resultado | Resumo |
|---|---|---|
| `npx tsc --noEmit` | **PASS** | exit 0 |
| `npm run lint` | **PASS** | eslint exit 0, sem avisos |
| `npx vitest run` | **PASS** | 21 arquivos, **376/376**, 6,3 s |
| `npm run build` | **PASS** | Next 16.2.9 (Turbopack), compilou em 24,4 s, TypeScript ok, 10 rotas; `/montar`, `/peca/[slug]`, `/busca`, `/entrar` e `/api/check-alerts` dinâmicas; `/`, `/conta` e `/metodologia` estáticas (a `/conta` vira um redirect estático sem Supabase no build, como já era na V1) |
| `npx playwright test` | **PASS** | 24 testes em 2 projetos: **23 passam, 1 ignorado** de propósito, 40,9 s; `next dev` encerrado |
| Sonda de invariantes (mock + sintético + força bruta) | **PASS** | 0 violações de teto, compatibilidade, lojas, bloqueio, suspeita ou aritmética |

Os logs estão em `/tmp/claude-0/-home-user-Garimpo-PC/febd64dc-4f68-5d7c-ad4a-8a7fff850b2c/scratchpad/rigoroso2/`
(`tsc.log`, `build.log`, `e2e.log`, `probe/resultado.txt`, `probe/bordas.txt`, `probe/uso.txt`).

Números da sonda (com `ctx`), para a rodada final conferir depois:

| Cenário | Pix | A prazo | Seletor abre | Menor parcelado (n>1) | Observação |
|---|---|---|---|---|---|
| 6000/7000, confiáveis | 6.799,30 | 7.615,23 | 6x (6x de 1.269,19 + R$ 0,09) | 6x = 7.615,23 | RTX 4060 → RX 7700 XT (+42%), "usou R$ 799,30 da folga" |
| 6000/7000, sem filtro | igual | igual | igual | igual | a oferta de R$ 1.399,90 não entra |
| 8000/9000, sem filtro | 8.519,30 | 9.473,64 | **12x = 9.785,10** | 6x = 9.658,62 | 4070 SUPER da marketplace; o cabeçalho diz "ou R$ 9.473,64 parcelado", valor que nenhuma opção atinge (S-03/S-05) |
| 5000/5000, sem filtro | 4.699,30 | 5.263,23 | 6x | 6x | nota única das categorias que não couberam |
| Perfil Trabalho, 8000/10000 | 9.749,30 | n/d | n/d | n/d | sobe a GPU para a RTX 4070 SUPER com a folga (S-02) |

## Problemas novos (S-xx) para a rodada final

Agrupados por arquivo: **cada grupo é um dono**, e nenhum arquivo aparece em dois grupos. "= T-n" quer dizer que o
Tranquilo listou o mesmo problema como item n (`portao2-tranquilo.md`), para a rodada não fazer duas vezes.

### Grupo 1: `src/lib/money.ts` + `src/lib/money.test.ts`

| id | arquivo:linha | sev. | descrição | correção concreta | tam. |
|---|---|---|---|---|---|
| S-01 (= T-3) | `money.ts:26-28`; `money.test.ts:16` | **alto** | Ponto seguido de 1 dígito, ou de grupos que não têm 3 dígitos, vira milhar: "6000.5" → 60.005, "6.5" → 65, "6.0000" → 60.000, "1.2.3" → 123. No alvo, "6000.5" dá R$ 60.005 e o teto menor é igualado a ele. O teste fixa o bug | Sem vírgula: se casar `^\d{1,3}(\.\d{3})+$` é milhar; se casar `^\d+\.\d{1,2}$` é decimal; qualquer outra forma com ponto → `NaN`. Testes: "6000.5" → 6000,5; "6.5" → 6,5; "1.234.567" → 1234567; "6.0000", "1.2.3" e "1.23.456" → NaN; trocar a linha 16 | P |

### Grupo 2: `src/services/builder/payments.ts` + `mixed-plan.ts` + `payments.test.ts` + `mixed-plan.test.ts` + `src/models/installment-tables.ts` + `supabase/seed-payments.sql`

| id | arquivo:linha | sev. | descrição | correção concreta | tam. |
|---|---|---|---|---|---|
| S-03 (= T-1) | `payments.ts:124-127` (`totalDaLoja`); `installment-tables.ts:31-35` | médio | A tabela passa por cima do que a oferta anuncia: a peça da Terabyte diz "ou 10x de…", e "Como pagar" diz que a loja só vai até 6x sem acréscimo (+15% de 7x a 10x). O seletor abre em 6x | Em `totalDaLoja`, se `n ≤` o menor `installment_count` válido das ofertas daquela loja, o total é `installmentTotal`; acima disso vale `max(installmentTotal, pix × fator(n))`. Guardar esse mínimo em `StorePayment` (campo opcional novo `offersInstallmentCount`). Teste: Terabyte com ofertas 10x e tabela 6x/1,10 + 10x/1,15 → em 10x o extra é 0 | M |
| S-04 | `payments.ts:301-307` | médio | V1 (sem tabela, que é o padrão no modo real, porque `getInstallmentTables` devolve `{}`): basta uma oferta sem `price_installment` para o carrinho inteiro cair para 1x (sonda: `max 1`, `best 1x`). As faixas já suportam lojas com prazos diferentes | `maxInstallments = Math.max(...stores.map(maximoDaLoja))` sempre (apagar o ramo `algumaTabela` do mínimo). Atualizar `PaymentPlanner` só se a dica "Limitado pela loja que parcela em menos vezes" mudar (é outro dono: deixar a frase genérica no Grupo 9). Teste: loja A 10x + loja B só Pix → 10x com faixas "1x de (A/10+B) + 9x de A/10" | P |
| S-05 | `payments.ts:250-255` (`defaultInstallmentCount`) | baixo | Quando nenhuma opção é "sem acréscimo", o seletor abre no **máximo**, que é a mais cara (sonda 8000/9000: abre em 12x = 9.785,10, e a mais barata é 6x = 9.658,62) | Sem opção de extra 0, abrir em `summary.bestInstallment.count`. Teste | P |
| S-06 | `payments.ts:269`; `mixed-plan.ts:67` | baixo | `price_installment` menor que `price_pix` (dado ruim) dá "parcelado" mais barato que o Pix e `pixSavings` negativo (sonda: −100) | `const parcelado = Math.max(offer.price_pix, validInstallmentPrice(offer) ?? offer.price_pix)` nos dois lugares. Teste | P |

### Grupo 3: `src/services/builder/auto-build.ts` + `auto-build.test.ts`

| id | arquivo:linha | sev. | descrição | correção concreta | tam. |
|---|---|---|---|---|---|
| S-02 | `auto-build.ts:490` (`upgradePass`, laço fixo `["gpu","cpu"]`) | médio | O perfil só mexe nas fatias do guloso. A folga vai sempre primeiro para a placa de vídeo, o que desfaz "Trabalho: processador e memória". Mock Trabalho 8000/10000 → RTX 4070 SUPER e R$ 9.749,30; no sintético, Trabalho gasta R$ 1.744 de folga na GPU | Passar `prefs.usage` a `upgradePass` e usar `ORDEM_SUBIDA = { jogos: ["gpu","cpu"], criacao: ["cpu","gpu"], trabalho: ["cpu"] }`. Atualizar o comentário do topo e a spec §5.4 (Grupo 15). Teste: Trabalho com folga não troca a GPU | P |
| S-09 | `auto-build.ts:666` | baixo | `totalInstallment = payment.installmentTotal` (preço a prazo) aparece no cabeçalho como "ou R$ X parcelado" mesmo quando nenhuma opção custa X (sonda 8000/9000: 9.473,64 contra o mínimo real de 9.658,62). Depois de S-03 isso fica raro, mas continua possível | `totalInstallment: payment.bestInstallment?.total ?? payment.installmentTotal`. Teste com a marketplace (fator 1,15 em toda faixa) | P |
| S-10 | `auto-build.ts:575-581` | baixo | Modo real com `part_specs` vazia: a falha diz "Não há placa de vídeo disponível com os filtros atuais. Desative “Só lojas confiáveis”…" (sonda), dica errada para a causa | Se `ignored.count === products.length` (ou nenhuma spec válida), `fail("Nenhuma peça do catálogo tem especificação técnica cadastrada; não dá para montar agora.")`. Teste | P |

### Grupo 4: `src/services/references.ts` + `references.test.ts`

| id | arquivo:linha | sev. | descrição | correção concreta | tam. |
|---|---|---|---|---|---|
| S-07 (= T-9) | `references.ts:1-4,92,102-105,115` | médio | Com Supabase configurado, erro ou tabela vazia devolve `REFERENCE_BUILDS` (ilustrativo), contra a regra do AGENTS.md ("em erro ou tabela vazia devolve vazio e a tela avisa"). `specs.ts` e `installments.ts` seguem a regra; este não. Os "PCs parecidos" com preço ilustrativo aparecem sem o aviso de demonstração | Erro/vazio → `[]` (o caminho `SEM_REFERENCIA`/`NOTA_SEM_REFERENCIAS` já existe em `performance.ts:274-279`, e a sonda confirmou que funciona). Comentário do topo igual ao de `specs.ts`. Testes: erro → `[]`, vazio → `[]`, sem Supabase → mock | P |

### Grupo 5: `src/components/builder/BuildResultView.tsx`

| id | arquivo:linha | sev. | descrição | correção concreta | tam. |
|---|---|---|---|---|---|
| S-08 (= T-2) | `BuildResultView.tsx:154,160-166` | baixo | "N peças… ignoradas" aparece duas vezes: `autoBuild` já põe a frase em `notes` (`auto-build.ts:644-650`) | Apagar o `<li>` extra e o `ignoradas > 0` da condição da linha 154 (fica `result.notes.length > 0`) | P |
| (= T-6) | `BuildResultView.tsx:134` | baixo | "Sobra R$ X" ao lado de "Usou a folga" é lido como sobra do alvo | "Sobra até o teto" | P |

### Grupo 6: `src/components/builder/PerformancePanel.tsx`

| id | arquivo:linha | sev. | descrição | correção concreta | tam. |
|---|---|---|---|---|---|
| S-12 (= T-10) | `PerformancePanel.tsx:24-29,55` | baixo | Comentários desatualizados: "O app ainda não tem uma página…" (a `/metodologia` existe) e "TODO(V2-D): a página /montar ainda não passa `references`" (passa, R-02) | Apagar os dois comentários/TODOs | P |

### Grupo 7: `src/services/builder/trust.ts` + `trust.test.ts`

| id | arquivo:linha | sev. | descrição | correção concreta | tam. |
|---|---|---|---|---|---|
| S-14 | `trust.ts:48-88` | baixo (desempenho) | `isTrustedStore` monta os textos dos motivos (`toLocaleString`) só para devolver um boolean: **37 µs por chamada** (sonda: 2.072 chamadas em 76 ms). `getBestOffer`/`flagSuspiciousOffers` chamam 2 a 3 vezes por oferta em `/busca` (um card por peça), `/peca` e `check-alerts`. O cache do B em `auto-build.ts:84-99` resolve só o Montador (20 a 35 ms com 150/cat, inclusive com lojas clonadas: 18 ms) | `isTrustedStore` calcula o boolean direto (bloqueada → false; oficial && nota ≥ 4,5 && !(RA < 6)), sem textos; `storeTrust` reaproveita a mesma função para `trusted`. Teste "isTrustedStore === storeTrust().trusted" num conjunto de lojas. O cache de `auto-build.ts` pode ficar (o Grupo 3 decide; não é obrigatório) | P |

### Grupo 8: `src/app/entrar/page.tsx` + `src/app/auth/actions.ts` + `src/app/auth/actions.test.ts`

| id | arquivo:linha | sev. | descrição | correção concreta | tam. |
|---|---|---|---|---|---|
| S-15 | `entrar/page.tsx:29-30,50-58`; `auth/actions.ts:46,62,65` | baixo (segurança) | Injeção de conteúdo: `/entrar?erro=Sua conta foi bloqueada, ligue para 0800…` mostra qualquer texto num Callout oficial. A `/conta` já evita isso ("a URL nunca carrega texto livre para a tela", `conta/page.tsx:36-41`); a `/entrar` não | Códigos: `traduzErro` devolve uma chave (`credenciais`, `ja-cadastrado`, `senha-curta`, `email-invalido`, `generico`), `signup` manda `?mensagem=conta-criada`, e a página traduz por um mapa; chave desconhecida → nada. Teste das actions | P |

### Grupo 9: `src/app/conta/page.tsx` + `src/components/builder/SaveBuildButton.tsx` + `src/components/builder/BuilderForm.tsx` + `src/components/builder/PaymentPlanner.tsx`

Esses quatro arquivos são de tela do mesmo fluxo (F/G) e só levam ajustes de texto. Juntos, cabem num dono só.

| id | arquivo:linha | sev. | descrição | correção concreta | tam. |
|---|---|---|---|---|---|
| S-11 (= T-8) | `conta/page.tsx` (topo, sem `metadata`) | baixo (WCAG 2.4.2) | `/conta` herda o título genérico | `export const metadata: Metadata = { title: "Minha conta" };` | P |
| (= T-8) | `SaveBuildButton.tsx:138-178` | baixo | Com um alerta de montagem existente, o botão diz "Criar alerta", mas a action troca o valor | Prop `hasAlert`: "Mudar alerta" / "Alerta atualizado" (a `conta/page.tsx` passa `Boolean(alerta)`) | P |
| (= T-4) | `BuilderForm.tsx:49` | baixo | "Quad HD… pede placa de vídeo mais forte" sugere que o Montador escolhe outra placa, mas `resolution` só destaca a coluna | Texto do T-4 | P |
| S-04b | `PaymentPlanner.tsx:142-144` | baixo | Depois de S-04, a dica "Limitado pela loja que parcela em menos vezes" deixa de ser verdade | Usar sempre a frase de faixas ("Cada loja parcela até o máximo dela; se uma termina antes, as últimas parcelas ficam menores.") | P |

### Grupo 10: `src/app/peca/[slug]/page.tsx`

| id | arquivo:linha | sev. | descrição | correção concreta | tam. |
|---|---|---|---|---|---|
| S-13 | `peca/[slug]/page.tsx:142-147` | baixo | `{oferta.price_installment && oferta.installment_count && (…)}`: com `price_installment = 0` o React escreve "0" na tela (resto do LOG-10). `href={oferta.url}` (linha 150) passa a URL crua; o `ButtonLink` limpa, mas o comentário do topo diz "safeHref na peça" | Usar `validInstallmentPrice(oferta) !== null && (oferta.installment_count ?? 0) > 0 ? … : null`, e `href={safeHref(oferta.url)!}` dentro do mesmo teste | P |

### Grupo 11: `src/services/products.ts` + `products.test.ts`

| id | arquivo:linha | sev. | descrição | correção concreta | tam. |
|---|---|---|---|---|---|
| S-17 | `products.ts:248-285` (`getPriceHistory`) | baixo | O "menor preço do dia" junta o histórico de **todas** as ofertas, inclusive de loja bloqueada e das "boas demais". No modo real, o gráfico da /peca mostraria R$ 1.399,90 como mínimo, enquanto o herói diz que o melhor preço é R$ 1.899,90 | Montar `offerIds` só com as ofertas de loja não bloqueada e não suspeitas hoje (`validOffers(product,false)` menos `flagSuspiciousOffers(product)`), com comentário. Teste com o mock | P |

### Grupo 12: `supabase/schema-auth.sql`

| id | arquivo:linha | sev. | descrição | correção concreta | tam. |
|---|---|---|---|---|---|
| S-18 | `schema-auth.sql:34-36` | baixo (segurança) | Os scripts são "re-executáveis". Rodar `schema-auth.sql` de novo depois de `schema-alerts.sql` recria a política fraca de `price_alerts`, sem conferir o dono da `saved_build`, e alguém poderia apontar um alerta para a montagem de outra pessoa (o e-mail revela o total) | Envolver a criação num `do $$ … if not exists (select 1 from pg_policies where tablename='price_alerts' and policyname='alertas do proprio usuario') then create policy … end if; $$`, com o comentário "schema-alerts.sql reforça esta política" | P |

### Grupo 13: `tests/e2e/montar.spec.ts` + `tests/e2e/navegacao.spec.ts`

Rodar por último, depois dos Grupos 2, 3 e 9.

| id | arquivo:linha | sev. | descrição | correção concreta | tam. |
|---|---|---|---|---|---|
| S-16 (= T-11, resto do R-14) | `montar.spec.ts:156-171`; `navegacao.spec.ts:35-40` | médio (teste passa por acaso) | O teste do R-01 é condicional: em 6000/7000 sem filtro o Montador escolhe a RX 7700 XT, então o `if` nunca roda e o teste passaria mesmo se a suspeita voltasse. A /peca não confere herói nem aviso. Não há e2e das faixas | (a) `montar`: com o filtro desligado, `expect(pecas.getByText(/1\.399,90/)).toHaveCount(0)` sem `if`; (b) `/peca/rtx-4060`: o herói mostra "R$ 1.899,90" e "Preço bom demais?" aparece na lista; (c) parcelado 6000/7000: depois do S-03 abre em 10x "sem acréscimo" e "Total parcelado" = a prazo | P |

### Grupo 14: `src/components/ui/Field.tsx` + `src/components/StoreBadge.tsx` + `src/components/ProductCard.tsx`

| id | arquivo:linha | sev. | descrição | correção concreta | tam. |
|---|---|---|---|---|---|
| S-20 | `Field.tsx:41` | baixo (a11y) | O erro tem `role="alert"` e é calculado a cada tecla (`BuilderForm.tsx:131-136`): apagar o campo para redigitar dispara "Informe um valor maior que zero." no leitor de tela no meio da digitação | Trocar por `aria-live="polite"` (o `aria-describedby` já liga o erro ao campo) | P |
| S-21 | `StoreBadge.tsx:62` | baixo (pt-BR) | A nota aparece como "4.8" (`toFixed`), e os motivos ao lado dizem "Nota 4,8" | `nota.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })` | P |
| S-22 | `ProductCard.tsx:36` | baixo (honestidade) | "menor preço no Pix" aparece quando existe uma oferta mais barata (a suspeita) que foi pulada | "melhor preço no Pix" (mesma palavra do herói da /peca) | P |

### Grupo 15: `docs/superpowers/specs/2026-11-04-montador-de-pc-design.md`

| id | arquivo:linha | sev. | descrição | correção concreta | tam. |
|---|---|---|---|---|---|
| S-23 | spec §5.3 (l. 103-120), §5.4 (l. 122-130), §7 (l. 166-168) | baixo (docs) | §5.3 ainda descreve escolha uma a uma (o código escolhe o **par** processador + placa-mãe e tem o planejador exato) e não traz o ajuste por perfil (`scoring.ts:56-60`). §5.4 cita a nota "Usou R$ X da folga para subir de A para B" (o texto real é "Subimos a placa de vídeo: A → B, por mais R$ X"). §7 l. 168 diz "parcela = soma por loja de pixTotal × fator(n)", o que contradiz o piso a prazo descrito duas linhas acima | Atualizar as três seções; incluir S-02, S-03 e S-04 se entrarem | P |

### Grupo 16: `docs/diagramas/*.md`

Pode ir para a etapa "gráficos de usabilidade + diagramas", que vem depois desta rodada.

| id | arquivo:linha | sev. | descrição | correção concreta | tam. |
|---|---|---|---|---|---|
| S-19 | `README.md:50-56`; `arquitetura.md:50,131-133,172`; `fluxo-montador.md:77-81`; `fluxo-pagamento.md:22,85,101,148,187`; `fluxo-dados.md:235` | médio (docs) | Os diagramas dizem que B, F e G "ainda não existem", que `/montar` usa `PART_SPECS` do mock, que "Misturar" está escondida, que o total em n parcelas é "pix × fator" e que o alerta da montagem inteira não existe. Hoje é tudo falso | Trocar as caixas `v2`/`v2pronto` dessas features por "no ar", reescrever a tabela de status do README dos diagramas e a linha "Total em n parcelas = max(a prazo, pix × fator)" | M |

### Grupo 17: `docs/METODOLOGIA-DESEMPENHO.md`

| id | arquivo:linha | sev. | descrição | correção concreta | tam. |
|---|---|---|---|---|---|
| S-24 (= T-7) | `METODOLOGIA-DESEMPENHO.md:27,31,73+` | baixo | O renderizador da `/metodologia` não entende itálico: `*estima*` aparece com asteriscos. A seção "Onde isso está no código" e a frase do `measuredAt` são texto de desenvolvedor numa página pública | Este grupo edita **só o .md**. Trocar `*estima*` por texto simples (ou `**estima**`). Apagar a frase do `measuredAt` e a seção "## 7. Onde isso está no código": os mesmos apontamentos já estão nos comentários de `performance.ts` e `references.ts`. Não usar comentário HTML: o renderizador mínimo da `/metodologia` o mostraria como parágrafo | P |

### Grupo 18 (opcional): `src/services/builder/compatibility.ts`

| id | arquivo:linha | sev. | descrição | correção concreta | tam. |
|---|---|---|---|---|---|
| S-25 | `compatibility.ts:32` | baixo | `hasRequiredSpec` aceita `perf = 0` para placa-mãe, memória, gabinete e fonte, enquanto `specs.ts:126-127` e `collect-specs.mjs` exigem `perf > 0` em todas, e os três comentários dizem "MESMA lista". Inofensivo hoje (o mock tem perf > 0 em tudo) | `spec.perf > 0` para todas as categorias, ou ajustar os comentários. Teste | P |

**Resumo:** 1 alto (S-01), 6 médios (S-02, S-03, S-04, S-07, S-16, S-19), o resto baixo. Só S-03 e S-19 são M. Ordem
sugerida: Grupo 1 → Grupo 2 → Grupo 3 → Grupos 4 a 12 e 14 a 18 em paralelo → Grupo 13 por último (depende de 2, 3 e 9).

## Riscos restantes

1. **S-03 mexe no número que a tela mostra por padrão.** Com o S-03, o demo 6000/7000 passa a abrir em 10x e não em 6x, e
   `payments.test.ts`, `mixed-plan.test.ts` e o e2e de parcelado mudam juntos. Rodar `npx playwright test` depois.
2. **S-04 muda a regra documentada da V1** (spec §7, "menor `installment_count`"). Isso precisa de uma decisão do Comandante:
   o item foi marcado médio porque o modo real começa **sem** tabelas e cai exatamente nessa regra.
3. **S-07 deixa "PCs parecidos" vazio no modo real** até alguém rodar o `seed-references.sql`. É o comportamento que o
   AGENTS.md pede, mas a mensagem de `NOTA_SEM_REFERENCIAS` deve continuar clara para o leigo.
4. **SEG-06** (`await registerView` na /peca), **DAD-01**, **PERF-02/03/04** e o `TODO(V2-B)` da otimização global continuam
   adiados. Não quebram invariantes.
5. **Desempenho fora do Montador:** sem o S-14, a `/busca` com catálogo real (centenas de peças × 3 ofertas) gasta perto de
   0,1 s de CPU por requisição só em `isTrustedStore`.
6. **Dados de demonstração:** os quatro seeds têm o cabeçalho "SÓ PARA DEMONSTRAÇÃO", mas nada impede que alguém os rode
   em produção. O README avisa (`README.md:85-86`). Aceito.
7. **Scratchpad compartilhado:** os agentes paralelos escrevem nos mesmos nomes de arquivo (`tsc.log` foi sobrescrito por
   outro agente durante este portão). Meus logs ficaram em `rigoroso2/`. Para as próximas ondas, cada agente deve ter o
   seu subdiretório.
8. Este arquivo está fora do controle de versão; o Comandante faz o commit.
