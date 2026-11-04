# Onda 1: achados dos Porcos-Trufeiros

- Data: 2026-11-04. Repositório: `/home/user/Garimpo-PC`.
- Escopo: `src/` (services, models, app, components), `scripts/`, `supabase/*.sql`, `.github/workflows/`, configuração (`package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.mts`, `eslint.config.mjs`, `.env.example`) e os documentos de referência (`AGENTS.md`, `DESIGN.md`, `PRODUCT.md`, spec e plano V2).
- Somente leitura. Este arquivo é o único escrito. Nenhum comando de git que muda estado foi rodado.

## Método e limites

- **Sub-agentes não foram criados.** O plano pedia cinco sub-agentes Haiku em paralelo (uma chamada `Agent` por área). Nesta sessão a ferramenta `Agent` não existe: a busca por `select:Agent`, `select:Task` e por palavra-chave não encontrou nada, e o que carregou foi `TaskStop`, `SendMessage`, `EnterWorktree` e `SearchSkills`. A inspeção foi feita pelo próprio Porcos-Trufeiros, cobrindo as cinco áreas em sequência. Não houve revisão independente por área.
- **Snapshot.** As leituras foram feitas entre 16:12 e 16:21 UTC. Durante esse período a árvore mudou (commits de A, C, D, E, H e Diagramas). Os números de linha foram conferidos em 16:21 UTC. Quando a linha pode ter mudado, a citação usa o nome da função.
- **Cobertura.** Leitura completa: serviços e lógica do Montador, `models/`, `app/` (páginas, server actions, rota de alertas, proxy), componentes de UI e do Montador, `scripts/collect-prices.mjs`, `supabase/schema.sql`, `supabase/schema-auth.sql`, `supabase/schema-popularity.sql`, `.github/workflows/coleta.yml`, configuração e `estado-exercito.md`. Só por busca de padrões (`grep`): `models/mock-data.ts`, `models/part-specs.ts`, `models/reference-builds.ts`, `models/installment-tables.ts`, `services/references.ts`, `supabase/seed*.sql`, `supabase/schema-builder.sql`, `supabase/schema-payments.sql`, `scripts/collect-specs.mjs`, `scripts/inspect-store.mjs`, `.github/workflows/ci.yml`, `tests/e2e/*`. Esses trechos não foram revisados linha a linha.
- **Evidência coletada (somente leitura):**
  - `npx tsc --noEmit`: às 16:12 deu 4 erros (`suspicious.test.ts` sem `suspicious.ts`; `trust.test.ts` sem `storeTrust`). Às 16:21 deu exit 0.
  - `npx vitest run`: às 16:12 deu 9 testes falhando em 2 arquivos (`trust.test.ts` e `suspicious.test.ts`). Às 16:21 deu 136/136 testes em 13 arquivos.
  - `npx eslint src scripts`: exit 0 nas duas rodadas, sem avisos.
  - Não rodei `build`, `dev`, `install` nem os testes e2e, e não houve conexão com o Supabase. Os custos de desempenho são estimativas por análise, não medições.
- **Arquivos em edição.** No início (16:12): `src/services/specs.test.ts` (pacote A1, sem implementação), `src/services/builder/trust.test.ts` e `src/services/builder/suspicious.test.ts` (pacote C, sem implementação). No fim (16:21): só `docs/diagramas/*.md` estava modificado.

## Legenda

- **Severidade.** *bloqueador*: nenhum achado nesta onda. *alto*: erro de dinheiro ou de segurança, quebra de invariante, ou falha WCAG de nível A em todas as páginas. *médio*: comportamento errado ou risco plausível. *baixo*: consistência, texto ou detalhe.
- **Quem corrige.** Letras A–H são os pacotes do plano V2. "Comandante" é para arquivo fora de pacote ou decisão transversal. Os arquivos que o estado-exercito.md reserva ao Comandante (`builder-types.ts`, `types.ts`, `montar/page.tsx`, `BuilderForm.tsx`, `BuildResultView.tsx`, `BuildSummary.tsx`) entram como **F (onda 2)**.

## Resumo numérico

| Severidade | Quantidade |
|---|---|
| bloqueador | 0 |
| alto | 6 |
| médio | 39 |
| baixo | 23 |
| **total** | **68** |

Por área: Segurança 11 · Lógica do Montador 18 · Dados e schema 5 · Acessibilidade 12 · Desempenho 8 · Consistência 10 · Testes 4.

## Os 10 mais importantes

1. **LOG-01** (alto): `parseMoney("6000.50")` vira 600050 e substitui o teto digitado.
2. **SEG-01** (alto): `/api/check-alerts` fica aberto quando `CRON_SECRET` está vazio, e roda com service_role.
3. **SEG-02** (alto): sem `RESEND_API_KEY`, o alerta é marcado como avisado sem nenhum e-mail enviado.
4. **LOG-02** (alto): a compatibilidade passa quando faltam socket, DDR, formato ou potência, e a invariante do AGENTS.md depende de dados completos.
5. **A11Y-01** (alto): não há link "Pular para o conteúdo" (WCAG 2.4.1, nível A) em nenhuma página.
6. **A11Y-02** (alto): todas as páginas, exceto `/montar`, têm o mesmo título (WCAG 2.4.2, nível A).
7. **LOG-09** (médio): `getPartSpecs()` não está ligado; a montagem usa só o mock, mesmo com o banco configurado.
8. **LOG-05** (médio): o rótulo "Usou a folga" aparece sem nenhuma troca feita.
9. **LOG-17** (médio): nota 4,0–4,4 aparece em verde e com "Confiável", embora o motor de confiança a marque como não confiável.
10. **LOG-03** (médio): uma categoria vinda do banco fora das sete faz o clique em "Montar" falhar sem mensagem.

---

## Segurança (SEG)

**SEG-01 · alto · `src/app/api/check-alerts/route.ts:20`**
- Problema: o segredo é opcional. `if (secret && auth !== ...)` deixa a rota aberta quando `CRON_SECRET` está vazio, e `.env.example:15` deixa a variável vazia. A comparação não é de tempo constante, e a linha 42 devolve `error.message` do banco ao chamador.
- Por que importa: qualquer pessoa dispara um job que usa service_role, envia e-mails e grava `notified_at`.
- Correção: exigir o segredo (erro 500 se ausente), comparar com `timingSafeEqual` e responder com erro genérico.
- Quem: G (G2).

**SEG-02 · alto · `src/services/email.ts:15` + `src/app/api/check-alerts/route.ts:75-80`**
- Problema: sem `RESEND_API_KEY`, `sendEmail` registra "simulado" e devolve `true`. A rota então grava `notified_at`, e o alerta nunca mais é verificado.
- Por que importa: em produção sem a chave, os avisos param de chegar sem nenhum erro visível.
- Correção: fora de desenvolvimento, sem chave, devolver `false` e não marcar `notified_at`.
- Quem: G.

**SEG-03 · médio · `src/services/email.ts:37-40`**
- Problema: `productName`, `price` e `link` entram no HTML sem escape. O `link` vai dentro de `href="..."`.
- Por que importa: um nome com `<` ou `"` altera o e-mail. Os nomes vêm do catálogo e de dados coletados em lojas.
- Correção: escapar `& < > " '` e aceitar só links http(s).
- Quem: G.

**SEG-04 · médio · `src/app/peca/[slug]/page.tsx:111`; `src/components/builder/BuildSummary.tsx` (ButtonLink com `href={offer.url}`); `src/components/ui/Button.tsx:71`**
- Problema: a URL da oferta vai para `href` sem checar o esquema, e aceita `javascript:`.
- Por que importa: hoje a URL vem do seed e da coleta. Se algum dia vier de fonte não confiável, vira script executando na origem do site, onde há sessão do Supabase.
- Correção: função `urlSegura` (só http e https) antes de qualquer `href` de loja.
- Quem: Comandante (ui/Button) e F (BuildSummary, onda 2).

**SEG-05 · médio · `src/services/products.ts:58-69`**
- Problema: o termo de busca entra no filtro `.or()` do PostgREST sem escape. Vírgula ou parêntese quebra o filtro, e o erro é engolido (`return []` na linha 69).
- Por que importa: "RTX 4060, 8GB" mostra "Nenhuma peça encontrada" sem explicação. Termos com vírgula também podem acrescentar condições ao filtro.
- Correção: remover ou escapar `, ( ) %` antes de montar o filtro, e mostrar aviso quando houver erro.
- Quem: Comandante.

**SEG-06 · médio · `src/services/popularity.ts:20-28` e `src/app/peca/[slug]/page.tsx:30`**
- Problema: `registerView` grava com service_role a cada renderização, sem deduplicação, limite ou filtro de bot. A página espera a gravação (`await`, linha 30) antes de buscar o histórico.
- Por que importa: cada recarga infla o ranking "mais procuradas", e a gravação soma uma ida ao banco ao tempo de resposta.
- Correção: deduplicar por sessão ou janela de tempo, limitar a taxa e registrar sem bloquear a renderização.
- Quem: Comandante.

**SEG-07 · médio · `next.config.ts` (arquivo inteiro)**
- Problema: não há `headers()`. Faltam `frame-ancestors` ou `X-Frame-Options`, CSP, `X-Content-Type-Options` e HSTS.
- Por que importa: `/conta` (com logout) e `/entrar` podem ser emoldurados por outro site (clickjacking).
- Correção: `headers()` com `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff` e uma CSP básica.
- Quem: Comandante.

**SEG-08 · baixo · `supabase/schema-popularity.sql:19-25` e `29-37`**
- Problema: `product_views` tem SELECT público (id, product_id, viewed_at). A view `popular_products` roda com o dono e não usa `security_invoker`.
- Por que importa: qualquer pessoa lê o log de visitas. Não há identidade de usuário nesse log, mas a leitura pública não é necessária.
- Correção: restringir o SELECT ao agregado da view.
- Quem: Comandante.

**SEG-09 · baixo · `src/models/supabase-admin.ts:1-24`**
- Problema: o cliente service_role não tem a guarda `import "server-only"`.
- Por que importa: hoje é importado só no servidor. Um import futuro em componente cliente não falha no build.
- Correção: adicionar `import "server-only";` no topo do arquivo.
- Quem: Comandante.

**SEG-10 · baixo · `src/app/account/actions.ts:21-22`**
- Problema: `Number(formData.get("target_price"))` aceita `1e12`. Não há teto superior.
- Por que importa: o alerta dispara na próxima execução, e um valor absurdo fica gravado.
- Correção: teto (por exemplo R$ 1.000.000) com mensagem, como o pacote F1 prevê para o orçamento.
- Quem: G.

**SEG-11 · baixo · `src/app/account/actions.ts:49`**
- Problema: `deleteAlert` não lê o `error` do delete.
- Por que importa: uma falha ao remover aparece como sucesso, e o alerta volta sem explicação.
- Correção: checar `error` e devolver mensagem.
- Quem: G.

## Lógica do Montador (LOG)

**LOG-01 · alto · `src/components/builder/BuilderForm.tsx:24`**
- Problema: `parseMoney("6000.50")` devolve 600050, porque o ponto é tirado como separador de milhar. Se o teto digitado for menor que o alvo, o alvo absurdo substitui o teto (linhas 55-59), e o resultado mostra "Teto R$ 600.050".
- Por que importa: a promessa central é "respeita o orçamento". Um decimal com ponto gera uma montagem dez vezes maior que a pedida, e a tela mostra o valor errado sem aviso.
- Correção: tratar o ponto como milhar só quando seguido de exatamente três dígitos, usar vírgula como decimal e recusar entradas ambíguas com mensagem. Pacote F1, com teste para "6000.50".
- Quem: F (F1, onda 2).

**LOG-02 · alto · `src/services/builder/compatibility.ts:33-41`**
- Problema: cada checagem só roda se os dois campos existem (`cpu.socket && mobo.socket`, `mobo.ramType`, `gabinete.caseSupports && mobo.formFactor`, `psu.wattage !== undefined`). Uma spec sem esses campos passa como compatível. Em `specs.ts:48-57` os campos nulos viram ausentes.
- Por que importa: a invariante "peças sempre compatíveis" (AGENTS.md) só vale com dados completos, e nada no código garante isso.
- Correção: exigir os campos obrigatórios por categoria antes da montagem. Spec incompleta fica de fora, com nota "N peças ignoradas por dados incompletos".
- Quem: A (validação) e B.

**LOG-03 · médio · `src/services/builder/auto-build.ts:64` e `src/services/specs.ts:43-44`**
- Problema: `out[spec.category].push(...)` lança TypeError quando a categoria do banco não é uma das sete (por exemplo "GPU" ou "gpu "). `rowToPartSpec` faz `as Category` sem validar, como o próprio TODO da linha 43 admite. O banco também não tem CHECK em `products.category`.
- Por que importa: o clique em "Montar meu PC" não produz resultado, e o erro some no handler.
- Correção: validar contra a lista de categorias em `rowToPartSpec`, e transformar categoria inválida em nota.
- Quem: A.

**LOG-04 · médio · `src/services/builder/auto-build.ts:61`**
- Problema: `if (!spec) continue;` descarta produto sem spec sem registrar nada.
- Por que importa: o critério do pacote A ("N peças ignoradas por falta de especificação") não existe. A pessoa não sabe por que uma peça sumiu.
- Correção: contar as peças ignoradas e acrescentar a nota em `notes`.
- Quem: A.

**LOG-05 · médio · `src/services/builder/auto-build.ts:310` (rótulo em `BuildResultView`, "Usou a folga")**
- Problema: `usedWiggleRoom: totalPix > budget.target` fica verdadeiro sem nenhuma troca, por exemplo quando a passada gulosa já passou do alvo ou quando entra o fallback mais barato. A spec §5.4 pede que o campo seja verdadeiro só se uma troca foi aceita.
- Por que importa: a tela diz "Usou a folga" quando a folga não foi usada.
- Correção: `usedWiggleRoom = up.upgrades.length > 0 && totalPix > budget.target`.
- Quem: B.

**LOG-06 · médio · `src/services/builder/auto-build.ts:285` e `205-208`**
- Problema: `ganho = perf_to / perf_from - 1` divide por perf zero, e a nota sai "+Infinity% de desempenho". O critério de 10% usa utilidade, que mistura estética, então uma troca por estética pode sair com nota "+-12% de desempenho" ou "+0%". Se `utility(atual)` é zero, `minimo` vira zero e qualquer candidato é aceito sem ganho.
- Por que importa: a nota promete desempenho que não existe, e a regra "folga só com ganho de 10%" (spec §10) não aparece na nota.
- Correção: calcular a nota com a mesma métrica do critério, proteger a divisão e exigir `utility(atual) > 0`.
- Quem: B.

**LOG-07 · médio · `src/services/builder/auto-build.ts:92-97`**
- Problema: `cheapestCompatibleBuild` copia e ordena cada categoria a cada par CPU × GPU (`[...cands[cat]].sort(byPrice)` dentro dos dois laços). Com 150 peças por categoria, o cenário do pacote B1, são cerca de 22.500 pares com 5 ordenações de 150 itens cada, ou seja, da ordem de 10^8 comparações. Estimativa por análise, não medida.
- Por que importa: o limite de 200 ms do pacote B provavelmente não passa, e a tela trava no navegador.
- Correção: ordenar cada categoria uma vez, fora dos laços, e buscar o primeiro compatível.
- Quem: B.

**LOG-08 · médio · `src/components/builder/BuilderForm.tsx:24`, `src/services/builder/budget.ts` (`normalizeBudget`), `src/app/montar/page.tsx:17-20`**
- Problema: não há limite superior. Um valor de 1e12, vindo da URL `?teto=` ou digitado, passa, e a montagem roda com bilhões de folga e mostra "Usou a folga" sem aviso.
- Por que importa: uma entrada absurda gera um resultado absurdo sem mensagem. O pacote F1 prevê um limite de R$ 1.000.000.
- Correção: limite com mensagem em `parseMoney` e `numero()`, e na normalização do orçamento.
- Quem: F (F1).

**LOG-09 · médio · `src/components/builder/BuilderForm.tsx:10` e `67`; `src/app/montar/page.tsx`**
- Problema: `autoBuild` recebe `PART_SPECS` do mock. `getPartSpecs()` existe em `src/services/specs.ts`, mas a página não o chama e o formulário não recebe `specs`. É a pendência do passo 4 do pacote A1.
- Por que importa: com o banco configurado, a montagem continua usando as specs ilustrativas. O critério de aceite do pacote A ("monta com specs do banco quando configurado") não é cumprido.
- Correção: a página chama `await getPartSpecs()` e passa `specs` ao `BuilderForm`. Coordenar com F.
- Quem: A (passo 4 do A1), com F.

**LOG-10 · médio · `src/services/builder/payments.ts:84-85`**
- Problema: `offer.price_installment ?? offer.price_pix` não trata zero como ausente. Um parcelado zero vira total parcelado zero.
- Por que importa: o plano pode mostrar "Parcelado R$ 0,00" e a economia do Pix sai errada. Dado ruim da coleta chega à tela.
- Correção: tratar `price_installment <= 0` como ausente, usando a mesma regra de `precoValido`.
- Quem: E (com A na validação de entrada).

**LOG-11 · médio · `src/components/builder/PaymentPlanner.tsx:88-89` e `145`; `src/services/builder/payments.ts:69` e `148`**
- Problema: o plano mostra "Nx de R$ X", mas com lojas de prazos diferentes X soma a primeira parcela de cada loja. Quando uma loja termina, o valor muda e a tela não avisa. Além disso, `round2(total / n)` não fecha: `n` vezes a parcela pode diferir do total em centavos.
- Por que importa: a pessoa lê um valor fixo que não é fixo, e o total parcelado não bate com a parcela.
- Correção: mostrar o plano de cada loja com o seu prazo, e distribuir o resto dos centavos nas primeiras parcelas.
- Quem: E.

**LOG-12 · médio · `src/services/builder/mixed-plan.ts:84`, `src/services/builder/payments.ts:142`, `src/components/builder/PaymentPlanner.tsx:52`**
- Problema: `installment_count` não tem teto. Um valor de 1000000 faz o laço de `mixedPlan` rodar um milhão de vezes, e o `Array.from` monta um `<select>` com um milhão de opções.
- Por que importa: um dado ruim trava o navegador da pessoa.
- Correção: limitar as parcelas (por exemplo a 24) ao ler do banco e na entrada.
- Quem: E (com A).

**LOG-13 · baixo · `src/services/builder/coupons.ts:44-45` e `src/services/products.ts:123`**
- Problema: datas em UTC (`toISOString().slice(0, 10)`). O cupom deixa de valer às 21:00 de Brasília no último dia, contra o comentário da linha 44 ("vale o dia inteiro"). O histórico agrupa preços de 21:00 a 24:00 de Brasília no dia seguinte. A coleta roda às 03:00 de Brasília, então o efeito hoje é pequeno.
- Correção: calcular o dia em `America/Sao_Paulo`.
- Quem: E (cupom) e Comandante (histórico).

**LOG-14 · médio · `src/services/builder/performance.ts:46-47`**
- Problema: `(menor.fps[p][r] * score) / menor.score` e `/ maior.score` dividem pelo score da referência. Se uma referência tem score zero e a montagem também tem score zero, o FPS vira 0/0, ou seja, NaN.
- Por que importa: hoje as referências são fixas e maiores que zero. O pacote D1 vai ler do banco, onde zero é possível.
- Correção: validar as referências (score finito e maior que zero) e tratar o caso.
- Quem: D.

**LOG-15 · médio · `src/services/builder/performance.ts:43-44` e `closestReference` (linhas 61-63)**
- Problema: com lista vazia, `ordenadas[0]` é `undefined`, e `closestReference` lança TypeError porque o `reduce` não tem valor inicial.
- Por que importa: hoje a estimativa recebe sempre o mock. Quando o D1 ligar o banco, uma tabela vazia derruba a tela de resultado.
- Correção: fallback para o mock (D1) e guarda de lista vazia com nota.
- Quem: D.

**LOG-16 · médio · `src/services/specs.ts:45` e `interpolateFps` em `src/services/builder/performance.ts`**
- Problema: `perf: Number(row.perf)` produz NaN para texto inválido. Com NaN, `interpolateFps` não cai em nenhum ramo de comparação e chega ao final, que devolve o FPS de `maior`. A estimativa mostra o FPS da referência mais forte sem aviso, e `closestReference` devolve sempre a primeira referência.
- Por que importa: o número exibido é falso, e a pessoa não tem como saber.
- Correção: validar `perf` como finito e maior que zero na conversão, descartando a peça com nota.
- Quem: A (com D).

**LOG-17 · médio · `src/services/builder/trust.ts:44-52`; `StoreBadge.tsx` (função `tomDaNota`); `src/lib/format.ts:29-34` (`trustLabel`)**
- Problema: nota entre 4,0 e 4,49 aparece em verde (`tomDaNota`, a partir de 4) e com o rótulo "Confiável" (`trustLabel`, a partir de 4). Mas `storeTrust` marca a loja como não confiável (abaixo de 4,5), e o motivo diz "abaixo de 4,5". São três limiares diferentes para a mesma ideia.
- Por que importa: o diferencial anti-golpe fica contraditório na mesma tela.
- Correção: uma só constante (`TRUSTED_MIN_RATING`) para cor, rótulo e motivo.
- Quem: C.

**LOG-18 · médio · `src/lib/format.ts:20-26` (`getBestOffer`); `src/services/products.ts:125-126`; `src/app/api/check-alerts/route.ts:57-59`**
- Problema: fora do montador, preço zero ou negativo não é descartado. `getBestOffer`, usado na página da peça, nos cards e na home, pode mostrar "Melhor preço R$ 0,00". O histórico usa zero como menor preço. O alerta usa `Math.min` e dispara com zero.
- Por que importa: a validação do pacote A2 só vale para o montador (`precoValido` em `trust.ts:78`).
- Correção: um único helper de oferta válida, usado em todos esses pontos.
- Quem: Comandante (format e products) e G (route).

## Dados e schema (DAD)

**DAD-01 · médio · `supabase/schema.sql:9, 20, 27-36`**
- Problema: não há CHECK (`price_pix > 0`, `installment_count >= 1`, `category` restrita a um conjunto) e não há `unique (product_id, store_id)`. A mesma loja pode aparecer duas vezes numa peça.
- Por que importa: a validação em código é a única defesa. Uma escrita direta, ou um bug da coleta, entra no banco e aparece na tela.
- Correção: migração com as constraints e um teste de inserção inválida.
- Quem: Comandante (A para `schema-builder`).

**DAD-02 · médio · `src/services/products.ts:25-39` (sem `.range`) e `scripts/collect-prices.mjs:128`**
- Problema: as consultas não paginam. O PostgREST devolve no máximo 1000 linhas por padrão.
- Por que importa: com mais de 1000 ofertas, catálogo e coleta ficam truncados sem aviso.
- Correção: paginar com `.range` ou checar a contagem e avisar.
- Quem: Comandante (products) e H (coleta).

**DAD-03 · médio · `src/services/products.ts:36`, `69`, `115`; ramo de erro de `src/services/specs.ts`; `src/services/installments.ts:46`**
- Problema: política de fallback inconsistente. Erro em `products` vira lista vazia, e a tela mostra "Catálogo vazio". Erro em `specs` vira o mock. Erro em juros vira `{}`. Só o último está documentado.
- Por que importa: a mesma falha de banco aparece de três formas, e quem mantém o código não sabe qual regra vale.
- Correção: registrar a regra no AGENTS.md (erro vira vazio com aviso, ou mock só em demonstração) e aplicá-la.
- Quem: Comandante.

**DAD-04 · médio · `src/app/api/check-alerts/route.ts:33-39` e `48-83`**
- Problema: a consulta de alertas não tem limite. O laço é sequencial, com uma chamada de auth e um e-mail por alerta.
- Por que importa: com volume, a execução passa do tempo máximo da função, e os alertas do fim ficam sem verificar.
- Correção: processar em lotes (`range`) com concorrência limitada.
- Quem: G.

**DAD-05 · médio · `src/app/conta/page.tsx:28` e `src/app/api/check-alerts/route.ts:38-39`**
- Problema: um alerta já disparado (`notified_at` preenchido) continua com `is_active = true` e aparece como "avisar quando custar até R$ X", mas a rota nunca mais o verifica.
- Por que importa: a pessoa acha que está monitorada e não está.
- Correção: mostrar "avisado em DD/MM" e desativar, com opção de reativar.
- Quem: G.

## Acessibilidade (A11Y)

**A11Y-01 · alto · `src/app/layout.tsx:23-26`**
- Problema: não há link "Pular para o conteúdo", e o `<main>` não tem id.
- Por que importa: falha de WCAG 2.4.1 (nível A). Em todas as páginas, quem usa teclado ou leitor de tela percorre o cabeçalho inteiro (logo, dois links, busca, conta) antes do conteúdo.
- Correção: link focalizável no topo do body apontando para `#conteudo`, com o mesmo id no `<main>`.
- Quem: Comandante.

**A11Y-02 · alto · `src/app/page.tsx`, `busca/page.tsx`, `entrar/page.tsx`, `conta/page.tsx`, `peca/[slug]/page.tsx` (sem `metadata`)**
- Problema: só `montar/page.tsx` exporta título. As demais páginas herdam o título padrão do layout, "GarimpoPC — monte e compare seu PC gamer pelo preço certo".
- Por que importa: falha de WCAG 2.4.2 (nível A). Abas, histórico e leitores de tela mostram o mesmo nome em todas as páginas.
- Correção: `export const metadata` com título próprio em cada página, ou `generateMetadata` nas páginas de peça.
- Quem: Comandante.

**A11Y-03 · médio · `src/components/ui/Field.tsx:22-32` e `MoneyInput` (linhas 47-64)**
- Problema: a dica e a mensagem de erro não estão ligadas ao campo. Falta `id` e `aria-describedby`. `aria-invalid` existe, mas não aponta para o texto.
- Por que importa: ao focar um campo com erro, o leitor de tela não lê a causa.
- Correção: `id` na dica e no erro, e `aria-describedby` no input.
- Quem: F (F4).

**A11Y-04 · médio · `src/components/builder/BuilderForm.tsx:125`**
- Problema: `aria-live="polite"` envolve o resultado inteiro (tabelas, gráfico, pagamento). Não há foco no resumo depois de montar (pacote F4).
- Por que importa: cada montagem é lida de uma vez, sem hierarquia, e o foco não acompanha o resultado.
- Correção: live region só no cabeçalho do resultado (total e situação), e mover o foco para ele.
- Quem: F (F4).

**A11Y-05 · médio · `src/components/builder/PerformanceChart.tsx:68` (contêiner do gráfico); `src/components/PriceHistoryChart.tsx:37`; `src/components/builder/PerformancePanel.tsx:98-99`**
- Problema: os gráficos não têm `role="img"` nem resumo. A tabela de referências fica dentro de um `<details>` fechado. O histórico de preços não tem tabela alternativa.
- Por que importa: falha de WCAG 1.1.1. A spec §6 exige a versão textual, e no histórico ela não existe.
- Correção: `role="img"` com `aria-label` de resumo, e tabela visível (ou sr-only) como texto alternativo.
- Quem: D (PerformanceChart e Panel) e Comandante (PriceHistoryChart).

**A11Y-06 · baixo · `src/components/ui/Toggle.tsx:23-31`**
- Problema: a descrição do switch não está ligada ao botão `role="switch"`.
- Correção: `id` na descrição e `aria-describedby` no botão.
- Quem: F.

**A11Y-07 · baixo · `src/components/builder/PaymentPlanner.tsx:126-129`; `src/components/builder/PerformancePanel.tsx:103-106`**
- Problema: 13 `<th>` sem `scope`, e as três tabelas do código não têm `<caption>`.
- Correção: `scope="col"` nos cabeçalhos e caption (sr-only) em cada tabela.
- Quem: F (PaymentPlanner e Panel, nas ondas de F, D e E).

**A11Y-08 · baixo · `src/components/ui/Button.tsx:71`**
- Problema: o link externo abre em nova aba sem aviso textual. O ícone é `aria-hidden`.
- Correção: texto sr-only "(abre em nova aba)".
- Quem: F.

**A11Y-09 · baixo · `src/components/SiteHeader.tsx:16-30`**
- Problema: a navegação não marca a página atual com `aria-current="page"`.
- Quem: Comandante.

**A11Y-10 · baixo · `src/app/conta/page.tsx:77`**
- Problema: vários botões "Remover" têm o mesmo nome, sem indicar qual alerta.
- Correção: `aria-label` com o nome da peça.
- Quem: G.

**A11Y-11 · baixo · `src/components/StoreBadge.tsx:33`, `42`, `47`**
- Problema: os motivos e os rótulos de confiança ficam só em `title`. Tooltip não funciona bem no toque e não é lido de forma confiável.
- Correção: texto visível ou sr-only, com `title` só como complemento.
- Quem: C (C2).

**A11Y-12 · baixo · `src/components/ui/Slider.tsx:50-53`**
- Problema: "Desempenho" e "Estética" são spans sem vínculo com o controle. `aria-valuetext` existe, mas os rótulos das pontas não são associados.
- Correção: `aria-describedby` apontando para os rótulos.
- Quem: F.

## Desempenho (PERF)

**PERF-01 · médio · `src/app/montar/page.tsx:24` e `46`; `src/components/builder/BuilderForm.tsx:10`; `src/components/builder/PerformancePanel.tsx:6`**
- Problema: o catálogo inteiro (produtos, ofertas, lojas) vai como prop para o cliente. `PART_SPECS` e `REFERENCE_BUILDS` entram no bundle de `/montar`. Recharts entra no bundle de `/peca` e de `/montar`.
- Por que importa: mais JavaScript e mais dados do que a tela usa. Em rede móvel, o primeiro uso fica lento.
- Correção: enviar só o necessário (ou calcular no servidor) e carregar o gráfico com import tardio.
- Quem: F (montar/page) e D.

**PERF-02 · médio · `src/app/layout.tsx:24`; `src/components/SiteHeader.tsx:33`; `src/models/supabase-server.ts:42-49`**
- Problema: com o Supabase configurado, `getCurrentUser` chama `cookies()` no cabeçalho do layout, o que torna todas as rotas dinâmicas. O projeto não tem nenhum `dynamic`, `revalidate` ou cache.
- Por que importa: home, busca e página de peça consultam o banco a cada visita, mesmo quando o conteúdo é público.
- Correção: tirar a sessão do cabeçalho e carregá-la num componente cliente, para que o catálogo fique estático ou com revalidate.
- Quem: Comandante.

**PERF-03 · médio · `src/proxy.ts:35`; `src/components/SiteHeader.tsx:33`**
- Problema: cada navegação chama duas vezes o Supabase Auth (`getUser` no proxy e `getCurrentUser` no cabeçalho). O matcher do proxy também cobre `/api`.
- Por que importa: latência extra em toda página.
- Correção: uma única verificação de sessão por requisição, com o resultado repassado.
- Quem: Comandante.

**PERF-04 · médio · `src/app/busca/page.tsx:14`; `src/services/products.ts:25-39` e `45-72`**
- Problema: "Todas as peças" e a busca renderizam o catálogo inteiro, sem paginação.
- Por que importa: com centenas de peças, como prevê o plano, a página fica pesada.
- Correção: `limit` e `offset` no servidor, com paginação na tela.
- Quem: Comandante.

**PERF-05 · médio · `scripts/collect-prices.mjs:57`, `65`, `69`, `187`; `.github/workflows/coleta.yml:40`**
- Problema: espera fixa de 3,5 s em cada adaptador, mais pausa de 4 s por oferta, tudo em sequência. São cerca de 8 s por oferta. Com `timeout-minutes: 120`, o job cabe em cerca de 900 ofertas.
- Por que importa: o tempo cresce de forma linear e o job pode estourar o limite sem aviso.
- Correção: `waitForSelector` no lugar do sleep e concorrência limitada por loja, mantendo a pausa por domínio.
- Quem: H.

**PERF-06 · médio · `scripts/collect-prices.mjs:175-176`**
- Problema: `update` e `insert` no Supabase não lêem o `error`. A coleta conta como sucesso mesmo sem gravar.
- Por que importa: o histórico de preços para sem aviso, e o workflow continua verde.
- Correção: ler `{ error }`, contar como falha e encerrar com código de erro se a gravação falhar.
- Quem: H.

**PERF-07 · baixo · `src/components/builder/BuilderForm.tsx:66-69` e `125-135`**
- Problema: `autoBuild` roda de forma síncrona dentro de `startTransition`, então o estado `pending` não tem trabalho assíncrono para sinalizar. Além disso, cada tecla ou movimento do slider re-renderiza o resultado com Recharts, porque `BuildResultView` não é memoizado.
- Correção: `React.memo` no resultado. Avaliar Worker se o cálculo passar de 200 ms.
- Quem: F (e B para o Worker).

**PERF-08 · baixo · `package.json:23`**
- Problema: `playwright`, que é ferramenta do coletor, está em `dependencies` de produção.
- Correção: mover para `devDependencies` ou para um pacote separado do coletor.
- Quem: Comandante.

## Consistência (CON)

**CON-01 · médio · `src/services/email.ts:35` e `40`; `src/app/api/check-alerts/route.ts:71`**
- Problema: o e-mail de alerta ainda usa o tema antigo (`#7c5cff`, roxo) e o emoji ⛏️ no título e no assunto. O DESIGN.md manda usar o ouro (`#f0b43a`) e não usar emoji como ícone.
- Correção: usar os tokens do DESIGN.md e remover o emoji.
- Quem: G (G2).

**CON-02 · baixo · `src/models/categories.ts:7-13`**
- Problema: o campo `emoji` das sete categorias não é lido em nenhum lugar do código. É resíduo do tema anterior.
- Correção: remover o campo.
- Quem: Comandante.

**CON-03 · baixo · `src/components/SiteHeader.tsx:45`**
- Problema: `backdrop-blur-sm` (efeito de vidro) vai contra o DESIGN.md ("sem vidro/blur decorativo") e o AGENTS.md.
- Correção: fundo sólido (`bg-base`).
- Quem: Comandante.

**CON-04 · médio · `src/models/types.ts:5`; `src/models/categories.ts:6-14`; `src/services/builder/auto-build.ts:36`, `38`, `48-50`; `src/services/builder/scoring.ts:12-20` e `37-42`; `src/components/CategoryIcon.tsx:6-14`**
- Problema: a lista das sete categorias está repetida em cinco arquivos, e as ordens de escolha e de exibição são listas à parte. O TypeScript pega parte dos `Record`, mas não pega `PICK_ORDER`, `DISPLAY_ORDER` nem `CATEGORIES`.
- Por que importa: adicionar `cooler` (pacote A4) obriga a editar tudo à mão, e é fácil deixar uma categoria de fora.
- Correção: uma fonte única (por exemplo `CATEGORY_CODES` em `categories.ts`), derivada pelos demais arquivos.
- Quem: A (A4) e Comandante.

**CON-05 · baixo · `src/models/supabase.ts:4-5`; `src/models/supabase-server.ts:4`; `supabase/schema.sql:3`; `src/models/types.ts:4`; `src/services/popularity.ts:34`; `package.json:2`**
- Problema: comentários e metadados desatualizados. `isStorageConfigured()` não existe (a função é `isSupabaseConfigured`). `src/lib/data.ts`, `src/lib/supabase.ts` e `src/lib/types.ts` não existem. "Por enquanto focamos em GPU" está errado, porque são sete categorias. O comentário de `popularity.ts` diz "marca como destaque", mas o código só corta a lista. O `name` do `package.json` é `comparador-app`.
- Correção: atualizar os textos e o nome.
- Quem: Comandante.

**CON-06 · baixo · `src/app/auth/actions.ts:11`, `26`, `41`; `src/app/account/actions.ts:16`, `44`**
- Problema: identificadores em inglês (`login`, `signup`, `logout`, `createAlert`, `deleteAlert`) em código de domínio, enquanto o AGENTS.md (linha 31) pede português.
- Correção: decidir a convenção e registrá-la no AGENTS.md.
- Quem: Comandante.

**CON-07 · baixo · `src/models/categories.ts:40`**
- Problema: o casamento por substring vai nos dois sentidos (`a.includes(q) || q.includes(a)`). "hdmi" casa com SSD, porque contém "hd". "memória de vídeo" casa com RAM, porque contém "memória".
- Correção: casar por palavra inteira ou prefixo.
- Quem: Comandante.

**CON-08 · baixo · `src/components/ui/Field.tsx:38`**
- Problema: os campos usam `focus:ring-2 focus:ring-brand/30` (anel a 30%). O DESIGN.md pede o anel `brand` sólido de 2px no foco visível.
- Correção: usar `focus-visible` com o anel sólido do DESIGN.md.
- Quem: F.

**CON-09 · baixo · `src/components/builder/BuilderForm.tsx:119`; `src/app/auth/actions.ts:37`**
- Problema: textos prometem mais do que o dado garante. "Os preços são os de hoje, no Pix." não tem data, e a hora do preço é o pacote G3, ainda não feito. "Conta criada! Você já pode entrar." aparece mesmo quando o Supabase exige confirmação, como o comentário da linha 36 admite.
- Correção: mostrar a data da última coleta, e tornar a mensagem de cadastro condicional à resposta do Supabase.
- Quem: F/G e Comandante.

**CON-10 · baixo · constantes `COR` em `src/components/PriceHistoryChart.tsx` e `src/components/builder/PerformanceChart.tsx`**
- Problema: cores do gráfico em hex, repetidas em dois arquivos e fora dos tokens do `globals.css`.
- Correção: ler os tokens (variáveis CSS) a partir de um único módulo.
- Quem: D e Comandante.

## Testes (TST)

**TST-01 · médio · `src/services/builder/payments.test.ts` (faltando) e `src/services/builder/payments.ts:84-85`**
- Problema: não há teste para `installment_count` zero ou negativo, nem para `price_installment` zero.
- Por que importa: a regra "contagem zero vira um" (plano do pacote A) não está protegida.
- Correção: testes de regressão para esses casos.
- Quem: A e E.

**TST-02 · médio · `src/services/builder/performance.test.ts` (faltando)**
- Problema: não há casos com score zero, perf NaN ou lista de referências vazia (LOG-14, LOG-15 e LOG-16).
- Quem: D.

**TST-03 · médio · `src/services/builder/auto-build.test.ts` (faltando)**
- Problema: não há casos de catálogo vazio, de peça sem spec com nota (LOG-04), de categoria desconhecida (LOG-03) nem de tempo (plano B1).
- Quem: A e B.

**TST-04 · baixo · `src/components/builder/parse-money.test.ts` (ainda não existe)**
- Problema: a entrada "6000.50" não está coberta, então LOG-01 passaria sem ser notada. O pacote F1 prevê o arquivo e deve incluir esse caso.
- Quem: F (F1).
