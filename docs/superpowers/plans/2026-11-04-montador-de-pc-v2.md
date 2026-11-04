# Montador de PC — Plano de implementação da V2

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development`
> (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa a tarefa.
> Os passos usam caixas (`- [ ]`) para acompanhamento. Leia `AGENTS.md` antes.

**Objetivo:** transformar o scaffold V1 do Montador (dados ilustrativos, algoritmo guloso,
pagamento simplificado) em um produto com dados reais, algoritmo melhor, pagamentos
realistas, montagens salvas/compartilháveis e qualidade garantida por CI.

**Arquitetura:** a V1 já separa `models/` (dados e tipos) → `services/builder/` (lógica pura
testada) → `components/builder/` + `app/montar` (tela). A V2 mantém essas fronteiras: cada
pacote troca a *fonte* dos dados ou a *implementação* de um serviço sem mudar as assinaturas
públicas, salvo onde este plano diz. A UI segue `DESIGN.md`.

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, Recharts, Supabase,
Vitest, Playwright (coleta e e2e), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-04-montador-de-pc-design.md` (lido junto com este plano).

> **Estado em 04/11/2026 (fim da rodada final de correções):** os pacotes A a H estão **no ar**.
> As caixas abaixo marcam o que foi feito (`- [x]`). O que ficou para depois (os `TODO(V2-*)` do
> código e os itens adiados pelo Comandante) está consolidado em
> [`docs/PENDENCIAS-POS-V2.md`](../../PENDENCIAS-POS-V2.md). O histórico das ondas e dos portões
> está em `docs/superpowers/army/`.

## Restrições globais

- Textos, comentários e commits em português do Brasil.
- Invariantes do Montador (testadas em `auto-build.test.ts`, nunca podem quebrar):
  `totalPix ≤ hardCap`; com `trustedOnly` nenhuma peça de loja não confiável; peças compatíveis.
- `npm run typecheck && npm run lint && npm test && npm run build` verdes em todo commit.
- Serviços: teste falhando antes do código (Vitest em `src/services/**/*.test.ts`).
- UI só com os componentes de `src/components/ui/` e os tokens de `DESIGN.md`; ícones `lucide-react`.
- Sem dependência nova sem justificar no PR. Sem segredo no código (`.env.local`).
- Dados "ilustrativos" só podem ser removidos quando a fonte real estiver ligada **e** o
  fallback mock continuar funcionando (modo de demonstração).

## Foco de revisão (o que a spec implica e nenhum teste atual cobre)

1. **Catálogo grande (centenas de peças por categoria):** `autoBuild` deve responder em < 200 ms
   no navegador; `cheapestCompatibleBuild` é O(cpu × gpu × resto) — pacote B adiciona teste de tempo.
2. **Peça sem spec** não pode derrubar a montagem nem aparecer silenciosamente: pacote A adiciona
   teste "produto sem spec é ignorado e contado em `notes`".
3. **Ofertas com preço zero/negativo ou `installment_count` 0** vindas da coleta: pacote A valida
   na entrada (`validOffers` ignora preço ≤ 0; `payments` trata contagem 0 como 1).
4. **Entrada do usuário com milhar e vírgula** ("6.000,50") e valores absurdos (1e12): pacote F
   adiciona testes de `parseMoney` e limite superior com mensagem.
5. **Mudança de preço entre montar e clicar "Ver na loja"**: pacote G registra `recorded_at` da
   oferta usada e a tela avisa "preço de hoje às HH:MM".

Situação desses cinco pontos ao fim da V2: (1) planejador exato, teste de 150 peças por categoria em
menos de 200 ms; (2) peça sem spec fica em `BuildSuccess.ignored` e vira nota, e sem nenhuma spec a
montagem falha dizendo isso; (3) `validOffers` ignora preço ≤ 0 e `payments` limita as parcelas a
1..24; (4) `parseMoney` em `src/lib/money.ts`, com limite de R$ 1.000.000 e mensagem; (5) cada peça
mostra "lido em DD/MM, HH:MM" (view `offer_last_seen`).

## Mapa de arquivos e posse (para rodar pacotes em paralelo sem conflito)

| Pacote | Cria/edita (posse exclusiva durante a onda) |
|---|---|
| A | `src/models/part-specs.ts`, `src/services/specs.ts` (novo), `supabase/schema-builder.sql`, `supabase/seed-builder.sql`, `scripts/collect-specs.mjs` (novo), `src/services/builder/trust.ts` (só validação de preço) |
| B | `src/services/builder/auto-build.ts`, `scoring.ts`, `compatibility.ts`, `src/models/builder-types.ts` (campos novos) |
| C | `src/services/builder/trust.ts` (reputação), `src/models/types.ts` (campos de loja), `src/components/StoreBadge.tsx`, `supabase/schema-stores.sql` (novo) |
| D | `src/models/reference-builds.ts`, `src/services/references.ts` (novo), `src/services/builder/performance.ts`, `src/components/builder/PerformanceChart.tsx`, `PerformancePanel.tsx` |
| E | `src/services/builder/payments.ts`, `src/components/builder/PaymentPlanner.tsx`, `supabase/schema-payments.sql` (novo) |
| F | `src/components/builder/BuilderForm.tsx`, `BuildResultView.tsx`, `BuildSummary.tsx`, `src/app/montar/*`, `src/lib/share.ts` (novo) |
| G | `src/app/account/actions.ts`, `src/app/conta/page.tsx`, `src/services/saved-builds.ts` (novo), `supabase/schema-builder.sql` (só `saved_builds`) |
| H | `tests/e2e/**`, `.github/workflows/**`, `playwright.config.ts`, `scripts/collect-prices.mjs` |

**Ondas sugeridas para o agent army:** Onda 1 = A, C, D, E, H em paralelo (sem arquivos em comum).
Onda 2 = B, F, G (dependem das interfaces da onda 1). Cada pacote em sua branch
`claude/v2-<letra>`, PR para `main`, revisão com `superpowers:requesting-code-review`.

---

## Pacote A — Catálogo e especificações reais

### Tarefa A1: serviço de specs com fallback

**Arquivos:** Criar `src/services/specs.ts`; Testar `src/services/specs.test.ts`.

**Interfaces:**
- Consome: `PART_SPECS` (mock), `getSupabase()`.
- Produz: `getPartSpecs(): Promise<Record<string, PartSpec>>` — lê `part_specs` (join com `products.slug`) quando o Supabase existe; senão devolve `PART_SPECS`.

- [x] **Passo 1:** teste `getPartSpecs devolve o mock sem Supabase` (`expect(await getPartSpecs()).toEqual(PART_SPECS)`).
- [x] **Passo 2:** rodar `npx vitest run src/services/specs.test.ts` → falha (módulo inexistente).
- [x] **Passo 3:** implementar `getPartSpecs` (mapear linhas `part_specs` → `PartSpec`, `case_supports` → `caseSupports`).
- [x] **Passo 4:** rodar o teste → passa. Trocar em `src/app/montar/page.tsx` o import de `PART_SPECS` por `await getPartSpecs()` passado como prop `specs` ao `BuilderForm` (coordenar com F: só esta linha).
- [x] **Passo 5:** commit `feat(specs): serviço de specs com fallback para o mock`.
  Nota: com Supabase, erro ou tabela vazia devolvem `{}` (nunca o mock) e `/montar` mostra "Sem especificações cadastradas".

### Tarefa A2: validação de ofertas na entrada

**Arquivos:** Modificar `src/services/builder/trust.ts`; Testar `trust.test.ts`.

- [x] **Passo 1:** teste `validOffers ignora preço zero ou negativo` (oferta `price: 0` não aparece).
- [x] **Passo 2:** rodar → falha. **Passo 3:** `validOffers` filtra `price_pix > 0`. **Passo 4:** passa. **Passo 5:** commit.

### Tarefa A3: coletor de specs

**Arquivos:** Criar `scripts/collect-specs.mjs`.

- [x] **Passo 1:** script que lê `products` sem linha em `part_specs`, consulta uma fonte por categoria
  (fabricante para socket/DDR/TDP/watts; para `perf`, tabela agregada mantida por nós em
  `supabase/seed-builder.sql` até o pacote D entregar benchmarks) e faz upsert. Modo `--dry-run`.
  Nota: a fonte é o catálogo curado `scripts/data/specs-catalogo.json`; a opção `--atualizar` é a
  pendência A-5.
- [x] **Passo 2:** documentar no README (seção "Coleta de preços" e `docs/COLETA-SPECS.md`). Commit.

### Tarefa A4: categorias novas (cooler e ventoinhas) — opcional, só após A1–A3

- [ ] **Pendente (adiado pelo Comandante, ver `docs/PENDENCIAS-POS-V2.md`, item A4):** adicionar `"cooler"` em `Category`, `CATEGORIES`, `AESTHETICS_RELEVANCE` (0,6), fatias (`gpu` −0,02, `cooler` 0,02) e compatibilidade (altura do cooler ≤ `caseMaxCoolerHeight`). Testes em `scoring.test.ts` (fatias somam 1) e `compatibility.test.ts`.

**Critério de aceite do pacote:** `/montar` monta com specs do banco quando configurado; sem banco, igual à V1; peça sem spec gera nota "N peças ignoradas por falta de especificação".

---

## Pacote B — Algoritmo v2

### Tarefa B1: teste de desempenho e de propriedade

**Arquivos:** Testar `src/services/builder/auto-build.test.ts`.

- [x] **Passo 1:** gerar catálogo sintético com 150 peças por categoria (preços e perf aleatórios com semente fixa) e testar: `autoBuild` em < 200 ms; invariantes valem para 200 combinações aleatórias de preferências.
- [x] **Passo 2:** rodar → se falhar por tempo, segue B2; se passar, commit.

### Tarefa B2: otimização global por pares

**Arquivos:** Modificar `auto-build.ts`.

**Interfaces:** assinatura de `autoBuild` inalterada; `BuildSuccess.notes` ganha explicações do tipo "trocamos X por Y para caber Z".

- [x] **Passo 1:** teste `prefere CPU+placa-mãe mais barata em conjunto` (catálogo onde a CPU mais barata exige placa-mãe cara; a soma menor deve vencer).
- [x] **Passo 2:** rodar → falha com o guloso atual.
- [x] **Passo 3:** implementar `cheapestCompatibleBuild` por pares (CPU×placa-mãe, placa-mãe×RAM) e, no passo guloso, avaliar o par CPU+placa-mãe como uma categoria composta.
- [x] **Passo 4:** passa; B1 continua passando. Commit.
  Nota: virou o planejador exato `makePlanner` (montagem mais barata exata) e o par processador +
  placa-mãe em `GREEDY_STEPS`. Na rodada final, o rebaixamento passou a escolher a peça de maior
  utilidade que faz caber (F-02). A otimização global (busca em feixe) é a pendência B-1.

### Tarefa B3: perfil de uso e resolução-alvo

**Arquivos:** Modificar `builder-types.ts` (`BuildPreferences.usage?: "jogos" | "trabalho" | "criacao"`, `resolution?: Resolution`), `scoring.ts`.

- [x] **Passo 1:** teste `perfil criação dá mais peso a CPU e RAM` (fatias cpu ≥ 0,22 e ram ≥ 0,10).
- [x] **Passo 2–4:** falha → `categoryShares(aesthetics, usage)` → passa. Expor na UI (pacote F, F3). Commit.
  Nota: na rodada final, a folga também segue o perfil (`upgradeOrder`: jogos GPU → CPU, criação
  CPU → GPU, trabalho só CPU). A resolução ainda não muda as peças (pendência B-1).

**Critério de aceite:** mesmas invariantes; montagens com total mais perto do alvo em ≥ 80% dos casos sintéticos (relatório no PR).

---

## Pacote C — Confiança de lojas

### Tarefa C1: reputação com motivos

**Arquivos:** Modificar `trust.ts`, `types.ts` (Store: `reclame_aqui_score?: number`, `years_active?: number`, `blocked?: boolean`), Criar `supabase/schema-stores.sql`.

**Interfaces:** Produz `storeTrust(store): { trusted: boolean; reasons: string[] }`; `isTrustedStore` passa a ser `storeTrust(store).trusted`.

- [x] **Passo 1:** testes: loja `blocked` nunca é confiável; oficial + nota ≥ 4,5 + RA ≥ 7 → confiável com motivos ["Loja oficial", "Nota 4,8", "Reclame Aqui 8,2"]; sem RA informado → mantém regra V1.
- [x] **Passo 2–4:** falha → implementar → passa. Commit.
  Nota: a regra final é oficial + nota ≥ 4,5 + Reclame Aqui ≥ 6 quando informado + nunca bloqueada;
  Reclame Aqui ≥ 7 vira motivo. Dados reais de Reclame Aqui são a pendência C-1/C-3.

### Tarefa C2: selo com motivos na UI

- [x] `StoreBadge` recebe `reasons` em `title`/tooltip acessível; `BuildSummary` e `/peca` mostram "por que confiável". Commit.

### Tarefa C3: "preço bom demais"

- [x] Teste em `trust.test.ts`: oferta ≥ 25% abaixo da mediana das lojas confiáveis recebe `suspicious: true`; a UI mostra aviso (Callout warn) quando `trustedOnly` está desligado. Commit.
  Nota: a regra mora em `suspicious.ts`; o Montador nunca recomenda a suspeita em silêncio (só se
  for a única, com aviso), e o "melhor preço", os cards, o histórico e os alertas a pulam.

---

## Pacote D — Benchmarks reais e gráfico

### Tarefa D1: serviço de referências

**Arquivos:** Criar `src/services/references.ts` + teste; Modificar `performance.ts` (recebe `refs` já hoje).

**Interfaces:** `getReferenceBuilds(): Promise<ReferenceBuild[]>` (tabela `reference_builds`; fallback mock). `ReferenceBuild` ganha `source?: string; measuredAt?: string`.

- [x] Teste de fallback; implementar; `app/montar/page.tsx` passa `references` ao `BuilderForm` (coordenar com F). Commit.
  Nota: com Supabase, erro ou tabela vazia devolvem `[]` (nunca o mock) e a tela avisa que não há
  referências.

### Tarefa D2: dataset real

- [x] Montar `supabase/seed-references.sql` com ≥ 10 configurações, FPS por perfil/resolução a partir de
  médias de benchmarks públicos (citar fonte e data em `source`/`measured_at`). Remover a palavra "ilustrativo" dos comentários só depois disso. Commit.
  Nota: são 12 configurações, rotuladas como **estimativa** (parte ilustrativa), com `source` e o
  mês de referência das fontes; benchmarks medidos são as pendências D-1/D-2.

### Tarefa D3: comparáveis dinâmicos

- [x] Teste `closestReferences(score, refs, 3)` devolve as 3 mais próximas; `PerformanceChart` mostra todas, mas o painel destaca "PCs parecidos com o seu" (3) com preço aproximado. Commit.

### Tarefa D4: RAM e upscaling na estimativa

- [x] Teste: 16 GB em "aaa-pesado" aplica −8% nos FPS e gera nota; DLSS/FSR disponível adiciona nota informativa (sem alterar números). Commit.
  Nota: o desconto de memória é proporcional e sem dupla contagem (só quando a montagem tem menos
  memória que as referências vizinhas).

---

## Pacote E — Pagamentos realistas

### Tarefa E1: tabela de juros por loja

**Arquivos:** Modificar `payments.ts`, `builder-types.ts` (`StorePayment.interestTable?: { count: number; total: number }[]`), Criar `supabase/schema-payments.sql` (`store_installments(store_id, count, factor)`).

- [x] **Passo 1:** teste `installmentPlan usa a tabela da loja quando existe` (6x sem juros = total Pix; 12x = Pix × 1,12).
- [x] **Passo 2–4:** falha → implementar (`buildPaymentSummary(parts, tables?)`) → passa. Commit.
  Nota: a regra final usa o preço a prazo como piso: até o número de parcelas anunciado pela oferta
  vale o preço a prazo, acima disso `max(preço a prazo, Pix × fator)`; o máximo de parcelas é o maior
  entre as lojas, com faixas (spec §7).

### Tarefa E2: mistura Pix + parcelado por peça

- [x] Teste `mixedPlan(summary, { cash: 3000, monthly: 400 })` escolhe pagar no Pix as peças mais caras até esgotar `cash` e parcela o resto dentro de `monthly`; devolve `{ pixItems, installmentItems, monthly, months }`. Implementar; UI em `PaymentPlanner` (campos "tenho à vista" e "cabe por mês"). Commit.
  Nota: o Pix vai primeiro para as peças com maior custo evitado no cartão (não só as mais caras);
  a combinação ótima é a pendência E-4.

### Tarefa E3: cupons/cashback (opcional)

- [ ] `applyCoupon(summary, code)` com tabela `coupons`; UI campo de cupom. Commit.
  **Parcial:** `applyCoupon` existe e é testado; a tabela, o serviço e o campo na tela são as
  pendências E-1 e E-3 em `docs/PENDENCIAS-POS-V2.md`.

---

## Pacote F — UI/UX do Montador

### Tarefa F1: `parseMoney` e limites

- [x] Testes em `src/components/builder/parse-money.test.ts` (mover `parseMoney` para `src/lib/money.ts`): "6.000,50" → 6000,5; "" → NaN; 1e12 → erro "valor acima do permitido (R$ 1.000.000)". Implementar. Commit.
  Nota: os testes ficaram em `src/lib/money.test.ts`; "6000.5" vira 6000,5 e o campo mostra como o
  valor foi entendido.

### Tarefa F2: compartilhar e lista de compras

- [x] `src/lib/share.ts`: `encodeBuild(prefs, parts) → string` (base64url dos slugs + prefs) e `decodeBuild`. Teste de ida e volta. `/montar?b=<código>` remonta a tela; botão "Copiar link" e "Baixar lista (CSV)". Commit.

### Tarefa F3: perfil de uso e resolução na tela

- [x] Depende de B3. Segmented control "Jogos / Trabalho / Criação" e "1080p / 1440p"; a tabela de FPS destaca a resolução escolhida. Commit.

### Tarefa F4: estados e acessibilidade

- [x] Skeleton do resultado durante `pending`; foco vai para o resumo após montar; `impeccable audit` e `design:accessibility-review` sem itens críticos; capturas desktop/celular anexadas ao PR. Commit.

---

## Pacote G — Montagens salvas e alertas

### Tarefa G1: salvar montagem

**Arquivos:** Criar `src/services/saved-builds.ts`; Modificar `src/app/account/actions.ts` (`saveBuild(formData)`), `src/app/conta/page.tsx`.

- [x] Teste de serialização (`BuildSuccess` → linha `saved_builds` → de volta a `parts` por `product_id`). Server action exige login; UI: botão "Salvar montagem" no `BuildResultView` (coordenar com F). Commit.

### Tarefa G2: alerta da montagem inteira

- [x] `price_alerts` ganha `saved_build_id`; `/api/check-alerts` compara `total_pix` atual com o alvo; e-mail "sua montagem caiu para R$ X". Teste do cálculo em `services/saved-builds.test.ts`. Commit.

### Tarefa G3: preço de hoje às HH:MM

- [x] `BuildPart.offer.recorded_at` (último ponto de `price_history`); `BuildSummary` mostra a hora. Commit.

---

## Pacote H — Qualidade e operação

### Tarefa H1: e2e com Playwright

- [x] `playwright.config.ts` + `tests/e2e/montar.spec.ts`: abre `/montar`, monta com 6000/7000, confere "Total no Pix" ≤ R$ 7.000, troca para "Parcelado" e confere parcelas; celular (390px) sem overflow horizontal. Script `npm run test:e2e`. Commit.

### Tarefa H2: CI

- [x] `.github/workflows/ci.yml`: `npm ci`, `typecheck`, `lint`, `test`, `build`, `test:e2e` (Chromium). Badge no README. Commit.

### Tarefa H3: coleta agendada e monitor de seletores

- [x] Workflow diário rodando `npm run collect` com segredos; se > 30% das ofertas falharem, abre issue automática "seletor quebrado: <loja>". Commit.
  Nota: o monitor para lojas com poucas ofertas e a concorrência por loja são as pendências H-1 e
  H-2. O job de alertas ganhou o workflow `.github/workflows/alertas.yml` (de hora em hora).

---

## Pendências pós-V2

Tudo o que não foi feito nesta V2 está em [`docs/PENDENCIAS-POS-V2.md`](../../PENDENCIAS-POS-V2.md):
os 21 marcadores `TODO(V2-*)` do código, agrupados por pacote (A, B, C, D, E, G e H), e os itens
adiados pelo Comandante (F-21 catálogo inteiro como prop, F-22 CSP com nonce, SEG-06 deduplicação
de visitas, DAD-01 restrições no banco e A4 categoria cooler). Ao resolver um deles, apague o
marcador no código e a linha naquele arquivo no mesmo commit.

## Auto-revisão do plano

- Cobertura da spec: §4.2 → A; §5 → B; §2/§5.1 lojas → C; §4.3/§6 → D; §7 → E; §3/§8/§9 → F; "salvar/compartilhar" → F2/G; §10 testes → cada tarefa + H.
- Tipos: `PartSpec`, `ReferenceBuild`, `PaymentSummary`, `BuildPreferences` são os nomes da V1 em `src/models/builder-types.ts`; campos novos estão marcados como opcionais para não quebrar a V1.
- Proporção: o plano decide fontes, assinaturas e testes; não transcreve código.
