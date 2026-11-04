# Onda 2: achados dos Porcos-Trufeiros 2

- Data: 2026-11-04. Repositório: `/home/user/Garimpo-PC`. Checkpoint inspecionado: `HEAD = 02772e9` (onda 2 integrada). Árvore sem alterações (`git status` limpo).
- Escopo: `src/` (app, components, models, lib, services), `scripts/`, `supabase/*.sql`, `tests/`, `.github/workflows/`, configurações (`package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.mts`, `eslint.config.mjs`, `playwright.config.ts`, `.env.example`, `.impeccable/config.json`) e documentos (`AGENTS.md`, `DESIGN.md`, `PRODUCT.md`, `README.md`, spec, plano, `docs/*.md`, `docs/diagramas/*.md`).
- Somente leitura. Este arquivo é o único escrito. Só comandos de git que não mudam estado (`status`, `log`, `diff`, `show`).

## Método e limites

- Sub-agentes não foram criados: a ferramenta `Agent` não existe neste ambiente. As cinco áreas foram inspecionadas pelo próprio Porcos-Trufeiros 2, em sequência, com leitura linha a linha (`cat -n`, `sed -n`, `grep`). Não houve revisão independente por área.
- Evidência rodada nesta sessão: `npx tsc --noEmit` (exit 0), `npx eslint src scripts tests` (exit 0), `npx vitest run` (21 arquivos, 376/376). Não rodei build, dev, start, install nem e2e (regra da tarefa).
- Sondas fora do repositório (no scratchpad, sem tocar no repo): `categoriesMatching` (CON-07), `parseMoney` (LOG-01) e o teste de tempo do Montador com `--reporter=verbose` (PERF-07, TST-N1).
- Números de produção (coleta, alertas, histórico) são estimativas por análise e aparecem marcados como tal.
- Origem dos achados: `(regressão)` = criado ou alterado pelas ondas 1 e 2 (conferido com `git diff --name-status e709af0..HEAD` e `git show e709af0:<arquivo>`); `(reincidente)` = já estava em `onda1-trufas.md` e continua aberto ou parcial; `(novo)` = já existia no checkpoint `e709af0` e não estava em `onda1-trufas.md`.

## Legenda

- Severidade: bloqueador, alto, médio, baixo (mesma escala da onda 1). Nesta inspeção não há bloqueador.
- Estado dos ids da onda 1: RESOLVIDO, PARCIAL, ABERTO (tabela no fim do arquivo).
- Cada achado traz `arquivo:linha`, severidade, rótulo, problema, por que importa e correção.

## Os 10 mais importantes

1. **DAD-02** (alto): o histórico de preço corta os pontos mais recentes ao passar de 1.000 linhas por consulta.
2. **DAD-03** (médio): as referências de desempenho caem no mock quando o banco falha ou está vazio, contra o AGENTS.md.
3. **LOG-N1** (médio): o job de alertas nunca avalia os alertas depois do 5.000º enquanto houver 5.000 pendentes antes deles.
4. **PERF-05** (médio): a coleta pode estourar os 120 min antes de gravar `coleta-resultado.json`, e a issue de seletor quebrado nunca abre.
5. **SEG-02** (médio): em produção sem `RESEND_API_KEY`, o job responde 200 e nenhum e-mail sai.
6. **CON-N3** (médio): nada no repositório agenda `/api/check-alerts`, e o README não diz isso.
7. **CON-N11** (médio): `seed.sql` (histórico "de exemplo") fica fora da lista de seeds só para demonstração.
8. **LOG-N3** (médio): a compatibilidade não cobre comprimento da GPU, cooler, M.2 e formato da fonte, mas o AGENTS.md diz "sempre compatíveis".
9. **SEG-N1** (médio): `/entrar` mostra texto livre vindo da URL, dentro do domínio do site.
10. **A11Y-02** (médio): `/conta` continua sem título próprio (WCAG 2.4.2, nível A, em uma página).

---

## Segurança (SEG)

**SEG-02 · médio · (reincidente, parcial) · `src/services/email.ts:27-31`; `src/app/api/check-alerts/route.ts:136-141, 231`**
- Problema: a metade da correção que não marca `notified_at` foi feita. A outra metade, devolver falha fora de desenvolvimento sem `RESEND_API_KEY`, não foi: `sendEmail` devolve `ok: true, simulated: true`, e a rota responde HTTP 200 com o contador `simulados`.
- Por que importa: em produção sem a chave, o agendador vê sucesso e nenhum e-mail sai. O único sinal é um log e um contador.
- Correção: fora de desenvolvimento, sem a chave, responder erro com a contagem (ou tratar `simulated` como falha).

**SEG-06 · médio · (reincidente) · `src/app/peca/[slug]/page.tsx:52`; `src/services/popularity.ts:25-33`**
- Problema: `registerView` é aguardado a cada renderização da página, com a chave de serviço, sem deduplicação, limite de taxa nem filtro de bot.
- Por que importa: cada recarga e cada bot infla o ranking "mais procuradas" e soma uma gravação ao tempo de resposta. A tabela `product_views` cresce sem limite (ver PERF-N1).
- Correção: deduplicar por sessão ou janela de tempo e registrar sem `await`.

**SEG-07 · baixo · (reincidente, parcial) · `next.config.ts:5-12, 23-24`**
- Problema: foram acrescentados `X-Frame-Options`, `X-Content-Type-Options` e `frame-ancestors`. Faltam HSTS (não está no código; pode vir da hospedagem, não verificado) e uma CSP de scripts: a única CSP é `frame-ancestors 'none'`.
- Por que importa: sem HSTS e sem CSP de scripts, a proteção contra downgrade e injeção depende só do que a hospedagem fizer.
- Correção: acrescentar `Strict-Transport-Security` e uma CSP com `default-src 'self'`, validada no e2e.

**SEG-08 · baixo · (reincidente) · `supabase/schema-popularity.sql:23-25, 29-37`**
- Problema: `product_views` tem leitura pública de todas as colunas, e a view `popular_products` não usa `security_invoker`, então roda com o dono do objeto.
- Por que importa: qualquer pessoa lê o log de visitas por peça.
- Correção: revogar o SELECT público de `product_views`; a view agregada passa a ser o único caminho de leitura.

**SEG-09 · baixo · (reincidente) · `src/models/supabase-admin.ts:1-8`**
- Problema: o cliente com `service_role` não tem `import "server-only"`. O pacote `server-only` não está nas dependências e nenhum arquivo o usa.
- Por que importa: um import futuro em componente cliente põe a chave de serviço no bundle sem falhar no build.
- Correção: adicionar `server-only` às dependências e `import "server-only";` no topo do arquivo.

**SEG-N1 · médio · (novo) · `src/app/entrar/page.tsx:29-30, 50-59`**
- Problema: os parâmetros `erro` e `mensagem` da URL são exibidos como texto livre num `Callout`. Um link `/entrar?erro=...` mostra a frase que o autor quiser, dentro do domínio do site.
- Por que importa: é um vetor de phishing no domínio legítimo. `src/app/account/actions.ts:19` diz que "a URL nunca carrega texto livre para a tela", e `/conta` segue essa regra; `/entrar` não.
- Correção: trocar o texto por código (por exemplo `?erro=credenciais`) com um mapa de avisos, como em `/conta`.

**SEG-N2 · baixo · (novo) · `src/app/auth/actions.ts:79`**
- Problema: "Este e-mail já está cadastrado." revela se a conta existe.
- Por que importa: permite enumerar e-mails cadastrados pela tela de cadastro, sem limite nesta aplicação.
- Correção: mensagem genérica no cadastro e limite de taxa no provedor de autenticação.

**SEG-N3 · baixo · (novo) · `src/services/email.ts:29`**
- Problema: no modo simulado, o e-mail da pessoa vai para o log do servidor (`para=${to}`).
- Por que importa: dado pessoal em log de produção, sem necessidade.
- Correção: registrar só o id do alerta, como já faz `route.ts:138`.

**SEG-N4 · baixo · (regressão) · `.github/workflows/ci.yml:37`; `.github/workflows/coleta.yml:44`**
- Problema: `actions/checkout@v4` sem `persist-credentials: false`, e as ações estão fixadas em tag (`@v4`, `@v7`), não em SHA. A coleta roda `npm ci` e um navegador com o token gravado no `.git`, e tem `issues: write`.
- Por que importa: uma dependência comprometida no job teria acesso ao token do checkout durante a execução.
- Correção: `persist-credentials: false` nos dois checkouts e ações fixadas por SHA.

## Acessibilidade (A11Y)

**A11Y-02 · médio · (reincidente, parcial) · `src/app/conta/page.tsx:78`**
- Problema: `/conta` não exporta `metadata`, então herda o título padrão do layout. As outras seis páginas já têm título próprio.
- Por que importa: falha de WCAG 2.4.2 (nível A) em uma página, e `DESIGN.md:76-77` exige título próprio em cada página.
- Correção: `export const metadata: Metadata = { title: "Minha conta" };`.

**A11Y-03 · médio · (reincidente, parcial) · `src/components/ui/Field.tsx:33, 79`; `src/components/builder/SaveBuildButton.tsx:94-104`**
- Problema: a dica e o erro só são ligados ao campo pelo contexto do `Field`, e só o `MoneyInput` consome esse contexto. O campo "Nome da montagem" é um `<input>` comum: o erro de limite de caracteres não é lido ao focar.
- Por que importa: o leitor de tela não anuncia a causa do erro nesse campo (WCAG 1.3.1 e 3.3.1).
- Correção: expor um hook (`useFieldProps`) que o `<input>` comum também use, ou ligar `aria-describedby` direto no `SaveBuildButton`.

**A11Y-11 · baixo · (reincidente, parcial) · `src/components/ProductCard.tsx:41`; `src/components/StoreBadge.tsx:43, 65`**
- Problema: nos cards, os motivos de confiança existem só no `title` (dica de mouse, que não aparece no toque) e num texto para leitor de tela. A página da peça e o resumo do Montador já mostram a lista visível.
- Por que importa: no celular, quem toca não vê por que a loja é confiável na listagem.
- Correção: mostrar o motivo principal visível no card, ou só o rótulo e o link para a peça.

**A11Y-N1 · médio · (novo) · `src/components/PriceAlertButton.tsx:36, 48-55, 92-95`**
- Problema: ao clicar em "Criar alerta de preço", o botão some e o campo não recebe o foco, que volta para `body`. A mensagem de retorno (`role="status"`) nasce junto com o texto, e nem todo leitor anuncia isso. Se `getUser` falhar, o botão fica desabilitado sem explicação.
- Por que importa: quem navega pelo teclado perde o lugar na página da peça a cada abertura do alerta.
- Correção: focar o campo `alvo-alerta` ao abrir, manter o `role="status"` sempre no DOM e tratar a falha de `getUser`.

**A11Y-N2 · baixo · (regressão) · `src/components/ui/SegmentedControl.tsx:12, 78`**
- Problema: a dica de cada opção (`hint`) vai só para `title`. O comentário do tipo diz que ela vai "para leitores de tela", o que não acontece.
- Por que importa: a explicação de "Jogos", "Trabalho" e "Criação" não chega ao leitor de tela nem ao toque.
- Correção: ligar a dica a cada `role="radio"` com `aria-describedby` apontando para texto visível ou sr-only.

**A11Y-N3 · baixo · (regressão) · `src/components/ui/Button.tsx:79-83`**
- Problema: o link de loja com esquema não permitido vira `<span aria-disabled="true">`. `aria-disabled` não é permitido em elemento sem papel (genérico).
- Por que importa: é ARIA inválido, apontado por validadores de acessibilidade.
- Correção: `<span>` sem `aria-disabled`, com "Link indisponível" em texto visível.

**A11Y-N4 · baixo · (novo) · `src/components/builder/PaymentPlanner.tsx:128-146`**
- Problema: o `<label>` do seletor de parcelas envolve o `<select>` e também o texto de ajuda ("Acréscimo sobre o preço a prazo...").
- Por que importa: o nome acessível do campo vira um parágrafo inteiro, e a ajuda não fica separada como descrição.
- Correção: `<label>` só com "Número de parcelas" e a ajuda num elemento ligado por `aria-describedby`.

**A11Y-N5 · baixo · (regressão) · `src/components/ProductCard.tsx:23-54`**
- Problema: o card inteiro é um link, e o nome acessível junta categoria, "em N lojas", nome, preço, loja e os motivos de confiança (o texto sr-only de `StoreBadge`).
- Por que importa: o link fica longo demais para quem usa leitor de tela, e o destino fica depois de muito texto.
- Correção: nome do link igual ao nome da peça, com o restante em `aria-describedby` ou fora do link.

## Consistência (CON)

**CON-04 · médio · (reincidente) · `src/services/builder/compatibility.ts:10`; `src/services/specs.ts:70-111`; `scripts/collect-specs.mjs:64`; `src/services/builder/auto-build.ts:42-53`; `src/services/builder/test-fixtures.ts:129`; `src/components/CategoryIcon.tsx:6-14`; `src/models/types.ts:10`**
- Problema: a lista das sete categorias está repetida em seis lugares. A lista de campos obrigatórios por categoria está em três (`hasRequiredSpec`, `camposFaltando` e `OBRIGATORIOS`), e os comentários pedem para mudar "as três" quando uma muda.
- Por que importa: adicionar `cooler` (A4) ou um campo obrigatório exige editar à mão, e uma divergência deixa peça válida fora ou compatível errada.
- Correção: uma fonte única em `src/models/` importada pelos demais, com um teste que compare as cópias.

**CON-05 · baixo · (reincidente, parcial) · `supabase/schema.sql:3`; `package.json:2`; `src/services/popularity.ts:39`**
- Problema: o comentário do schema cita `src/lib/types.ts` (o arquivo é `src/models/types.ts`); o `name` do pacote é `comparador-app`; o comentário do modo de exemplo diz "marca algumas como destaque", e o código só corta a lista.
- Por que importa: texto que não bate com o código confunde quem chega ao projeto.
- Correção: corrigir os três textos.

**CON-07 · baixo · (reincidente, parcial) · `src/models/categories.ts:26, 39-44`**
- Problema: "hdmi" deixou de casar com SSD, mas "memória de vídeo" casa com RAM e não com placa de vídeo. Verificado: `categoriesMatching("memória de vídeo")` devolve `["ram"]`, porque o alias "memória" aparece como palavra inteira dentro da frase.
- Por que importa: a busca mostra memória RAM para quem procura memória de vídeo.
- Correção: dar prioridade ao alias mais longo (`memória de vídeo`, `placa de vídeo`) antes de casar palavras isoladas.

**CON-09 · baixo · (reincidente, parcial) · `src/app/auth/actions.ts:64-65`**
- Problema: "Conta criada! Você já pode entrar." aparece sempre, mesmo quando o Supabase exige confirmação por e-mail, como o comentário da linha 64 admite.
- Por que importa: a pessoa tenta entrar, não consegue e não sabe que falta confirmar o e-mail.
- Correção: usar o retorno de `signUp` (`data.session`) para escolher a mensagem.

**CON-N1 · médio · (regressão) · `docs/diagramas/arquitetura.md:50, 97, 131-133, 167, 171-172, 211`; `docs/diagramas/fluxo-montador.md:77-81`; `docs/diagramas/fluxo-pagamento.md:22, 111`; `docs/diagramas/fluxo-dados.md:234-235`; `docs/diagramas/jornada-usuario.md:117`; `docs/diagramas/README.md:50-56`**
- Problema: os diagramas ainda dizem que a V2 não está ligada ou não existe: "/montar usa PART_SPECS do mock", "autoBuild segue guloso", "BuildResultView ainda não passa as peças" (aba Misturar escondida), "pacote G ainda não existe". A onda 2 ligou tudo isso (`src/app/montar/page.tsx:36-41`, `BuilderForm.tsx:145`, `BuildResultView.tsx:173`, `saved_builds`). Dois trechos estão errados de forma perigosa: `arquitetura.md:167` diz que `/api/check-alerts` responde 500 (é 503, `route.ts:93-108`), e `arquitetura.md:211` diz que sem `CRON_SECRET` a rota fica aberta (não fica, `route.ts:90-97`).
- Por que importa: o próximo agente lê os diagramas como estado do sistema, reabre trabalho pronto ou acredita numa falha de segurança que não existe.
- Correção: revisar os seis arquivos numa passagem só, com o estado pós-onda 2 e o `arquivo:linha` de cada afirmação.

**CON-N2 · médio · (regressão) · `docs/superpowers/specs/2026-11-04-montador-de-pc-design.md:26`; `README.md:28`; `src/models/builder-types.ts:17-18`**
- Problema: "loja confiável" aparece como "oficial e nota ≥ 4,5" nos três documentos. O código (`storeTrust`, `src/services/builder/trust.ts:48-83`) também exige Reclame Aqui ≥ 6 quando informado e exclui loja bloqueada.
- Por que importa: a régua de confiança é o diferencial anti-golpe, e a documentação diz menos do que o código faz.
- Correção: atualizar as três definições com as regras de `storeTrust`.

**CON-N3 · médio · (novo) · `README.md:17, 88-100`; `docs/diagramas/arquitetura.md:34`**
- Problema: o README promete "Alertas de preço por e-mail", mas não diz que nada no repositório chama `/api/check-alerts` (só o `coleta.yml` é agendado), nem como configurar o agendador, `CRON_SECRET` ou `RESEND_API_KEY`. O diagrama admite que o agendador "não está no repositório".
- Por que importa: sem agendador externo, nenhum alerta sai em produção, e quem lê o README não sabe disso.
- Correção: seção "Alertas" no README com o agendador exigido, a variável `CRON_SECRET` e um exemplo de chamada.

**CON-N4 · baixo · (regressão) · `src/components/builder/BuilderForm.tsx:70-84`; `src/components/builder/BuildResultView.tsx:23-28`**
- Problema: o AGENTS.md diz "Lógica de negócio não vai em componentes". `notasDoLink` decide quais peças do link saíram da montagem, e `situacaoDe` decide o texto e o tom do resultado.
- Por que importa: a regra vira letra morta a cada componente novo, e esses cálculos não têm teste.
- Correção: mover as duas funções para `src/services/builder/` ou `src/lib/`, com teste unitário.

**CON-N5 · baixo · (regressão) · `DESIGN.md:55, 59, 88`; `src/app/globals.css:41`; `src/components/ui/SegmentedControl.tsx:81`**
- Problema: o DESIGN.md cita um componente `NumberInput` que não existe (o código tem `MoneyInput`) e não cita `SegmentedControl`. A escala tipográfica (12 a 48 px) não tem 20, 24 e 30 px, e o código usa `text-xl`, `text-2xl` e `text-3xl` em 14 lugares (por exemplo `src/components/ui/SectionTitle.tsx:18` e `src/app/page.tsx:76`). O raio de 4 px do `SegmentedControl` está fora dos tokens (6 px ou 10 px). `--color-viz-context` duplica `CHART_COLORS.contexto`.
- Por que importa: o sistema visual que o AGENTS.md manda seguir não descreve o que está no código.
- Correção: atualizar o DESIGN.md (nome do componente, escala real, lista de componentes) e remover o token duplicado.

**CON-N6 · baixo · (regressão) · `src/components/builder/PerformancePanel.tsx:25-27, 55`; `src/components/builder/PaymentPlanner.tsx:11`; `src/services/builder/payments.ts:23`**
- Problema: o TODO(V2-D) de `PerformancePanel` pede para trocar o link por `/metodologia`, que já está em `URL_METODOLOGIA` (linha 29). O TODO da linha 55, sobre `references`, já foi cumprido pelo pacote F (`BuilderForm.tsx:267`). Os TODOs de cupom apontam para o pacote E, dado como concluído.
- Por que importa: um TODO cumprido polui a lista de pendências, e um TODO sem pacote vivo fica esquecido.
- Correção: apagar os TODOs cumpridos e reapontar o de cupom para um pacote posterior.

**CON-N7 · baixo · (regressão) · `supabase/schema-builder.sql:1-4`**
- Problema: o cabeçalho diz "scaffold V1 — ainda NÃO usadas pelo app". O app já lê `part_specs` e `reference_builds` e grava `saved_builds`.
- Por que importa: quem abre o SQL acha que as tabelas são decorativas.
- Correção: trocar o cabeçalho pelo estado atual e pela ordem de execução.

**CON-N8 · baixo · (regressão) · `playwright.config.ts:28`; `scripts/collect-prices.mjs:61`; `scripts/inspect-store.mjs:15`**
- Problema: os três arquivos têm o caminho fixo `/opt/pw-browsers/chromium`, do ambiente de desenvolvimento, e `PW_CHROMIUM_PATH` não está no `.env.example`.
- Por que importa: o caminho só existe numa máquina, e a variável de sobrescrita fica escondida.
- Correção: documentar `PW_CHROMIUM_PATH` no `.env.example` e tirar o caminho fixo, deixando o padrão do Playwright.

**CON-N9 · baixo · (novo) · `src/app/api/check-alerts/route.ts:113`; `src/services/email.ts:19`**
- Problema: se `NEXT_PUBLIC_SITE_URL` não estiver definida em produção, os links dos e-mails apontam para `http://localhost:3000`. Sem `EMAIL_FROM`, o remetente é `onboarding@resend.dev`, que só entrega para a conta de teste do Resend.
- Por que importa: o alerta chega com link quebrado, e o e-mail pode não chegar a ninguém fora da conta de teste.
- Correção: exigir as duas variáveis quando `NODE_ENV === "production"`, com erro claro na rota.

**CON-N10 · baixo · (novo) · `README.md:1, 14-21`**
- Problema: o README usa emojis como ícones das listas de recursos e no título.
- Por que importa: o AGENTS.md proíbe emoji como ícone ("Ícones só do lucide-react"). É documento, não UI, mas a regra é do projeto.
- Correção: trocar por marcadores de texto ou remover.

**CON-N11 · médio · (novo) · `supabase/seed.sql:1-2`; `supabase/seed-extras.sql:1-3`; `README.md:85-86`; `AGENTS.md:43-44`**
- Problema: o AGENTS.md e o README listam quatro seeds como "só para demonstração". `seed.sql` (lojas, ofertas e histórico de preços "de exemplo") e `seed-extras.sql` (peças extras) ficam fora da lista, e o produto promete "histórico de preço real".
- Por que importa: quem roda `seed.sql` num banco real fica com histórico inventado, sem o aviso que as outras seeds têm.
- Correção: incluir os dois seeds na lista do README e do AGENTS e pôr aviso no cabeçalho de cada um.

**CON-N12 · baixo · (regressão) · `docs/superpowers/specs/2026-11-04-montador-de-pc-design.md:84-85`; `src/services/builder/compatibility.ts:30-37`**
- Problema: a spec (§5.1) exige `perf > 0` em todas as categorias. `hasRequiredSpec` exige isso só para GPU, CPU e SSD, e `camposFaltando` em `specs.ts` segue a mesma regra.
- Por que importa: quem implementar uma categoria nova segue a spec e diverge do código.
- Correção: decidir e alinhar a spec, `hasRequiredSpec` e `camposFaltando`.

## Lógica, dados e testes (LOG, DAD, TST)

**LOG-N1 · médio · (regressão) · `src/app/api/check-alerts/route.ts:34-36, 163-175, 228-229`**
- Problema: a paginação recomeça do menor id a cada execução (`ultimoId = null`), e o teto de 50 lotes de 100 alertas (5.000 por execução) limita a leitura. Enquanto houver 5.000 alertas pendentes antes deles, os alertas seguintes nunca são avaliados. O comentário diz que "o resto fica para a próxima", o que não acontece.
- Por que importa: alertas além do 5.000º nunca disparam, sem erro nem log. Com o volume atual o problema não aparece.
- Correção: guardar um cursor entre execuções (por exemplo ordenar por `last_checked_at` nulo primeiro e atualizar o campo) ou processar até acabar, limitado por tempo.

**DAD-03 · médio · (reincidente, parcial) · `src/services/references.ts:95, 102-105, 115`**
- Problema: com Supabase configurado, erro em `reference_builds` ou tabela vazia devolve `REFERENCE_BUILDS` (mock). `specs.ts` (linhas 180-183) e `installments.ts` (linhas 47-51) devolvem vazio, como o AGENTS.md manda (linhas 41-43). O cabeçalho de `references.ts` (linhas 2-3) diz o contrário.
- Por que importa: a regra "dado ilustrativo nunca vira fato no modo real" é violada. Índices de exemplo aparecem em "PCs parecidos" e no gráfico como se fossem da base.
- Correção: `getReferenceBuilds` devolve lista vazia em erro e em tabela vazia, e a tela trata isso com a nota que `estimatePerformance` já tem (`NOTA_SEM_REFERENCIAS`).

**DAD-02 · alto · (reincidente) · `src/services/products.ts:163-174, 180-209, 258-262`**
- Problema: as consultas não usam `.range`, e o PostgREST devolve no máximo 1.000 linhas por padrão (o próprio coletor cita isso, `scripts/collect-prices.mjs:49, 155-156`). O histórico (`getPriceHistory`) ordena por `recorded_at` de forma ascendente e recebe as primeiras 1.000 linhas. Quando o histórico de uma peça passa de 1.000 linhas (coleta diária, várias lojas), o gráfico corta os pontos mais recentes e mostra uma data antiga como se fosse a última.
- Por que importa: o diferencial "histórico de preço real" some em silêncio, sem aviso na tela. Subi a gravidade em relação à onda 1 (médio) por causa disso.
- Correção: paginar `getPriceHistory` (ou ordenar de forma decrescente com limite e inverter), avisar quando a resposta vier cortada, e paginar catálogo e busca.

**LOG-N2 · baixo · (regressão) · `src/lib/format.ts:29-31, 47-52`; `src/app/peca/[slug]/page.tsx:56-58`; `src/components/ProductCard.tsx:5, 17-18`; `src/services/builder/auto-build.ts:133-146, 153-155`**
- Problema: o caso "só sobrou oferta suspeita" é inalcançável. Uma oferta só é suspeita se existe loja confiável em estoque com preço (`src/services/builder/suspicious.ts:53-55`), e essa loja nunca é marcada, então `getBestOffer` e `escolherOferta` sempre têm uma oferta limpa. O ramo, o aviso `offerWarning` do herói e os comentários que o descrevem estão mortos. O próprio `auto-build.ts:154` admite que o caso nunca ocorre.
- Por que importa: o comentário diz que a pessoa é avisada de algo que o código nunca faz, e quem mexer na regra vai acreditar que o aviso funciona.
- Correção: remover o ramo e os comentários, ou manter só como caso de teste com `check` e dizer isso no comentário.

**LOG-N3 · médio · (novo) · `src/services/builder/compatibility.ts:3-4, 30-51, 110-117`**
- Problema: a compatibilidade cobre socket, tipo de memória, formato do gabinete e potência da fonte. Não cobre comprimento da GPU no gabinete, altura do cooler, slots M.2, quantidade de pentes de RAM e formato da fonte (SFX em ITX). O próprio TODO admite. O AGENTS.md diz que a invariante "peças sempre compatíveis entre si" não pode ser quebrada.
- Por que importa: uma montagem aprovada pelas regras atuais pode não caber no gabinete escolhido, e a tela promete compatibilidade.
- Correção: reescrever a invariante no AGENTS.md para o que o código garante, e incluir ao menos o comprimento da GPU antes de manter a palavra "sempre".

**LOG-N4 · baixo · (novo) · `src/services/builder/payments.ts:269-281`; `src/components/builder/PaymentPlanner.tsx:115-126`**
- Problema: `price_installment` menor que `price_pix` é aceito. O total parcelado fica abaixo do Pix, a economia do Pix some e a tela mostra "Sem acréscimo" sem aviso. Só os seeds preenchem o campo, porque a coleta não o atualiza.
- Por que importa: um dado ruim vira "parcelado mais barato que o Pix", o contrário do que a tela promete.
- Correção: tratar `price_installment < price_pix` como ausente, com a mesma regra de `validInstallmentPrice`, e testar.

**LOG-N5 · baixo · (regressão) · `src/services/builder/coupons.ts:1-6`**
- Problema: `applyCoupon` não tem uso na tela; só o próprio arquivo e o teste o usam. A tabela `coupons` não existe no schema.
- Por que importa: código morto dá a impressão de recurso pronto.
- Correção: tirar do caminho de build até o pacote E3 ser feito, ou apagar e reabrir depois.

**LOG-N6 · baixo · (regressão) · `src/lib/money.ts:27-28`**
- Problema: entradas ambíguas são aceitas em silêncio: `"6.000.50"` vira 6000,5 e `"1.50"` vira 1,5 (verificado com a sonda). A regra "ponto com dois dígitos é decimal" só cobre o caso simples.
- Por que importa: é o caso do LOG-01 em outra forma. Um teto digitado errado gera outro valor, sem aviso.
- Correção: recusar com mensagem quando houver mais de um ponto e a última parte tiver dois dígitos.

**LOG-N7 · baixo · (regressão) · `src/services/builder/auto-build.ts:659`**
- Problema: `perfGainPct: ganhoPct(...) ?? 0` usa 0 para "não informado" e para "0% de ganho" ao mesmo tempo.
- Por que importa: quem consome o campo não distingue troca sem efeito de dado ausente.
- Correção: tipo `number | null`, com null quando não dá para calcular.

**LOG-N8 · baixo · (novo) · `src/app/api/check-alerts/route.ts:142-149`**
- Problema: o e-mail sai antes de `notified_at` ser gravado. Se a gravação falhar, o próximo job reenvia o mesmo aviso.
- Por que importa: e-mail duplicado para a mesma pessoa quando o banco falha de forma transitória.
- Correção: gravar com condição (`notified_at is null`) antes do envio e desfazer se o envio falhar, ou documentar que é "pelo menos uma vez".

**DAD-01 · médio · (reincidente, parcial) · `supabase/schema.sql:27-36`; `supabase/schema-builder.sql:6-21`**
- Problema: `offers` não tem `CHECK (price_pix > 0)`, `CHECK (installment_count >= 1)` nem `UNIQUE (product_id, store_id)`. `part_specs` não tem CHECK de `perf > 0` nem de `aesthetics` entre 0 e 100. Já há CHECKs em `price_alerts` (`supabase/schema-alerts.sql:21-27`), `saved_builds` (`supabase/schema-builder.sql:62-78`), `store_installments` (`supabase/schema-payments.sql:15-23`) e `stores` (`supabase/schema-stores.sql:4-13`).
- Por que importa: a validação em código é a única defesa. Uma escrita direta ou um bug da coleta entra no banco e chega à tela.
- Correção: migração com as constraints restantes e um teste de inserção inválida.

**TST-01 · baixo · (reincidente, parcial) · `src/services/builder/payments.test.ts:75-78, 215`**
- Problema: há teste para `price_installment` zero (linha 78) e para `count: 0` numa tabela de juros (linha 215). Não há teste para `installment_count` zero ou negativo numa oferta (`parcelasDaOferta`, `payments.ts:64-69`).
- Por que importa: a regra "contagem zero vira um" não está protegida no caminho das ofertas.
- Correção: casos com `installment_count: 0` e `-1` em `buildPaymentSummary`.

**TST-N1 · baixo · (regressão) · `src/services/builder/auto-build.test.ts:539-550`**
- Problema: teste de tempo com `performance.now()` e limite duro de 400 ms, dentro de `npm test`, que roda em paralelo no CI.
- Por que importa: pode falhar de forma intermitente em máquina lenta ou sob carga. Na minha execução levou 114 ms para quatro montagens de 150 peças, então hoje passa com folga.
- Correção: mover para um benchmark fora de `npm test`, ou manter só o aviso sem limite duro.

**TST-N2 · baixo · (regressão) · `tests/e2e/montar.spec.ts:158-168, 19, 40-41, 166`; `tests/e2e/navegacao.spec.ts:29`**
- Problema: o e2e de R-01 só verifica "Preço bom demais?" se a oferta de R$ 1.399,90 aparecer (linha 168). Como hoje ela nunca aparece, o teste não prova que a oferta foi excluída de propósito. Há seletores frágeis: XPath `following-sibling` (linha 19), CSS `ul > li` (linha 41) e `a[href^="/peca/"]` (navegacao, linha 29).
- Por que importa: a regra anti-golpe fica protegida por um teste que passa por ausência.
- Correção: asserção fixa de que a oferta de marketplace não é a melhor oferta, e seletores por `getByRole`.

## Desempenho (PERF)

**PERF-01 · médio · (reincidente, parcial) · `src/app/montar/page.tsx:36-41, 70-78`; `src/components/builder/BuilderForm.tsx:95-112`; `src/app/peca/[slug]/page.tsx`**
- Problema: o catálogo, as specs, as referências e as tabelas de juros entram como props do `BuilderForm` (componente cliente) e vão para o navegador. A onda 2 acrescentou specs, referências e juros a esse payload. O algoritmo (`BuilderForm.tsx:37-39, 144`) e o resultado com Recharts já são carregados sob demanda, o que foi feito. Recharts continua no bundle de `/peca` (`src/components/PriceHistoryChart.tsx:11`).
- Por que importa: o HTML de `/montar` carrega o catálogo inteiro antes de a pessoa montar qualquer coisa.
- Correção: enviar só o necessário (ids, nomes e preços usados no resultado) e calcular no servidor, ou medir o payload com o catálogo real.

**PERF-02 · médio · (reincidente) · `src/app/layout.tsx:32`; `src/components/SiteHeader.tsx:15`; `src/models/supabase-server.ts:42-49`**
- Problema: com Supabase configurado, o cabeçalho chama `getCurrentUser()` (que chama `cookies()`) em todas as páginas. O projeto não tem `dynamic`, `revalidate` nem cache (busca por esses termos: zero ocorrências).
- Por que importa: home, busca e página de peça são renderizadas a cada visita, mesmo sendo conteúdo público.
- Correção: tirar a sessão do cabeçalho para um componente cliente, e deixar o catálogo estático ou com `revalidate`.

**PERF-03 · médio · (reincidente) · `src/proxy.ts:35, 42`; `src/components/SiteHeader.tsx:15`**
- Problema: `supabase.auth.getUser()` roda no proxy em toda requisição (o matcher também pega `/api`) e de novo no cabeçalho.
- Por que importa: latência extra em toda navegação e chamada duplicada ao serviço de autenticação.
- Correção: uma verificação por requisição, repassada por header ou por cache da requisição.

**PERF-04 · médio · (reincidente) · `src/app/busca/page.tsx:26`; `src/services/products.ts:163-209`**
- Problema: "Todas as peças" e a busca carregam o catálogo inteiro, sem `limit` nem `range`.
- Por que importa: com centenas de peças, como prevê o plano, a página fica pesada.
- Correção: paginação no servidor (`limit` e `offset`) e controle de página na tela.

**PERF-05 · médio · (reincidente, parcial) · `scripts/collect-prices.mjs:46, 95-105, 269-273, 291`; `.github/workflows/coleta.yml:41`**
- Problema: a espera fixa foi trocada por `waitForFunction` (feito). Continuam a coleta sequencial, a pausa de 4 s entre páginas (`PAUSA_MS`) e a falta de parada quando uma loja quebra (TODO em `:269-272`). O `coleta-resultado.json` só é gravado no fim (`:291`). Estimativa: com seletor quebrado, cada oferta leva cerca de 10 s (espera de 5,5 s, pausa de 4 s, carregamento), e em 120 min cabem ~650 ofertas; com seletores saudáveis (6 a 8 s por oferta), ~900 a 1.200.
- Por que importa: o GitHub mata o job antes de gravar o resultado, e então a issue "Seletor quebrado" nunca abre. O monitor fica mudo justo quando precisa dele.
- Correção: gravar o resultado parcial a cada loja e interromper uma loja depois de N falhas seguidas, como o TODO já descreve.

**PERF-07 · baixo · (reincidente, parcial) · `src/components/builder/BuildResultView.tsx:179`; `src/components/builder/BuilderForm.tsx:142-150`**
- Problema: `BuildResultView` já é `memo` (feito). `autoBuild` roda de forma síncrona na thread principal dentro de `startTransition`, sem Worker, e a pendência não sinaliza trabalho assíncrono. Medido: 114 ms para quatro montagens de 150 peças no teste sintético.
- Por que importa: cada montagem trava a interface pelo tempo do algoritmo, e em catálogo real o tempo pode ser maior.
- Correção: mover `autoBuild` para um Worker se passar de 200 ms em catálogo real.

**PERF-08 · baixo · (reincidente) · `package.json:23`**
- Problema: `playwright` (ferramenta do coletor) está em `dependencies` de produção.
- Por que importa: entra no pacote de produção sem uso pelo site. A coleta usa `npm ci` completo, então não quebra.
- Correção: mover para `devDependencies`.

**PERF-N1 · médio · (novo) · `src/app/page.tsx:44`; `src/services/popularity.ts:80-89`; `supabase/schema-popularity.sql:29-37`**
- Problema: a home chama `getPopularProducts(6)` a cada visita, e isso lê a view `popular_products`, que agrega `product_views` dos últimos 30 dias sem cache. O volume dessa tabela cresce com cada visita a peça (SEG-06, sem limite), e não há política de retenção.
- Por que importa: o custo de cada visita à home cresce com o tráfego.
- Correção: materializar o ranking (tabela atualizada por job), usar `revalidate` na home e definir retenção para `product_views`.

**PERF-N2 · baixo · (regressão) · `src/services/builder/auto-build.ts:84-99`; `src/services/products.ts:38-58`**
- Problema: o cache de confiança por loja usa `JSON.stringify` do objeto inteiro. A chave por objeto nunca acerta para ofertas do banco, porque `normalizeOffer` cria um objeto de loja novo para cada oferta (`products.ts:56`). Cada oferta paga a serialização.
- Por que importa: o custo é pequeno (dezenas de µs por oferta), mas o cache não faz o que o comentário diz.
- Correção: cache por `store.id` com os campos que a regra lê, ou normalizar cada loja uma vez por catálogo.

**PERF-N3 · baixo · (regressão) · `src/services/builder/auto-build.ts:405-437`**
- Problema: `greedyPass` monta até 22.500 pares CPU × placa-mãe por passo, ordena a lista duas vezes e chama `viavel` (que roda o planejador) para cada opção que cabe na fatia. A única medição é no catálogo sintético de 150 peças (114 ms para quatro montagens).
- Por que importa: o pior caso (fatia pequena, muitas opções viáveis) não foi medido com catálogo real.
- Correção: medir com catálogo real, ou um caso de estresse documentado, e limitar as opções avaliadas por `viavel`.

**PERF-N4 · baixo · (novo) · `src/components/SiteHeader.tsx:41-45, 54-58`**
- Problema: a busca do cabeçalho é renderizada duas vezes (desktop e celular, escondidas por CSS), com dois `useSearchParams`.
- Por que importa: DOM e hidratação duplicados em todas as páginas.
- Correção: uma única `SearchBar`, com o layout resolvido por CSS.

---

## Estado dos 68 ids da onda 1

| id | estado | evidência (arquivo:linha) |
|---|---|---|
| SEG-01 | RESOLVIDO | `route.ts:90-101` (503 sem segredo, comparação em tempo constante, erro genérico em `:185`) |
| SEG-02 | PARCIAL | ver SEG-02 |
| SEG-03 | RESOLVIDO | `email.ts:46-64, 78-100` (escape e link http/https) |
| SEG-04 | RESOLVIDO | `Button.tsx:76-92`; `peca/[slug]/page.tsx:149`; `BuildSummary.tsx:70-78` |
| SEG-05 | RESOLVIDO | `products.ts:138-149` (termo limpo). O aviso de erro na busca não existe: ver DAD-03 |
| SEG-06 | ABERTO | ver SEG-06 |
| SEG-07 | PARCIAL | ver SEG-07 |
| SEG-08 | ABERTO | ver SEG-08 |
| SEG-09 | ABERTO | ver SEG-09 |
| SEG-10 | RESOLVIDO | `saved-builds.ts:20, 209-216`; `schema-alerts.sql:21-27` |
| SEG-11 | RESOLVIDO | `account/actions.ts:59-71` |
| A11Y-01 | RESOLVIDO | `layout.tsx:24-36` (link de pular, `main` com id) |
| A11Y-02 | PARCIAL | ver A11Y-02 |
| A11Y-03 | PARCIAL | ver A11Y-03 |
| A11Y-04 | RESOLVIDO | `BuildResultView.tsx:111-127`; `BuilderForm.tsx:242` |
| A11Y-05 | RESOLVIDO | `PerformanceChart.tsx:68`; `PriceHistoryChart.tsx:35, 83-123`; `PerformancePanel.tsx:120-150` |
| A11Y-06 | RESOLVIDO | `Toggle.tsx:28, 38` |
| A11Y-07 | RESOLVIDO | `PaymentPlanner.tsx:152-161`; `PerformancePanel.tsx:124-135, 155-170`; `PriceHistoryChart.tsx:99-110` |
| A11Y-08 | RESOLVIDO | `Button.tsx:89` |
| A11Y-09 | RESOLVIDO | `NavLinks.tsx:29` |
| A11Y-10 | RESOLVIDO | `conta/page.tsx:60, 71, 184, 211, 284` |
| A11Y-11 | PARCIAL | ver A11Y-11 |
| A11Y-12 | RESOLVIDO | `Slider.tsx:49, 52` |
| CON-01 | RESOLVIDO | `email.ts:66-75`; `email.test.ts:49-53` |
| CON-02 | RESOLVIDO | `categories.ts:6-14` (sem campo emoji); `categories.test.ts:38` |
| CON-03 | RESOLVIDO | `SiteHeader.tsx:27` (fundo `bg-base`; nenhum `backdrop-blur` no repo) |
| CON-04 | ABERTO | ver CON-04 |
| CON-05 | PARCIAL | ver CON-05 |
| CON-06 | RESOLVIDO | `AGENTS.md:48` (convenção de identificadores documentada) |
| CON-07 | PARCIAL | ver CON-07 |
| CON-08 | RESOLVIDO | `Field.tsx:53-55` (`focus-visible`, anel `brand` de 2 px) |
| CON-09 | PARCIAL | ver CON-09 |
| CON-10 | RESOLVIDO | `chart-colors.ts:8-18`; `PriceHistoryChart.tsx:12`; `PerformanceChart.tsx:14` |
| DAD-01 | PARCIAL | ver DAD-01 |
| DAD-02 | ABERTO | ver DAD-02 (severidade subiu para alto) |
| DAD-03 | PARCIAL | ver DAD-03 (specs e juros cumprem a regra; referências não) |
| DAD-04 | PARCIAL | lotes e concorrência em `route.ts:34-38, 163-175`; falta o cursor entre execuções, ver LOG-N1 |
| DAD-05 | RESOLVIDO | `conta/page.tsx:105-106, 264-288`; `account/actions.ts:78-93` |
| LOG-01 | RESOLVIDO | `money.ts:13-34`; `money.test.ts:15` (resíduo em LOG-N6) |
| LOG-02 | RESOLVIDO | `compatibility.ts:30-51` e `auto-build.ts:168`; `specs.ts:83-111` (regras incompletas, LOG-N3) |
| LOG-03 | RESOLVIDO | `specs.ts:44-53, 122`; `auto-build.ts:168` |
| LOG-04 | RESOLVIDO | `auto-build.ts:164-180, 643-650` |
| LOG-05 | RESOLVIDO | `auto-build.ts:669` |
| LOG-06 | RESOLVIDO | `auto-build.ts:495-498, 528-545` |
| LOG-07 | RESOLVIDO | `auto-build.ts:236-324` (planejador exato, uma ordenação por categoria); teste de tempo em `auto-build.test.ts:539-550` |
| LOG-08 | RESOLVIDO | `money.ts:41-48`; `montar/page.tsx:24-28`; `share.ts:68-70`; `saved-builds.ts:145` |
| LOG-09 | RESOLVIDO | `montar/page.tsx:36-41, 70-78` |
| LOG-10 | RESOLVIDO | `payments.ts:55-61, 269` |
| LOG-11 | RESOLVIDO | `payments.ts:129-164`; `PaymentPlanner.tsx:109-114` |
| LOG-12 | RESOLVIDO | `payments.ts:35-36, 72-85, 187`; `installments.ts:34`; `schema-payments.sql:15, 23` |
| LOG-13 | RESOLVIDO | `products.ts:232-242, 270-275`; `coupons.ts:34-42, 56` |
| LOG-14 | RESOLVIDO | `references.ts:34-37, 68-73`; `performance.ts:66-73` |
| LOG-15 | RESOLVIDO | `performance.ts:130-132, 274-279` |
| LOG-16 | RESOLVIDO | `specs.ts:126-127`; `performance.ts:242-250` |
| LOG-17 | RESOLVIDO | `StoreBadge.tsx:18-22, 36`; `format.ts:59-63`; `trust.ts:98-101` |
| LOG-18 | RESOLVIDO | `format.ts:34-40`; `trust.ts:113-117`; `route.ts:219` |
| PERF-01 | PARCIAL | ver PERF-01 |
| PERF-02 | ABERTO | ver PERF-02 |
| PERF-03 | ABERTO | ver PERF-03 |
| PERF-04 | ABERTO | ver PERF-04 |
| PERF-05 | PARCIAL | ver PERF-05 |
| PERF-06 | RESOLVIDO | `collect-prices.mjs:177-187, 244-251` |
| PERF-07 | PARCIAL | ver PERF-07 |
| PERF-08 | ABERTO | ver PERF-08 |
| TST-01 | PARCIAL | ver TST-01 |
| TST-02 | RESOLVIDO | `performance.test.ts:223-257` |
| TST-03 | RESOLVIDO | `auto-build.test.ts:316, 359, 539-550` |
| TST-04 | RESOLVIDO | `money.test.ts:15` |

Portão 1 (R-01 a R-19): 18 resolvidos e 1 parcial. O parcial é o R-14: o e2e de oferta suspeita é condicional (`montar.spec.ts:168`), e não há e2e para `/peca/rtx-4060` nem para o parcelado em faixas. R-01 está resolvido na prática, porque a oferta suspeita nunca é escolhida (`auto-build.ts:136-146`, `format.ts:34-40`), mas o ramo de aviso ficou morto (LOG-N2).

## Resumo numérico

- Achados desta onda: **58** (21 regressões, 23 reincidentes, 14 novos).
- Por área: Segurança 9 · Acessibilidade 8 · Consistência 16 · Lógica, dados e testes 14 · Desempenho 11.
- Por severidade: bloqueador 0 · alto 1 · médio 21 · baixo 36.
- Ids da onda 1 (68): RESOLVIDO 44 · PARCIAL 15 · ABERTO 9.

## Ids antigos RESOLVIDOS

SEG-01, SEG-03, SEG-04, SEG-05, SEG-10, SEG-11, A11Y-01, A11Y-04, A11Y-05, A11Y-06, A11Y-07, A11Y-08, A11Y-09, A11Y-10, A11Y-12, CON-01, CON-02, CON-03, CON-06, CON-08, CON-10, LOG-01, LOG-02, LOG-03, LOG-04, LOG-05, LOG-06, LOG-07, LOG-08, LOG-09, LOG-10, LOG-11, LOG-12, LOG-13, LOG-14, LOG-15, LOG-16, LOG-17, LOG-18, DAD-05, PERF-06, TST-02, TST-03, TST-04.
