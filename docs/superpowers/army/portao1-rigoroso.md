# Portão 1: veredito do Gerente Rigoroso (onda 1)

- Data: 2026-11-04. Diff revisado: `git diff e709af0..HEAD` (HEAD = `8b69a4d`), 54 arquivos, +4.619/−190.
- Somente leitura: este é o único arquivo criado. Nenhum git que muda estado. O `next dev` foi encerrado ao fim dos e2e.
- Método: leitura linha a linha do diff de A, C, D, E, H e Diagramas; todas as verificações rodadas; uma sonda Vitest
  (fora do repositório, no scratchpad) rodou `autoBuild`, `buildPaymentSummary` com as tabelas mock, `installmentPlan`,
  `mixedPlan` e `estimatePerformance` sobre o catálogo de demonstração, com 4 orçamentos e o filtro de lojas ligado e desligado.
  Os números citados abaixo vêm dessa sonda.

## Veredito

**APROVADA COM CORREÇÕES.**

Motivos:

1. Tudo o que foi relatado existe, compila, tem testes de comportamento de verdade (não só de mocks) e passa: tsc, lint,
   136 testes no Vitest, build e e2e (11 passam, 1 ignorado de propósito). Não há bloqueador: nenhuma invariante do
   Montador quebrou. `total ≤ teto` continua valendo em todos os cenários da sonda, o filtro "só lojas confiáveis"
   continua excluindo a marketplace e a compatibilidade não foi mexida.
2. Há **dois achados altos novos**, que precisam entrar na onda 2 antes de qualquer feature nova:
   - **R-01:** a oferta "boa demais" (marketplace a R$ 1.399,90) é o **"Melhor preço agora"** no topo de `/peca/rtx-4060`
     e é **escolhida em silêncio pelo Montador** quando o filtro de lojas está desligado. A tela da peça avisa no meio da
     lista e anuncia o mesmo preço como herói no topo. A metade "Montador" do C3 não foi feita: `Candidate.suspicious`
     existe, mas ninguém o preenche.
   - **R-02:** nenhum dos três serviços novos com fallback (`getPartSpecs`, `getReferenceBuilds`, `getInstallmentTables`)
     é chamado pelo app. `autoBuild` monta o pagamento sem tabelas de juros e a estimativa com as referências do mock, e a
     aba "Misturar" está escondida. Com o Supabase configurado, nada de A, D e E chega à tela. É uma pendência conhecida
     (arquivos reservados ao Comandante e a F), mas é o maior risco da onda 2 e precisa de um dono.
3. Os achados médios de dinheiro (R-03 a R-06) não violam o teto, mas mostram à pessoa números que ela vai ler errado:
   "12x de R$ 586,17" quando 12 × 586,17 ≠ total; uma economia no Pix inflada; o plano misto parcelando justo a peça com
   juros de 15%; e "1500.50" lido como R$ 150.050.

## Conclusões-fantasma

| Pacote | Relatado | Conferido no diff/arquivos | Divergência |
|---|---|---|---|
| A | `specs.ts` (+7 testes), part-specs com `capacityGb`/`upscaling`/`source`, SQL, `collect-specs.mjs` + `specs-catalogo.json`, `COLETA-SPECS.md` | Tudo existe; 7 testes (4 de `getPartSpecs` e 3 de `rowToPartSpec`) que testam fallback, mapeamento e join vazio; o JSON bate com `part-specs.ts` nas 20 peças (conferido por script); `alter table … add column if not exists` está presente | **Parcial.** O critério de aceite "peça sem spec gera nota" não foi feito (LOG-04), e A1 passo 4 (ligar na página) ficou para F (LOG-09/R-02). O TODO de validar a categoria ficou aberto (LOG-03). Isso foi declarado, então não é fantasma, mas o pacote não está "pronto". |
| C | `storeTrust` com motivos, `validOffers` ignora preço ≤ 0, `suspicious.ts` (11 testes), StoreBadge, página da peça, mock e SQL | Tudo existe; 11 testes em `suspicious.test.ts` (7 + 4), 8 novos em `trust.test.ts`, todos de comportamento | **Sim, no C3:** o plano pede o aviso também no Montador com o filtro desligado. `Candidate.suspicious` (builder-types.ts:66) nunca é preenchido, e `buildCandidates` não chama `flagSuspiciousOffers`. O relatório não dizia que tinha feito isso, mas também não deixou a lacuna explícita. Ver R-01. |
| D | 12 referências com fonte e data, `references.ts` (+8 testes), `closestReferences`, penalidade de 16 GB, nota de upscaling, painel "PCs parecidos", gráfico | Tudo existe; os 12 scores batem com `round(0,7·GPU+0,3·CPU)` (conferidos à mão); 8 testes em `references.test.ts` | Não. A dupla contagem que o próprio D sinalizou está **confirmada** (R-07). A nota de upscaling aparece em toda montagem e fala em DLSS também para placas AMD (R-08). |
| E | Juros por loja, `installmentPlan` por loja, `mixedPlan`, `coupons.ts`, PaymentPlanner com Misturar, SQL | Tudo existe e tem testes bons; a sonda confirma a aritmética | **Inerte na tela** (declarado): as tabelas não chegam a `autoBuild`, a aba Misturar está escondida e os cupons não têm UI (E3 era opcional). Ver R-02. |
| H | Config do Playwright com fallback, 11 e2e + 1 ignorado, `ci.yml`, `coleta.yml`, monitor (>30% → exit 2 → issue) | Confirmado ao rodar (11 passam, 1 ignorado). O workflow está correto: `npm ci` com o lock coerente (`@playwright/test@1.61.0` está no lock e instalado), `playwright install --with-deps` vem antes do e2e, e `npm run typecheck` (`next typegen && tsc`) roda localmente com exit 0 | Não. Há ajustes (R-13 e R-14) e PERF-06 continua aberto (gravação no banco sem checar o erro). |
| Diagramas | `docs/diagramas/*` | 7 arquivos; dizem com honestidade o que está "pronto, não ligado" (por exemplo fluxo-pagamento.md:21-22, arquitetura.md:131-133) | Não. |
| Comandante | `ram_gb`, comentário de `maxInstallments`, spec §7, oferta mock a R$ 1.399,90, README | Tudo presente | A oferta mock **acionou R-01**: era o objetivo, mas expôs que o herói da peça e o Montador não respeitam o aviso. |

Testes que passam "por acaso": nenhum encontrado. Dois testes **fixam semânticas discutíveis** e vão ter de mudar junto com
as correções: `payments.test.ts`, "mistura de lojas" (espera `12x de 195` com total 2010, ou seja, 12 × 195 ≠ 2010, ver R-03),
e `performance.test.ts`, "16 GB tira 8%" (fixa a dupla contagem de R-07).

## Verificação

| Comando | Resultado | Resumo |
|---|---|---|
| `npx tsc --noEmit` | **PASS** | exit 0 (e `npm run typecheck`, que inclui `next typegen`, também passa) |
| `npm run lint` | **PASS** | eslint exit 0, sem avisos |
| `npx vitest run` | **PASS** | 13 arquivos, 136/136 testes, 1,7 s |
| `npm run build` | **PASS** | Next 16.2.9 (Turbopack): compilou em 11,8 s, TypeScript ok, 9 páginas; `/montar` e `/peca/[slug]` dinâmicas, `/` estática |
| `npx playwright test` | **PASS** | 12 testes em 2 projetos (desktop e celular): 11 passam, 1 ignorado de propósito (overflow só no celular), 32 s; `next dev` encerrado depois |

## Problemas encontrados

Achados novos desta revisão (R-xx). Os das trufas estão na triagem mais abaixo. "Correções-X" é um agente de correção
sobre os arquivos do pacote X, que não volta na onda 2.

| id | arquivo:linha | sev. | descrição | correção concreta | pacote/onda | tam. | modelo |
|---|---|---|---|---|---|---|---|
| R-01 | `src/lib/format.ts:20-26` (`getBestOffer`); `src/app/peca/[slug]/page.tsx:33,52-63`; `src/services/builder/auto-build.ts:53-66` (`buildCandidates`); `src/models/builder-types.ts:66`; `src/app/api/check-alerts/route.ts:57-59` | **alto** | A oferta suspeita (marketplace, R$ 1.399,90, 27% abaixo da mediana confiável de R$ 1.914,90) é o "Melhor preço agora (Pix)" no herói de `/peca/rtx-4060` e o `currentPrice` do botão de alerta, enquanto a lista logo abaixo diz "Preço bom demais?". No Montador com o filtro desligado (6000/7000, 5000/5000, 4500/6000) a placa de vídeo sai da marketplace sem nota nem aviso. `check-alerts` também dispararia o e-mail "caiu para R$ 1.399,90". Fere a promessa anti-golpe (PRODUCT.md, diferencial 1). | (1) `buildCandidates` chama `flagSuspiciousOffers(product)` e preenche `Candidate.suspicious`; (2) decidir a regra: ou a oferta suspeita não é a "mais barata" do candidato (preferir a mais barata não suspeita), ou entra com nota "Preço bom demais na loja X: confira antes de pagar". Recomendo excluir por padrão e explicar na nota; (3) `BuildSummary` mostra um `Callout warn` por peça suspeita; (4) `getBestOffer` ignora as suspeitas (ou o herói mostra o aviso junto); (5) `check-alerts` usa o mesmo helper. Testes: "com trustedOnly=false a oferta suspeita não vira candidata/ganha nota" e "getBestOffer pula a suspeita". | B (auto-build) + F (BuildSummary) + Correções-C (format, peca, helper) + G (route) · onda 2 | M | Opus |
| R-02 | `src/services/builder/auto-build.ts:301,313`; `src/components/builder/BuilderForm.tsx:67`; `src/components/builder/BuildResultView.tsx:52-53`; `src/app/montar/page.tsx` | **alto** | `getPartSpecs`, `getReferenceBuilds` e `getInstallmentTables` não são chamados em nenhum lugar de `src/app`. `autoBuild` faz `buildPaymentSummary(buildParts)` sem tabelas e `estimatePerformance(buildParts)` com as referências do mock. `PaymentPlanner` não recebe `parts`, então a aba Misturar some. Se F ligar só `references` no painel, o "Equivale a" (calculado com o mock dentro de `autoBuild`) e os "PCs parecidos" (do banco) vão divergir. | `montar/page.tsx` faz `Promise.all([getProducts(), getPartSpecs(), getReferenceBuilds(), getInstallmentTables()])` e passa tudo ao `BuilderForm`. `autoBuild(products, specs, prefs, ctx?: { references?, installmentTables? })` usa `ctx` em `estimatePerformance` e em `buildPaymentSummary`. `BuildResultView` passa `parts` e `references`. Teste: com `ctx` as notas e o pagamento mudam; e2e "Misturar" visível. | F (página, form, view) + B (assinatura de `autoBuild`) · onda 2 | M | Opus |
| R-03 | `src/components/builder/PaymentPlanner.tsx:88-90`; `src/services/builder/payments.ts:146-151` | médio | Com as tabelas, a manchete diz "12x de R$ 586,17" e o total é R$ 6.964,79 (demo 6000/7000), mas 12 × 586,17 = R$ 7.034,04, porque a Terabyte para em 10x. O aviso existe, mas em `text-xs`, ao lado do seletor. Pergunta do Comandante: uma loja em 12x e outra em 6x. A pessoa vê "12x de (A/12 + B/6)", que só vale nos 6 primeiros meses; os outros 6 são menores. A tabela por loja mostra "6x de …" para B. A regra (máximo = MAIOR) é razoável; a **manchete** não é. Também falta distribuir os centavos (`round2(total/n)·n ≠ total`). Reforça LOG-11. | `installmentPlan` devolve `schedule: { count, monthly }[]` (faixas iguais). A tela mostra "10x de R$ 586,17 + 2x de R$ 551,49" quando há mais de uma faixa, e "Total parcelado" logo abaixo. Ajustar o resto dos centavos na 1ª parcela por loja. Atualizar o teste "mistura de lojas". | Correções-E · onda 2 | M | Sonnet |
| R-04 | `src/services/builder/payments.ts:116-128,141`; `PaymentPlanner.tsx:77-80` | médio | Com tabela, `installmentTotal` é o preço no **máximo** de parcelas (12x com +6% na Kabum), e `pixSavings` compara com ele. Demo 6000/7000: "Você economiza R$ 115,49 em relação ao parcelado", mas em 10x sem juros o acréscimo total é só R$ 16,50. A economia do Pix fica inflada. | Definir `pixSavings` contra o parcelado **mais barato** com n > 1 (ou dizer na tela "em relação a 12x"). Teste com a tabela Kabum 10x/1,00 e 12x/1,06. | Correções-E · onda 2 | P | Sonnet |
| R-05 | `src/components/builder/PaymentPlanner.tsx:23-27` (`lerReais`) | médio | Instância nova do LOG-01 criada na onda 1: "1500.50" em "Tenho à vista" vira R$ 150.050, e o plano misto põe tudo no Pix. | Um único `parseMoney` em `src/lib/money.ts` (F1), usado pelo `BuilderForm` e pelo `PaymentPlanner`; teste "1500.50" → erro ou 1500,5, conforme a regra que F1 decidir. | F (F1) + Correções-E · onda 2 | P | Sonnet |
| R-06 | `src/services/builder/mixed-plan.ts:56-68` | médio | O plano misto escolhe as peças do Pix pelo preço, ignorando o juro da loja. Demo 8000/9000 sem filtro: parcela a RTX 4070 SUPER da marketplace (+15%) e põe no Pix peças de lojas sem juros, com acréscimo de R$ 662,97 e "não cabe". O comentário da linha 8 ("desconto é proporcional") só vale sem tabela. | Ordenar pelo custo evitado, `price_pix × (fator_da_loja(n_max) − 1)`, com desempate por preço. Teste: peça de loja +15% vai ao Pix antes de uma mais cara sem juros. | Correções-E · onda 2 | M | Opus |
| R-07 | `src/services/builder/performance.ts:110-116` | médio | Dupla contagem de RAM confirmada. As referências de 80 a 110 já têm 16 GB, e a penalidade de −8% é aplicada de novo. Uma montagem idêntica ao "PC de entrada" (RTX 4060 + R5 7600 + 16 GB) mostra 48 fps em AAA pesado 1080p, enquanto a referência a que ela "equivale" mostra 52. | Penalizar só a diferença: se `ramGb < ram` das referências vizinhas usadas na interpolação, aplicar o fator; se ≥, nada. Teste "montagem igual à referência devolve os FPS da referência". Atualizar o teste atual. | Correções-D · onda 2 | P | Sonnet |
| R-08 | `src/services/builder/performance.ts:85,119`; `PerformancePanel.tsx:61-65` | baixo | A nota de upscaling aparece em toda montagem (toda GPU tem FSR) e diz "DLSS/FSR" também para RX 6600/7600/7700 XT, que não têm DLSS. | Texto montado a partir de `spec.upscaling` ("Com FSR, …"), e exibido como linha informativa, não como Callout repetido. | Correções-D · onda 2 | P | Sonnet |
| R-09 | `src/models/reference-builds.ts:7-35,37-41`; `supabase/seed-references.sql`; `PerformancePanel.tsx:25-29,84` | médio | Honestidade das fontes. A string `source`, mostrada como "Fonte: …" em cada card, atribui os índices a agregados públicos, mas os índices marcados com * (RX 6600, RX 7600, RTX 4060/Ti, RX 7700 XT, 4070 SUPER, i5-14400F, R5 7600) vêm de `part-specs.ts`, que se declara "ilustrativo (V1)". A base de FPS do "PC de entrada" não tem fonte. O checkfps.io existe, mas é ele mesmo um estimador ("own FPS engine"), e a página consultada é de jun/2026, não de "out/2026". O campo se chama `measuredAt`, mas nada foi medido. A tela diz "Estimativa" no título da seção (ok), mas "Fonte:" longo e técnico em três cards confunde leigos. | Reescrever `source`: "Estimativa GarimpoPC: índices de referência (parte ilustrativa) + agregados públicos (checkfps.io, Tom's Hardware), out/2026". Na tela, "Base: estimativa · out/2026", com link para uma nota de metodologia. Renomear `measuredAt` para `referenceMonth` (ou documentar). Não citar mês que a fonte não tem. | Correções-D · onda 2 | P | Sonnet |
| R-10 | `supabase/seed-builder.sql` (bloco `insert into public.reference_builds`, linhas ~71-85); `supabase/seed-references.sql:11-12` | médio | `seed-builder.sql` ainda grava as 6 referências antigas (avançado = 150, entusiasta = 199, intermediário forte = R$ 7.200) com `on conflict do update`. Rodar o seed-builder depois do seed-references (por exemplo, para atualizar specs, como o COLETA-SPECS.md sugere) volta score e FPS ao V1 e mantém a `source` nova: dado antigo com fonte nova. O TODO de seed-references.sql:12 está velho (o `ram_gb` já está no schema). | Apagar o bloco de referências de `seed-builder.sql` (o `seed-references.sql` é a fonte); apagar o TODO. | Correções-D · onda 2 (sem conflito: G mexe só em `schema-builder.sql`) | P | Sonnet |
| R-11 | `src/services/builder/trust.ts:83-87`; `src/app/peca/[slug]/page.tsx:110-115` | médio | Loja `blocked` ("bloqueada por denúncias") continua elegível no Montador com o filtro desligado, e a página da peça mostra "Ver na loja" para ela. | `validOffers` exclui `blocked` sempre, independente de `trustedOnly`; na página, sem botão e com Badge "Bloqueada". Teste. | Correções-C · onda 2 | P | Sonnet |
| R-12 | `src/services/builder/trust.ts:27-29,54`; comparar com `specs.ts:19`, `installments.ts:19`, `references.ts:13` | baixo | Três serviços assumem que `numeric` pode chegar como texto, mas `storeTrust` exige `typeof === "number"` para `reclame_aqui_score numeric(3,1)`. Se vier texto, a regra "Reclame Aqui < 6 derruba a loja" é pulada em silêncio. Na prática o PostgREST costuma devolver número, mas o código é incoerente consigo mesmo. | Normalizar `rating`, `reclame_aqui_score` e `years_active` com `Number()` ao ler lojas (`products.ts`), com teste. | Correções-C/Comandante · onda 2 | P | Sonnet |
| R-13 | `playwright.config.ts:55-60`; `.github/workflows/ci.yml:10-12,52-56` | baixo | No CI o e2e roda contra `next dev` depois do build: não testa o artefato construído e é sujeito a lentidão de compilação. `reuseExistingServer: true` também vale no CI. `on: push` + `pull_request` duplica as execuções em PR. | No CI, `webServer.command = "npx next start -p 3100"` (com o build do passo anterior), `reuseExistingServer: !process.env.CI`; `push` só em `main`. | Correções-H · onda 2 | P | Sonnet |
| R-14 | `tests/e2e/*` | baixo | Não há e2e para o filtro desligado nem para o aviso de preço suspeito, "Por que confiável" ou os valores do parcelado. São os pontos de R-01, R-03 e R-11. | Acrescentar: `/peca/rtx-4060` mostra "Preço bom demais?" e o herói não é a marketplace; `/montar` com o filtro desligado mostra o aviso; parcelado com faixas. | Correções-H (depois de F e B) · onda 2 | P | Sonnet |
| R-15 | `docs/COLETA-SPECS.md` (comentário TODO após o bloco bash); `src/services/specs.ts:43`; `src/models/part-specs.ts:8-13` | baixo | Documentação velha: o TODO "quando o script entrar no package.json" já foi resolvido (`collect:specs` existe). | Trocar pelo `npm run collect:specs`. | Correções-A · onda 2 | P | Sonnet |
| R-16 | `src/services/builder/auto-build.ts:158` | baixo | As notas do guloso saem "Nenhuma opção de memória ram coube na fatia prevista (R$ 0,00)": "memória ram" repete a ideia e "fatia de R$ 0,00" não diz nada ao leigo. Aparece seis vezes seguidas em 5000/5000. | Agrupar as notas em uma ("Para caber, usamos as opções mais baratas em: memória, armazenamento, gabinete e fonte") e usar `categoryLabel`. | B · onda 2 | P | Sonnet |
| R-17 | `src/services/builder/auto-build.ts:284-293` | baixo | Com duas trocas (GPU e CPU), cada nota diz "Usou R$ X da folga", e X é o excedente **total**, repetido nas duas. | Um valor por troca (diferença de preço) e o total numa nota só. | B · onda 2 | P | Sonnet |
| R-18 | `src/components/builder/PerformanceChart.tsx:13-21` | baixo | Terceiro tom de série (`parecido: #8b8e99`) fora da regra de dataviz do DESIGN.md (ênfase `brand` + contexto `#626877`); os hex estão duplicados (CON-10). | Documentar o tom "relacionado" no DESIGN.md ou usar contorno no lugar de outra cor; ler os tokens de um módulo só. | Correções-D + Comandante (DESIGN.md) · onda 2 | P | Sonnet |
| R-19 | `scripts/collect-specs.mjs:52-77` (`validar`) | baixo | O validador aceita CPU sem `socket`, placa-mãe sem `ramType`/`formFactor`, fonte sem `wattage`. É a porta de entrada do LOG-02. | Campos obrigatórios por categoria (mesma lista que `rowToPartSpec` vai exigir). | Correções-A · onda 2 | P | Sonnet |

Notas de revisão sem achado:

- **Invariantes:** C e E não tocaram em `auto-build.ts`, `compatibility.ts` nem `budget.ts`. `validOffers` agora filtra preço
  ≤ 0, o que só reduz candidatos. A sonda confirmou `totalPix ≤ hardCap` em 8/8 cenários, e com `trustedOnly` nenhuma peça veio
  da marketplace.
- **Segurança dos SQL novos:** `store_installments` tem RLS com leitura pública e sem escrita (ok). `schema-stores.sql` só
  acrescenta colunas a `stores`, que já tem RLS (ok); os CHECK de faixa estão corretos. Os scripts com service_role
  (`collect-specs.mjs`, `collect-prices.mjs`) leem a chave do ambiente, não a imprimem e não estão no bundle. Em
  `coleta.yml`, `permissions` é mínima (`contents: read`, `issues: write`), os segredos vão por `env` e `inputs.simulacao` é
  booleano, sem injeção de shell. `check-alerts` não foi tocado na onda 1 (SEG-01 e SEG-02 continuam abertos, com G).
- **Fallback mock × Supabase:** está coerente com o que cada arquivo documenta, mas as regras são diferentes entre si
  (specs/referências: erro → mock; juros: erro → vazio). A justificativa de E (não pôr juros ilustrativos sobre ofertas reais)
  também vale para specs: com banco real, erro → `PART_SPECS` ilustrativo aplicado a produtos reais. Ver DAD-03, que deve
  virar regra no AGENTS.md.
- **DESIGN.md:** os arquivos novos usam só `ui/` (Card, Callout, Badge, Field, SectionTitle, Button), tokens e lucide
  (traço 1.75 na página da peça). Não há emoji como ícone nem texto em gradiente na UI nova. Os emojis nos `console.log` dos
  scripts não são UI.
- **pt-BR:** o texto está bom e acessível em geral. Exceções: R-09 ("Fonte:" técnico), R-16 e "aaa-medio/aaa-pesado" (só
  internamente; a tela usa os rótulos).

## Triagem das trufas

Resultado: **68 confirmados, 0 refutados, 1 rebaixado** (LOG-15). Dois foram **agravados** pela onda 1: LOG-18 (agora com a
oferta suspeita, ver R-01) e LOG-17 (ver a observação na tabela). A11Y-11 foi corrigido em parte (o StoreBadge ganhou texto
sr-only; no toque ainda depende de `title`). Os números de linha foram conferidos em `8b69a4d`.

| id | confirmado? | sev. final | pacote (onda 2) | observação |
|---|---|---|---|---|
| SEG-01 | sim (route.ts:20) | alto | G | `.env.example` deixa `CRON_SECRET` vazio |
| SEG-02 | sim (email.ts:15) | alto | G | |
| SEG-03 | sim (email.ts:37-44) | médio | G | |
| SEG-04 | sim (Button.tsx:71) | médio | F (ui/Button) | `urlSegura` num helper só |
| SEG-05 | sim (products.ts:58-63) | médio | Comandante | |
| SEG-06 | sim (peca/page.tsx:30 `await registerView`) | médio | Comandante | |
| SEG-07 | sim (next.config.ts) | médio | Comandante | |
| SEG-08 | sim | baixo | Comandante | |
| SEG-09 | sim | baixo | Comandante | |
| SEG-10 | sim (actions.ts:21) | baixo | G | |
| SEG-11 | sim (actions.ts:49) | baixo | G | |
| LOG-01 | sim (BuilderForm.tsx:23-27) | alto | F (F1) | mais uma instância em R-05 |
| LOG-02 | sim (compatibility.ts:33-41) | alto | B + Correções-A | vira real assim que R-02 ligar o banco; R-19 |
| LOG-03 | sim (auto-build.ts:64; specs.ts:43-44) | médio | Correções-A (`rowToPartSpec`) + B | |
| LOG-04 | sim (auto-build.ts:61) | médio | B | critério de aceite de A |
| LOG-05 | sim (auto-build.ts:310) | médio | B | sonda: 4500/6000 sem troca → `usedWiggleRoom: true` |
| LOG-06 | sim (auto-build.ts:205, 285) | médio | B | |
| LOG-07 | sim (auto-build.ts:96) | médio | B | estimativa, ver B1 |
| LOG-08 | sim | médio | F (F1) | |
| LOG-09 | sim | médio → incorporado em R-02 (alto) | F + B | |
| LOG-10 | sim (payments.ts:84) | médio | Correções-E | |
| LOG-11 | sim | médio | Correções-E | detalhado em R-03 |
| LOG-12 | sim | médio | Correções-E (teto de 24x ao ler) | |
| LOG-13 | sim (coupons.ts:44; products.ts:123) | baixo | Correções-E + Comandante | |
| LOG-14 | sim (`references.ts:62` não valida score) | médio | Correções-D | |
| LOG-15 | em parte: `getReferenceBuilds` nunca devolve lista vazia | **baixo** (rebaixado) | Correções-D | a guarda em `estimatePerformance` continua faltando |
| LOG-16 | sim (specs.ts:45) | médio | Correções-A | |
| LOG-17 | sim e **agravado**: loja não oficial com nota ≥ 4,5 mostra "Muito confiável" ao lado de "Por que não marcamos como confiável" | médio | Correções-C (format.ts `trustLabel`, StoreBadge `tomDaNota`) | |
| LOG-18 | sim e **agravado** (ver R-01) | médio | Correções-C (helper) + G (route) | |
| DAD-01 | sim | médio | Comandante | |
| DAD-02 | sim | médio | Comandante + Correções-H | |
| DAD-03 | sim | médio | Comandante (regra no AGENTS.md) | |
| DAD-04 | sim | médio | G | |
| DAD-05 | sim (conta/page.tsx:28) | médio | G | |
| A11Y-01 | sim (layout.tsx:23-26) | alto | Comandante | |
| A11Y-02 | sim (só montar/page.tsx exporta título; o layout tem template) | alto | Comandante | |
| A11Y-03 | sim (Field.tsx) | médio | F (F4) | |
| A11Y-04 | sim (BuilderForm.tsx:125) | médio | F (F4) | |
| A11Y-05 | sim | médio | Correções-D + Comandante (PriceHistoryChart) | a tabela de FPS é visível; a de referências fica num `<details>` |
| A11Y-06 | sim | baixo | F | |
| A11Y-07 | sim (0 `scope` nas duas tabelas) | baixo | Correções-E (PaymentPlanner) + Correções-D (Panel) | |
| A11Y-08 | sim | baixo | F | |
| A11Y-09 | sim | baixo | Comandante | |
| A11Y-10 | sim (conta/page.tsx:77) | baixo | G | |
| A11Y-11 | em parte (sr-only adicionado em StoreBadge.tsx:52) | baixo | Correções-C | |
| A11Y-12 | sim | baixo | F | |
| PERF-01 | sim | médio | F | |
| PERF-02 | sim (com Supabase) | médio | Comandante | |
| PERF-03 | sim | médio | Comandante | |
| PERF-04 | sim | médio | Comandante | |
| PERF-05 | sim (`waitForTimeout(3500)` ×3 + 4 s) | médio | Correções-H | |
| PERF-06 | sim (collect-prices.mjs:175-176) | médio | Correções-H | o monitor novo conta isso como sucesso |
| PERF-07 | sim | baixo | F | |
| PERF-08 | sim | baixo | Comandante | `npm ci` instala as dev, então a coleta continua funcionando |
| CON-01 | sim | médio | G | |
| CON-02 | sim (`.emoji` não é lido) | baixo | Comandante | |
| CON-03 | sim (SiteHeader.tsx:45) | baixo | Comandante | |
| CON-04 | sim | médio | Comandante (antes de A4) | |
| CON-05 | sim | baixo | Comandante | |
| CON-06 | sim | baixo | Comandante (decisão) | |
| CON-07 | sim | baixo | Comandante | |
| CON-08 | sim (Field.tsx:21) | baixo | F | |
| CON-09 | sim | baixo | F / G / Comandante | |
| CON-10 | sim | baixo | Correções-D + Comandante | ver R-18 |
| TST-01 | sim | médio | Correções-E | |
| TST-02 | sim | médio | Correções-D | |
| TST-03 | sim | médio | B | |
| TST-04 | sim | baixo | F (F1) | |

## Riscos para a onda 2

Conflitos de arquivo entre B, F, G e as correções, com o dono sugerido para cada um:

| Arquivo | Quem quer mexer | Risco | Proposta |
|---|---|---|---|
| `src/services/builder/auto-build.ts` | B (B1-B3), R-01 (suspicious), R-02 (`ctx`), LOG-03 a LOG-07, R-16, R-17, TST-03 | Alto: é o arquivo mais disputado | **Dono único: B.** As correções de A, C e D entram como interface (o `flagSuspiciousOffers` de C, o `rowToPartSpec` validado de A), nunca como edição direta |
| `src/models/builder-types.ts` | B (`usage`, `resolution`), G (`recorded_at`), R-02 (`ctx`), R-03 (`schedule`) | Médio | Comandante aplica todos os campos opcionais **antes** da onda 2 (como fez com e709af0) |
| `src/app/montar/page.tsx`, `BuilderForm.tsx`, `BuildResultView.tsx`, `BuildSummary.tsx` | F, G ("Salvar montagem"), R-01 (aviso), R-02 (ligação) | Alto (F × G em `BuildResultView`) | **F é dono.** G entrega um componente `SaveBuildButton` isolado, e F o encaixa |
| `src/components/builder/PaymentPlanner.tsx` + `payments.ts` + `mixed-plan.ts` | Correções-E (R-03 a R-06, LOG-10 a LOG-12, A11Y-07), F (`parts`), B (chamar `buildPaymentSummary(parts, tables)`) | Médio | Correções-E é dono; a assinatura `buildPaymentSummary(parts, tables?)` fica congelada; F só passa props |
| `src/lib/format.ts` (`getBestOffer`, `trustLabel`) + `trust.ts` + `suspicious.ts` | Correções-C (LOG-17, R-01, R-11, R-12), Comandante (LOG-18), B (consome `suspicious`) | Médio | Correções-C é dono e entrega primeiro o helper `ofertaValida/ofertaSuspeita`; B o consome depois |
| `src/services/builder/performance.ts` + `PerformancePanel.tsx` + `PerformanceChart.tsx` | Correções-D (R-07 a R-09, LOG-14/15, A11Y-05), B (passa `refs`), F (resolução-alvo, F3) | Médio | Correções-D é dono; a assinatura `estimatePerformance(parts, refs)` fica estável |
| `supabase/schema-builder.sql` / `seed-builder.sql` | G (`saved_builds`, `price_alerts.saved_build_id`), Correções-A (constraints), Correções-D (R-10) | Baixo a médio | Serializar: D apaga o bloco do seed primeiro, G mexe só na seção 3 do schema |
| `src/components/ui/Button.tsx`, `Field.tsx`, `Toggle.tsx`, `Slider.tsx` | F (A11Y-03/06/08/12, CON-08), Comandante (SEG-04) | Baixo | F é dono |
| `src/app/api/check-alerts/route.ts`, `src/services/email.ts` | G (SEG-01 a SEG-03, CON-01, DAD-04), R-01 (helper de oferta) | Baixo | G é dono e importa o helper de C |
| `tests/e2e/*` | Correções-H (R-14), e as mudanças de texto de F podem quebrar os seletores ("Montar meu PC", "Total no Pix", "Número de parcelas") | Médio | F roda `npx playwright test` antes de entregar; R-14 entra depois de F e B |
| `playwright.config.ts`, `.github/workflows/*` | Correções-H (R-13, PERF-05/06) | Baixo | Correções-H |

Outros riscos:

- **R-02 muda o comportamento do modo de demonstração.** Ao ligar as tabelas mock, `maxInstallments` passa de 10 (V1) para
  12, a manchete do parcelado muda e o e2e `selectOption("1")` continua ok, mas os valores mudam. R-03 e R-04 precisam entrar
  **junto** com R-02, senão a tela passa a mostrar a manchete enganosa por padrão.
- **R-01 e o slider:** se a regra escolhida for excluir a oferta suspeita, a montagem com o filtro desligado em 6000/7000 deixa
  de usar a RTX 4060 de R$ 1.399,90 e o total sobe R$ 500. Os testes de `auto-build` que dependem do mock precisam ser revistos.
- **A11Y-01/02 e SEG-04/05/06/07** caem com o "Comandante", que também tem os arquivos reservados. Se o Comandante não tiver
  tempo na onda 2, os dois altos de acessibilidade (A11Y-01/02) ficam abertos: delegar a um agente Sonnet com posse de
  `layout.tsx` e das páginas (exceto `/montar`).
- `docs/superpowers/army/portao1-rigoroso.md` (este arquivo) está fora do controle de versão; o Comandante deve fazer o commit dele.
