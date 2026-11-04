# Revisão final — Revisor Final (Fable, xhigh), 2026-11-04

Última revisão independente depois da rodada final de correções (6 grupos Opus) e do alinhamento
das docs. Base: `HEAD = ad4778a` (árvore limpa). Diff revisado desde a minha revisão anterior
(`02772e9..HEAD`): 77 arquivos, +6.546/−1.131, lidos integralmente em `src/`, `tests/`,
`supabase/`, `scripts/`, `.github/` e as docs. Só leitura; este é o único arquivo criado. As sondas
Vitest descartáveis rodaram no scratchpad (fora do repositório) e foram apagadas; o `next start` do
e2e foi encerrado ao fim. Nenhum git que muda estado, nenhum `npm install`.

## Veredito

**Pronto para mostrar a alguém? Sim, com ressalvas.** No modo de demonstração (sem banco), tudo o
que a pessoa vê é coerente entre si e rotulado como exemplo: a lista de peças, a página da peça, o
CSV e "Como pagar" dizem o mesmo parcelado; o selo, as notas e o "Sobra até o teto" contam a mesma
história; o formulário da home aceita R$ 6.550; o link `?b=` sobrevive a um recarregar. As três
invariantes e as regras de dinheiro não quebraram em **6.786 cenários** (0 violações). As ressalvas
são de produto, não de código: reputação, juros e índices são inventados (a faixa diz isso), e um
deploy público com banco real ainda depende da lista "Antes do deploy" abaixo.

**Pronto para continuar o desenvolvimento? Sim.** `tsc` 0, lint 0, 468 unitários, build e 43 e2e
contra a build passam; spec, README, diagramas e PENDENCIAS batem com o código (datados de 04/11,
ao fim da rodada final); 21 marcadores `TODO(V2-*)` estão rastreados. O que falta é registrar em
`docs/PENDENCIAS-POS-V2.md` os 24 achados menores da inspeção 2 que ficaram abertos sem dono (lista
na seção "Triagem") e consertar meia dúzia de comentários que a própria rodada final deixou velhos.

## Verificação

| comando | resultado |
|---|---|
| `npx tsc --noEmit` | **PASS** (exit 0, 0 erros) |
| `npm run lint` | **PASS** (exit 0, 0 erros) |
| `npx vitest run` | **PASS**: 23 arquivos, **468/468**, 6,4 s |
| `npm run build` | **PASS**: Next 16.2.9/Turbopack; rotas `/`, `/conta`, `/metodologia` estáticas; `/busca`, `/entrar`, `/montar`, `/peca/[slug]`, `/api/check-alerts` dinâmicas; Proxy |
| `CI=1 npx playwright test` | **PASS**: **43 passaram, 1 pulado** em 52 s, contra `next start -p 3100` sobre a build (projetos `desktop` e `celular`). O pulado é o teste de rolagem horizontal, que só roda no projeto `celular` (`tests/e2e/montar.spec.ts:177`) |
| processos ao fim | nenhum `next-server`/`next start` vivo |
| `git status --short` | limpo antes e depois |

## Status dos itens

Contagem de ids únicos (os três relatórios se sobrepõem): **43 itens únicos**, 41 resolvidos,
1 parcial (F-22: HSTS e `object-src` feitos, `script-src` com nonce adiado), 1 adiado com motivo
(F-21). Bate com o "41 de 43" do `estado-exercito.md`.

### F-01..F-23 (Revisor Fable): 21 resolvidos · 1 parcial · 1 adiado

| id | status | evidência |
|---|---|---|
| F-01 | resolvido | `src/app/page.tsx:74-76` (`noValidate`), `:89` e `:103` (`step="any"`); e2e `tests/e2e/navegacao.spec.ts:43-52` (6550 chega ao Montador) |
| F-02 | resolvido | `src/services/builder/auto-build.ts:463-498` (`downgradeToCap`: entre as mais baratas compatíveis, a de maior utilidade que já faz caber); teste `auto-build.test.ts:490` |
| F-03 | resolvido | `src/components/builder/BuildResultView.tsx:153-162` (só `result.notes`; o `<li>` duplicado saiu) |
| F-04 | resolvido | `auto-build.ts:564-583` ("economizando"/"pelo mesmo preço"), `:669-671` e `:721-722` (`trocasPagas`, `usedWiggleRoom`); testes `auto-build.test.ts:500,510` |
| F-05 | resolvido | `src/components/builder/PerformanceChart.tsx:72` (`accessibilityLayer={false}` com o mesmo comentário do histórico) |
| F-06 | resolvido | `docs/diagramas/README.md:5,45-58` (retrato de 04/11 ao fim da rodada final; B/E/F/G "No ar"), `arquitetura.md:173,218` (503/401), `fluxo-pagamento.md:22-31` (Misturar "No ar") |
| F-07 | resolvido | `src/services/references.ts:101-130` (erro → `[]`, nada válido → `[]`, mock só sem Supabase); testes em `references.test.ts` |
| F-08 | resolvido | spec `:30` (§2 régua completa), `:103` (§4.3 12 montagens), `:213` (§5.3 par CPU + placa-mãe), `:261-266` (§5.5 rebaixamento por utilidade) |
| F-09 | resolvido | `docs/PENDENCIAS-POS-V2.md` (21 `TODO(V2-*)`; `grep` devolve 22 linhas, uma é o teste); plano com 38 caixas `[x]` e 2 `[ ]` |
| F-10 | resolvido | `src/app/auth/actions.ts:51,69,85-104` (só códigos), `src/app/entrar/page.tsx:21-43,56-59` (mapa fixo); `BuilderForm.tsx:94,112-116` (`SLUG_SEGURO`); e2e `navegacao.spec.ts:64-79` |
| F-11 | resolvido | `src/services/builder/mixed-plan.ts:72-83` (`mixedPlanPrompt`), `PaymentPlanner.tsx:258-268` |
| F-12 | resolvido | `src/services/builder/payments.ts:290-310` (`offerInstallment`); usado em `BuildSummary.tsx:44-45`, `src/app/peca/[slug]/page.tsx:121,151-158` |
| F-13 | resolvido | `src/lib/share.ts:151-175` (CSV usa `offerInstallment` + `interestTablesOf`); `BuildResultView.tsx:84` passa `payment` |
| F-14 | resolvido | `src/lib/money.ts:1-57` (ponto + 1 ou 2 dígitos = decimal; ambíguo = NaN), `formatMoneyPreview`; `BuilderForm.tsx:79-87,221,228`; e2e `montar.spec.ts:277-286` |
| F-15 | resolvido | `PerformancePanel.tsx:25-26,52-53` (TODOs apagados), `:208-214` (`<Link>` interno, sem nova aba) |
| F-16 | resolvido | `supabase/schema-builder.sql:1-9`, `supabase/schema.sql:3` |
| F-17 | resolvido | (b) `auto-build.ts:613-626` ("Nenhuma peça… tem especificação"); (a) `src/app/montar/page.tsx:65-70` ("Catálogo indisponível", texto que não chuta a causa; `getProducts` continua devolvendo `[]` em erro, por escolha) |
| F-18 | resolvido | `src/app/montar/page.tsx:51-56` (faixa cita lojas e reputação) |
| F-19 | resolvido | (a) `montar.spec.ts:289-309` sem `if`, `peca.spec.ts:15-33`; (b) `auto-build.test.ts:705-723` (200 ms, mediana de 5) |
| F-20 | resolvido | `src/app/account/actions.test.ts` (322 linhas: preço do banco, `product_id`, limite 50, dono) e `src/app/api/check-alerts/route.test.ts` (264 linhas: 503/401, simulado não marca, R-01, LOG-N1, produção sem Resend) |
| F-21 | **adiado** | `docs/PENDENCIAS-POS-V2.md` §2 (server action/Worker) |
| F-22 | **parcial** | `next.config.ts:16-23` (HSTS 2 anos sem preload, `object-src 'none'`); e2e `navegacao.spec.ts:81-94`; `script-src` com nonce adiado em PENDENCIAS §2 |
| F-23 | resolvido | `SaveBuildButton.tsx:41-66` e `PriceAlertButton.tsx:39-46` (aviso em texto no modo de demonstração) |

### S-01..S-25 (+ S-04b) (Gerente Rigoroso): 26/26 resolvidos

| id | status | evidência |
|---|---|---|
| S-01 (= F-14, T-3) | resolvido | `money.ts:21-57`; `money.test.ts`; sonda: "6000.5" → 6000,5, "6.5" → 6,5, "6.0000"/"1.2.3"/"1.23.456"/"6000.500" → NaN |
| S-02 | resolvido | `src/services/builder/scoring.ts:62-81` (`upgradeOrder`: jogos gpu→cpu, criação cpu→gpu, trabalho só cpu); `auto-build.ts:507-521`; testes `:556,566`; sonda: 0 trocas de GPU em "trabalho" em 375 montagens |
| S-03 (= T-1) | resolvido | `payments.ts:140-149` (`totalDaLoja` até `offersInstallmentCount`), `:325-342`; `installment-tables.ts:33-45` (Terabyte 10x/12x) e `seed-payments.sql:22-36` alinhados; e2e `montar.spec.ts:98-166` (abre em 10x, 12 opções) |
| S-04 | resolvido | `payments.ts:358-361` (`maxInstallments` = maior); sonda: loja A 12x + loja B só Pix → 12 opções, 2 faixas, total fecha |
| S-04b | resolvido | `PaymentPlanner.tsx:156-160` (frase das faixas sempre) |
| S-05 | resolvido | `payments.ts:271-281` (`bestInstallment.count` quando tudo tem acréscimo); sonda: marketplace 3x anunciado abre em 3x |
| S-06 | resolvido | `payments.ts:72-78` (`precoAPrazo` ≥ Pix), `:372-373` (`pixSavings ≥ 0`); sonda: a prazo 250 < Pix 300 → cartão 300, economia 0 |
| S-07 (= F-07, T-9) | resolvido | `references.ts:113-130` |
| S-08 (= F-03, T-2) | resolvido | `BuildResultView.tsx:153-162` |
| S-09 | resolvido | `auto-build.ts:716-719` (`bestInstallment.total`); testes `:581,605`; sonda: em 3.294 montagens o "ou R$ X parcelado" sempre existe no seletor |
| S-10 (= F-17b) | resolvido | `auto-build.ts:613-626`; testes `:361,370` |
| S-11 (= T-8) | resolvido | `src/app/conta/page.tsx:30-32` (`metadata` "Minha conta") |
| S-12 (= F-15, T-10) | resolvido | `PerformancePanel.tsx:25-26,52-53` |
| S-13 | resolvido | `peca/[slug]/page.tsx:121-123,151-158` (`offerInstallment`; `linkDaLoja` com `safeHref`) |
| S-14 | resolvido | `src/services/builder/trust.ts:53-66` (`isTrustedStore` sem textos; `storeTrust` reaproveita); sonda: 1.440 lojas, 0 divergências entre `isTrustedStore`, `storeTrust().trusted` e `trustLevel`; 0,04 µs por chamada |
| S-15 (= F-10) | resolvido | `auth/actions.ts`, `entrar/page.tsx`; e2e `navegacao.spec.ts:72-79` |
| S-16 (= F-19a, T-11) | resolvido | `montar.spec.ts:289-309`, `peca.spec.ts`, `montar.spec.ts:98-166` (parcelado) |
| S-17 | resolvido | `src/services/products.ts:294-307` (só ofertas honestas); sonda: histórico da RTX 4060 no mock tem 8 dias e mínimo R$ 1.871 (o ponto de R$ 1.399,90 não entra) |
| S-18 | resolvido | `supabase/schema-auth.sql:34-52` (`do $$ … if not exists`) |
| S-19 (= F-06) | resolvido | diagramas (ver F-06) |
| S-20 | resolvido | `src/components/ui/Field.tsx:43` (`aria-live="polite"`) |
| S-21 | resolvido | `src/components/StoreBadge.tsx:24-27,67` (`notaBR`) |
| S-22 | resolvido | `src/components/ProductCard.tsx:38` ("melhor preço no Pix") |
| S-23 (= F-08) | resolvido | spec `:226-232` (ordem por perfil), `:241-254` (texto real das notas, `usedWiggleRoom`, selos), `:319-343` (§7 piso, parcelas anunciadas, máximo = maior) |
| S-24 (= T-7) | resolvido | `docs/METODOLOGIA-DESEMPENHO.md` sem `measuredAt`, sem "Onde isso está no código" nem caminhos `src/` (grep vazio); `src/app/metodologia/page.tsx:23-37` renderiza itálico |
| S-25 | resolvido | `src/services/builder/compatibility.ts:32-50` (`perf > 0` em todas); spec `:140` |

### T-1..T-11 (Gerente Tranquilo): 11/11 resolvidos

| id | status | evidência |
|---|---|---|
| T-1 | resolvido | = S-03 |
| T-2 | resolvido | = S-08 |
| T-3 | resolvido | = S-01 |
| T-4 | resolvido | `BuilderForm.tsx:50-55` (resolução só destaca a coluna de FPS); spec `:386` |
| T-5 | resolvido | `BuildSummary.tsx:58-66` ("Por que não marcamos como confiável" só para loja não confiável; selo com `announceReasons` para a confiável) |
| T-6 | resolvido | `BuildResultView.tsx:133` ("Sobra até o teto"); e2e `montar.spec.ts:71-72` |
| T-7 | resolvido | = S-24 |
| T-8 | resolvido | `SaveBuildButton.tsx:152-193` (`hasAlert` → "Mudar alerta"), `account/actions.ts:53-80,266-269` ("Alerta atualizado"), `conta/page.tsx:227`; testes `actions.test.ts:240-320` |
| T-9 | resolvido | = S-07 |
| T-10 | resolvido | = S-12 |
| T-11 | resolvido | = S-16 |

## Triagem da inspeção 2 (`onda2-trufas.md`, 53 achados)

Conferido um a um no `HEAD`. Resultado: **13 resolvidos · 5 parciais · 10 adiados com registro em
PENDENCIAS · 24 abertos sem registro · 1 descartado**. Severidade final na última coluna.

### Resolvidos na rodada final (13)

| id | evidência | sev. final |
|---|---|---|
| SEG-02 | `route.ts:109-113` (produção sem `RESEND_API_KEY` → 503), `:150-155,252-257`; `email.ts:18-24`; testes `route.test.ts:216-260` | — |
| A11Y-02 | `conta/page.tsx:30-32` | — |
| CON-N1 | diagramas datados e com estado "No ar"; `arquitetura.md:173,218` corrigem o "500"/"rota aberta" | — |
| CON-N2 | README `:37-38`, spec `:30`. Resíduo: `src/models/builder-types.ts:17` ainda diz "(oficial e nota >= 4.5)" (comentário) | baixo (resíduo) |
| CON-N3 | README "Alertas por e-mail" (`:146-171`) + `.github/workflows/alertas.yml` (de hora em hora, `SITE_URL` e `CRON_SECRET`, `curl -f`) | — |
| CON-N6 | TODOs do `PerformancePanel` apagados; os de cupom continuam `TODO(V2-E)`, mas agora listados em PENDENCIAS E-1/E-2/E-3 | — |
| CON-N7 | `schema-builder.sql:1-9` | — |
| CON-N12 | `compatibility.ts:32-50` e spec `:140` (`perf > 0` em todas) | — |
| LOG-N1 | `route.ts:181-213` (sem `MAX_LOTES`; cursor sempre avança; trava contra laço); teste `route.test.ts:196-214` (o 5.100º é avaliado) | — |
| LOG-N4 | `payments.ts:72-78` (= S-06) | — |
| DAD-02 | histórico paginado do mais novo para o mais antigo, `products.ts:238-276` (1.000 por página, até 50 páginas, aviso no log). A metade "paginar catálogo e busca" segue em PERF-04 | — (histórico); ver PERF-04 |
| PERF-05 | `scripts/collect-prices.mjs:46-50,237-243,297-298` (orçamento de 100 min < 120 do workflow; `interrompida` no JSON) → o `coleta-resultado.json` sempre é gravado. "Parar loja após N falhas" segue em PENDENCIAS H-2 | — |
| TST-01 | `payments.test.ts:118` (`it.each([0, -3, NaN, null])` em `installment_count`) | — |

### Parciais (5)

| id | o que ficou | sev. final | vai para PENDENCIAS? |
|---|---|---|---|
| CON-05 | `schema.sql:3` corrigido; `package.json:2` continua `comparador-app`; `popularity.ts:39` ainda diz "marca algumas como destaque" (só corta a lista) | baixo | sim (2 linhas) |
| CON-N9 | README documenta `NEXT_PUBLIC_SITE_URL`/`EMAIL_FROM`; o código ainda cai em `http://localhost:3000` (`route.ts:125`) e `onboarding@resend.dev` (`email.ts:28`) sem erro em produção | médio (deploy) | sim |
| A11Y-N1 | a confirmação do alerta agora fica visível depois de salvar (`PriceAlertButton.tsx:58-71`); o foco ainda não vai para o campo ao abrir, e `getUser` em falha deixa o botão desabilitado sem explicação | baixo | sim |
| TST-N1 | o teste de tempo continua com limite duro em `npm test` (`auto-build.test.ts:705-723`), mitigado com mediana de 5 execuções; passa com folga (sonda: 79–132 ms por 4 montagens) | baixo | sim (mover para benchmark) |
| LOG-N3 | `AGENTS.md` ainda diz "peças sempre compatíveis entre si"; README (`:42-43`) e PENDENCIAS A-1 dizem quais regras existem (socket, memória, gabinete, fonte) | baixo (doc) | sim (reescrever a invariante) |

### Adiados com registro (10)

SEG-06 (§2), DAD-01 (§2), PERF-01 (= F-21, §2), PERF-02, PERF-03, PERF-04 (§3), PERF-07 (coberto
por F-21), LOG-N5 (E-1/E-3), CON-04 (parcialmente: §3 "campos obrigatórios gerados de um arquivo
único"; falta citar as 7 categorias repetidas em 6 lugares), PERF-N3 (parcialmente: B-1; falta a
medição com catálogo real). Severidade mantida (médio/baixo); nenhum muda o que a pessoa paga.

### Abertos sem registro em PENDENCIAS (24) — é o que falta lá

| id | ainda aberto em | sev. final |
|---|---|---|
| SEG-N4 | `.github/workflows/ci.yml:37` e `coleta.yml:44`: `actions/checkout@v4` sem `persist-credentials: false`; ações por tag, não por SHA | **médio** (cadeia de suprimentos; a coleta tem `issues: write`) |
| CON-N11 | `supabase/seed.sql:1-3` ("histórico de preços de exemplo") e `seed-extras.sql` fora da lista de seeds de demonstração do README `:126-127` e do AGENTS.md | **médio** (honestidade: histórico inventado num banco real sem aviso) |
| A11Y-03 | `SaveBuildButton.tsx:107-117`: `<input>` comum dentro do `Field` não recebe `aria-describedby` (só o `MoneyInput` consome o contexto, `Field.tsx:67,81`) | **médio** (WCAG 1.3.1/3.3.1) |
| SEG-08 | `supabase/schema-popularity.sql:23-25,29-37` (leitura pública de `product_views`; view sem `security_invoker`) | baixo/médio |
| PERF-N1 | `src/app/page.tsx` → `getPopularProducts` lê a view a cada visita; `product_views` sem retenção | médio (custo cresce com o tráfego) |
| SEG-09 | `src/models/supabase-admin.ts` sem `import "server-only"` (pacote ausente) | baixo |
| SEG-N2 | `auth/actions.ts:98` → `entrar/page.tsx:25` ("já está cadastrado" revela conta) | baixo |
| SEG-N3 | `email.ts:38` (`para=${to}` no log) | baixo |
| A11Y-11 | `ProductCard.tsx` / `StoreBadge.tsx`: motivos só em `title`/sr-only no card | baixo |
| A11Y-N2 | `SegmentedControl.tsx:78` (`hint` só em `title`) | baixo |
| A11Y-N3 | `Button.tsx:79-83` (`<span aria-disabled>`) | baixo |
| A11Y-N4 | `PaymentPlanner.tsx:142-161` (`<label>` envolve o `<select>` e a ajuda) | baixo |
| A11Y-N5 | `ProductCard.tsx:25-56` (card inteiro é o link; nome acessível longo) | baixo |
| CON-07 | `categories.ts:39-44`; **sonda**: `categoriesMatching("memória de vídeo")` = `["ram"]`; `"hdmi"` = `[]` (essa metade está certa) | baixo |
| CON-N4 | `BuilderForm.tsx:105-124` (`notasDoLink`) e `BuildResultView.tsx:23-28` (`situacaoDe`) sem teste e fora de `services/` | baixo |
| CON-N5 | `DESIGN.md:88` cita `NumberInput` (o componente é `MoneyInput`); `SegmentedControl` não listado | baixo |
| CON-N8 | `playwright.config.ts:28`, `collect-prices.mjs:66`, `inspect-store.mjs:15` com `/opt/pw-browsers/chromium`; `PW_CHROMIUM_PATH` fora do `.env.example` | baixo |
| LOG-N2 | ramo "só sobrou suspeita" inalcançável (`escolherOferta`, `auto-build.ts:150-152`; `format.ts:30-31`) | baixo |
| LOG-N7 | `auto-build.ts:710` (`perfGainPct ?? 0`) | baixo |
| LOG-N8 | `route.ts:150-172` (e-mail sai antes de gravar `notified_at`: "pelo menos uma vez") | baixo |
| TST-N2 | `montar.spec.ts:28,42,77,303`, `navegacao.spec.ts:30`, `peca.spec.ts:20` (XPath, `ul > li`, `a[href^=]`) | baixo |
| PERF-08 | `package.json:23` (`playwright` em `dependencies`) | baixo |
| PERF-N2 | `auto-build.ts:84-109` (`makeTrustCache`): ver "Regressões", item 1 | baixo |
| PERF-N4 | `SiteHeader.tsx:43,56` (dois `SearchBar`) | baixo |

### Descartado (1)

CON-N10 (emojis no README): a regra do AGENTS.md é sobre ícones de UI ("Ícones só do lucide-react"),
e o próprio achado admite que é documento. Fica como preferência de estilo, não como pendência.

### Os 3 mais graves ainda abertos

1. **CON-N11** — `seed.sql` grava histórico de preço inventado e não está na lista de "só para
   demonstração": quem monta um banco real seguindo o README `:121` roda o `seed.sql` no passo 2
   e fica com um gráfico "real" falso. Correção: P (cabeçalho + duas listas).
2. **SEG-N4** — `persist-credentials: false` e ações fixadas por SHA nos dois workflows. P.
3. **A11Y-03** — `aria-describedby` no `<input>` comum (um `useFieldProps` no `Field`). P.

## Regressões encontradas

Procurei de propósito os acoplamentos entre os 6 grupos que editaram em paralelo. **Nenhuma
regressão funcional.** O que achei são comentários que a própria rodada deixou falsos e uma
pequena perda de desempenho sem efeito visível:

| # | cenário | o que acontece | correção |
|---|---|---|---|
| 1 | `auto-build.ts:84-109` (`makeTrustCache`, G2) × S-14 (`trust.ts:53-66`, G4) | O comentário diz que `isTrustedStore` "monta os textos dos motivos… custa dezenas de µs" e por isso há cache. Depois do S-14 isso é falso: **sonda** mediu `isTrustedStore` em **0,04 µs** e o `JSON.stringify(loja)` que o cache usa como chave em **0,85 µs** (20× mais caro do que a função que ele poupa). O teste de equivalência (`auto-build.test.ts:292`) garante que o resultado é o mesmo, e o tempo total continua bom (4 montagens com 150 peças/categoria: **132 ms** com lojas compartilhadas, **79 ms** com lojas clonadas por oferta, como vêm do banco). | Apagar o cache e chamar `isTrustedStore`/`flagSuspiciousOffers` direto (é a pendência B-2, que já pode ser fechada). P |
| 2 | `builder-types.ts:17` (fundação) × CON-N2 | Comentário de `trustedOnly` ainda diz "(oficial e nota >= 4.5)"; a régua tem Reclame Aqui e bloqueio. | Apontar para `isTrustedStore`. P |
| 3 | `offerInstallment` (G1) com oferta que tem `price_installment` válido e `installment_count = null` | Lista e CSV mostram "ou **1x** de R$ 230,00" (antes a lista escondia a oferta). É honesto e coerente com "Como pagar" (1x pelo preço a prazo), mas é um texto estranho. **Sonda** confirmou `{count: 1, monthly: 230, total: 230}`. | Na tela, quando `count === 1`, escrever "ou R$ 230,00 no cartão (1x)". P |
| 4 | `getPriceHistory` (S-17, G4) × `PriceHistoryChart` | Peça com todas as ofertas sem estoque (ou todas bloqueadas/suspeitas) devolve `[]` mesmo com histórico no banco, e o gráfico diz "Ainda não há histórico de preços para esta peça". **Sonda** confirmou os dois casos. É a limitação documentada em `products.ts:301-303` e PENDENCIAS C-4. | Texto do vazio: "Sem histórico de ofertas confiáveis em estoque." P |
| 5 | `estado-exercito.md` "Flags abertas" | Ainda cita R-14 ("depois de F e B") e SEG-07 como pendentes; os dois estão fechados (S-16 e `next.config.ts`). | Tirar as duas linhas. P |

Acoplamentos conferidos e **sem problema** (todos por sonda, números na seção seguinte):
`offerInstallment` com e sem tabela entre `BuildSummary` (tabela do resumo), CSV (`interestTablesOf`)
e `/peca` (tabela crua) → mesma saída em 140 peças, e o CSV soma exatamente o preço a prazo do
resumo; `payment` chega ao `BuildSummary` e ao CSV via `BuildResultView.tsx:84,164`; `usedWiggleRoom`
× selo (`situacaoDe`) × notas coerentes em 375 montagens (nenhuma nota com valor negativo, nenhuma
"usaram R$ 0,00 da folga", "trabalho" nunca sobe a GPU); `history.replaceState` do `?b=`
(`BuilderForm.tsx:186-190`) × remontagem automática: codificar → decodificar → montar de novo deu
montagem idêntica (peças, total e notas) em 180/180 cenários, inclusive com teto < alvo e valores
com centavos; e2e `montar.spec.ts:260-275` confirma o recarregar contra a build; `references: []`
→ `SEM_REFERENCIA` + `NOTA_SEM_REFERENCIAS`, FPS zerados e painel sem comparações
(`PerformancePanel.tsx:52-55`), enquanto `undefined` usa a lista local só sem banco.

## Invariantes e dinheiro (números das sondas)

Três sondas no scratchpad (apagadas depois), todas verdes:

- **`inv.sonda.ts`**: `autoBuild` em **6.786 cenários**: mock (15 orçamentos de R$ 3.000 a R$ 1 milhão,
  inclusive alvo = teto e R$ 4.699,30 exato × 3 perfis × 5 posições do slider × filtro ligado/desligado ×
  sem contexto / contexto completo / `references: []`) e sintéticos (60 catálogos de 4 a 6 peças por
  categoria, em metade deles a Loja Duvidosa **bloqueada** por clone dos objetos de loja; 5 orçamentos
  relativos ao mínimo e ao máximo do catálogo × 3 perfis × 3 slider × 2 filtros; mais 3 catálogos de 150
  peças por categoria). **3.294 montagens** aprovadas e 3.492 falhas honestas (orçamento abaixo do mínimo
  ou filtro sem candidatos). Em cada montagem: `total ≤ teto`; total = Σ peças; 7 categorias;
  compatibilidade par a par (`isCompatible` de cada peça contra as outras 6); nenhuma loja bloqueada,
  nenhuma oferta sem estoque ou com preço ≤ 0; com o filtro, só `isTrustedStore`; oferta suspeita só
  quando não havia outra válida, sempre marcada em `suspicious` e com aviso "Atenção: … bom demais …";
  `installmentTotal ≥ pixTotal`; `pixSavings ≥ 0` e = melhor n > 1 − Pix; `totalInstallment` do
  cabeçalho existe no seletor; `bestInstallment` existe; `leftover` = teto − total; selo/notas/trocas
  coerentes. **38.236 planos de parcelas** (todo n de 1 ao máximo): Σ `schedule` = total em centavos,
  Σ faixas + arredondamento = total, faixas somam n, plano ≥ preço a prazo (piso) e ≥ Pix.
  **39.528 planos mistos** (4 valores à vista × 3 por mês por montagem): Pix ≤ à vista, nenhuma peça
  perdida, cartão ≥ Pix das peças parceladas, faixas fecham, `fits` ⇒ 1ª parcela cabe, `!fits` ⇒ nota
  "Falta…". **Violações: 0.**
- **`acopl.sonda.ts`**: 140 peças com `offerInstallment` igual nos três chamadores; 180/180
  round-trips do `?b=`; 375 montagens com selo coerente (256 "Dentro do alvo", 107 "Usou a folga",
  9 "Acima do alvo, dentro do teto", 3 "Usou a folga até o teto"); 1.440 lojas (nota e Reclame Aqui
  como número, texto, NaN, nulos; bloqueio) sem divergência entre `isTrustedStore`, `storeTrust` e
  `trustLevel`; bordas de `parseMoney` (12 válidas, 11 que viram NaN); S-03/S-04/S-05/S-06 e tabela
  que termina antes do anunciado (12x anunciado + tabela até 10x → "10x de R$ 112,00", sem acréscimo
  até 10x) nos valores da tabela acima; histórico da RTX 4060 (8 dias, mínimo R$ 1.871).
- **`perf.sonda.ts`**: 4 montagens com 150 peças/categoria (2.089 ofertas): mediana de 7 execuções
  **132 ms** (lojas compartilhadas) e **79 ms** (uma cópia de loja por oferta); `isTrustedStore`
  0,04 µs; `JSON.stringify(loja)` 0,85 µs.

## Docs × código

Conferido linha a linha contra o `HEAD`:

- **Spec** (`docs/superpowers/specs/2026-11-04-montador-de-pc-design.md`): §2 régua de confiança
  completa (`:30`), §4.3 12 referências e o sentido de `measuredAt` (`:103,110-111`), §5.1 `perf > 0`
  (`:140`), §5.3 par CPU + placa-mãe e planejador (`:181,213`), §5.4 ordem por perfil, textos reais das
  notas, `usedWiggleRoom` e selos (`:226-254`), §5.5 rebaixamento por utilidade (`:261-266`), §7 piso a
  prazo, `offersInstallmentCount`, máximo = maior, `offerInstallment` (`:314-357`), faixa de demonstração
  (`:449`). **Bate.**
- **README**: régua de confiança (`:37-38`), passos 5 e 6 do Montador (`:44-49`), faixa de
  demonstração com salvar/alertas desligados (`:104-105`), ordem dos 13 scripts e "com banco configurado
  o site nunca usa os dados de exemplo" (`:119-130`: conferido em `products`, `specs`, `installments`,
  `references`, `popularity`, `getPriceHistory`), coleta às 06:00 UTC e 30% (`:141`, `coleta.yml:17`,
  `collect-prices.mjs:55`), seção de alertas com 503/401, produção sem Resend → 503 e o workflow
  (`:146-171`). **Bate.** Falta só: `seed.sql`/`seed-extras.sql` na lista de demonstração (CON-N11).
- **Diagramas**: datados "04/11/2026, ao fim da rodada final"; tabela de estado com B/E/F/G "No ar";
  503/401 e Resend em produção (`arquitetura.md:173,218`, `fluxo-dados.md:67-69,269-270`); a legenda
  "cinza tracejado = ainda não existe" aponta para PENDENCIAS. `fluxo-dados.md:256` é honesto num ponto
  importante: **a coleta não atualiza `in_stock`** (peça esgotada continua "em estoque"). **Bate.**
- **PENDENCIAS-POS-V2.md**: 21 marcadores (confere com `grep`, por pacote: A 5, B 2, C 4, D 2, E 5, G 1,
  H 2); §2 e §3 cobrem F-21, F-22, SEG-06, DAD-01, A4, PERF-02/03/04 e os adiamentos dos gerentes.
  **Faltam** os 24 abertos da triagem acima, os 5 parciais e a limitação do `in_stock` da coleta (está
  só no diagrama).
- **AGENTS.md**: regra "dado ilustrativo nunca vira fato" agora é cumprida por todos os serviços; a
  lista de seeds omite `seed.sql` (CON-N11); a invariante "peças sempre compatíveis" promete mais do que
  as 4 regras (LOG-N3). **METODOLOGIA** sem jargão de desenvolvedor. **DESIGN.md:88** cita `NumberInput`
  (não existe; é `MoneyInput`) — a única afirmação falsa que restou numa doc de referência.
- **Comentários no código** que ficaram velhos (todos P): `auto-build.ts:84-109` (cache),
  `builder-types.ts:17`, `popularity.ts:39`, `estado-exercito.md` "Flags abertas".
- `docs/superpowers/army/usabilidade.json` existe (avaliação heurística de 7 telas, com as limitações
  declaradas) e `usabilidade-garimpopc.html` foi commitado em `ad4778a`.

## Antes de um deploy real

1. **Segredos no servidor**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (sem ele a rota responde 503), `RESEND_API_KEY` (em
   produção sem ela o job responde 503 de propósito), `EMAIL_FROM` com domínio verificado no Resend
   (o padrão `onboarding@resend.dev` só entrega para a conta de teste), `NEXT_PUBLIC_SITE_URL`
   (senão os links dos e-mails apontam para `localhost`, `route.ts:125`).
2. **Segredos no GitHub**: `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (coleta);
   `SITE_URL` e `CRON_SECRET` (alertas). Antes, `persist-credentials: false` nos checkouts (SEG-N4).
3. **SQL**: os 13 scripts na ordem do README. **Não** rodar `seed-stores`, `seed-payments`,
   `seed-builder`, `seed-references` num banco real — e também **não** rodar `seed.sql` (histórico de
   exemplo) nem `seed-extras.sql` sem saber que são demonstração (CON-N11). Rodar `schema-alerts.sql`
   antes de usar alertas de montagem (sem ele a rota cai no formato V1, `route.ts:175-198`).
4. **Dados reais que hoje são inventados**: `reclame_aqui_score` e `years_active` em `stores`;
   `store_installments` (juros); `part_specs` (`npm run collect:specs`; sem specs o Montador falha
   dizendo isso); `reference_builds` (estimativas rotuladas; `/metodologia` explica).
5. **Limites conhecidos**: a coleta só atualiza `price_pix` (não `in_stock`, `price_installment`,
   `installment_count`), então peça esgotada continua "em estoque" e o parcelado anunciado envelhece;
   catálogo e busca sem paginação (teto de 1.000 linhas do PostgREST; o histórico já pagina);
   `/montar` manda o catálogo inteiro ao navegador (F-21) e monta no navegador (~130 ms com 150
   peças/categoria); `product_views` sem deduplicação, retenção nem leitura restrita (SEG-06,
   PERF-N1, SEG-08); `playwright` em `dependencies`; login sem limite de tentativas além do Supabase
   e cadastro que revela e-mail existente (SEG-N2).
6. **HSTS** está ligado com `includeSubDomains` por 2 anos: garantir HTTPS em todos os subdomínios
   antes do primeiro acesso. CSP ainda sem `script-src` (F-22).
7. O CI só testa o modo de demonstração; não há e2e contra banco real. Fazer um smoke manual
   em staging: `/montar` com specs reais, `/peca` com histórico, salvar montagem, alerta, `curl` no job.

## O que eu faria na V3 (por ordem)

1. **Paginação e cache**: `limit/range` no catálogo e na busca, `revalidate` nas páginas públicas e a
   sessão fora do cabeçalho (PERF-02/03/04, metade pendente de DAD-02).
2. **Montador no servidor** (server action com catálogo em cache) ou Web Worker, mandando só o
   resultado ao navegador (F-21/PERF-01/PERF-07); junto, apagar `makeTrustCache` (B-2).
3. **Coleta completa**: atualizar `in_stock`, `price_installment` e `installment_count`, parar uma loja
   após N falhas e gravar o resultado por loja (H-1/H-2); `playwright` em `devDependencies`.
4. **Dados reais**: Reclame Aqui e anos de mercado, tabelas de juros das lojas, specs de todo o
   catálogo (A-4), benchmarks por jogo de fonte estável (D-1/D-2).
5. **Compatibilidade completa**: comprimento da GPU, altura do cooler, M.2, pentes, SFX em ITX, com um
   modelo genérico de restrições por par de categorias (A-1/A-2) e a categoria cooler (A4); até lá,
   reescrever a invariante do AGENTS.md para o que o código garante (LOG-N3).
6. **Segurança**: `server-only` no cliente admin, `persist-credentials: false` e SHAs nos workflows,
   CSP com nonce, cadastro sem enumeração e limite de tentativas, `product_views` sem leitura pública,
   e-mail fora do log (SEG-09, SEG-N4, F-22, SEG-N2, SEG-08, SEG-N3).
7. **Acessibilidade**: `useFieldProps` para o `<input>` comum (A11Y-03), foco ao abrir o alerta
   (A11Y-N1), dicas do `SegmentedControl` via `aria-describedby` (A11Y-N2), `<label>` do seletor de
   parcelas (A11Y-N4), nome do link do card (A11Y-N5), `<span>` sem `aria-disabled` (A11Y-N3), motivos
   visíveis no card (A11Y-11).
8. **Fonte única** das 7 categorias e dos campos obrigatórios (CON-04), `specs.ts` validando os enums;
   separar `auto-build.ts` (730 linhas) em candidatos, planejador, passos e notas.
9. **Algoritmo**: otimização global (busca em feixe) com a resolução influenciando as fatias (B-1), mistura
   ótima Pix + cartão e cupons na tela (E-1..E-4), "bom demais" olhando o histórico (C-2/C-4).
10. **Operação**: deduplicação, retenção e ranking materializado de `product_views` (SEG-06/PERF-N1),
    cursor do job de alertas (G-1), seletores e2e por `role`/`testid` (TST-N2), benchmark fora do
    `npm test` (TST-N1) e um e2e de staging contra banco real.
