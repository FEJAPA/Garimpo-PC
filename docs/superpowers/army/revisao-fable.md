# Revisão final — Revisor Fable (V1 + V2, 2026-11-04)

Revisão independente dos dois gerentes do Portão 2. Escopo: `git diff 00bc45c..HEAD` (V1 + V2),
com foco no diff da V2 (`e709af0..HEAD`). Só leitura, sondas Vitest descartáveis (apagadas) e
as verificações listadas no fim. Nenhum arquivo de código foi alterado.

## Resumo executivo

1. Estado geral: sólido para um scaffold que virou produto em um dia. `tsc` 0, lint 0, Vitest
   376/376; as três invariantes do Montador (`total ≤ teto`, só lojas confiáveis com o filtro,
   peças compatíveis) valem no catálogo de exemplo, em 200 preferências aleatórias sobre 150
   peças por categoria e contra força bruta; a montagem mais barata é exata.
2. Segurança: sem buraco crítico. Open redirect fechado, `?b=` decodificado com limites, e-mail
   escapado, CSV neutraliza fórmulas, `CRON_SECRET` obrigatório com comparação em tempo
   constante, RLS confere dono inclusive na FK de `saved_builds`.
3. Maior risco de produto (alto): o formulário da home usa `type="number" step={100}` sem
   `noValidate`; quem digita R$ 6.550 não consegue enviar (o navegador bloqueia com mensagem
   nativa). É o CTA principal da página que persuade.
4. Maior risco de lógica (alto): o rebaixamento até o teto escolhe "a próxima mais barata" só
   pelo preço e pode ficar com uma peça pior E mais cara do que outra opção do catálogo
   (sonda: gpu R$ 2.900/perf 95 escolhida com gpu R$ 2.500/perf 100 disponível).
5. Com banco real, a nota "N peças ignoradas por falta de especificação" aparece DUAS vezes no
   resultado (serviço e tela montam a mesma frase).
6. Acessibilidade: o gráfico de comparáveis está dentro de `role="img"` mas deixa a camada
   focável do Recharts ligada (o gráfico de histórico desliga). O resto da a11y está bem feito.
7. Honestidade: boa. Estimativas rotuladas, fontes e mês de referência corretos, página
   `/metodologia`, seeds de demonstração avisam. Lacuna: a faixa de demonstração de `/montar`
   não diz que reputação de loja (Reclame Aqui, anos) é inventada, e `getReferenceBuilds`
   devolve o mock em erro/tabela vazia, contra a regra do AGENTS.md.
8. Docs: `docs/diagramas/*` descreve o código de ANTES da onda 2 (diz que A, B, D, E, F, G
   "ainda não existem" ou "não estão ligados"); o README os aponta como retrato do código real.
9. Antes de mostrar a alguém, eu faria (todas P): `step="any"` na home, apagar o `<li>`
   duplicado do BuildResultView, `accessibilityLayer={false}` no PerformanceChart, completar a
   faixa de demonstração de `/montar` e pôr um aviso de data nos diagramas. Depois: F-02/F-04.
10. Nenhum bloqueador. 2 altos, 6 médios, 15 baixos.

## Achados

Severidade: **bloqueador** / **alto** / **médio** / **baixo**. Tamanho da correção: P (até 1 h),
M (meio dia), G (mais).

| id | arquivo:linha | sev. | cenário concreto (entrada → saída errada) | correção concreta | tam. |
|---|---|---|---|---|---|
| F-01 | `src/app/page.tsx:74,87,101` | alto | Na home, digitar 6550 em "Quero gastar" (ou 7250 em "No máximo") e clicar "Montar com esse orçamento". `input type="number" min=0 step=100` sem `noValidate` no `<form>` → o navegador recusa o envio (`stepMismatch`) e mostra a mensagem nativa "Insira um valor válido. Os dois valores válidos mais próximos são 6500 e 6600". O CTA principal falha para qualquer valor que não seja múltiplo de 100, com texto fora da voz do site. | `step="any"` nos dois inputs (ou `noValidate` no form). Opcional: trocar por `MoneyInput` para aceitar "6.550". | P |
| F-02 | `src/services/builder/auto-build.ts:457-476` (`downgradeToCap`) | alto | Catálogo: gpu-a R$ 3.000/perf 120, gpu-b R$ 2.900/perf 95, gpu-c R$ 2.500/perf 100; cpu R$ 2.000 + mobo R$ 1.500 (único par), resto R$ 800; alvo = teto = R$ 7.200. O guloso pega gpu-a (cabe na fatia), o par estoura o teto (R$ 7.300), o rebaixamento troca pela "próxima mais barata" (`sort b.price - a.price`, linha 466) = gpu-b e para em R$ 7.200. Resultado: gpu-b, pior (95 < 100) e mais cara (2.900 > 2.500) que gpu-c, que também cabia. Sonda confirmou. Fere "montagem automática honesta" (PRODUCT.md). | No rebaixamento, entre as candidatas mais baratas e compatíveis, escolher a de MAIOR utilidade cuja troca faz o total caber no teto (ordenar por utilidade e pegar a primeira que cabe; se nenhuma cabe, a mais barata). Teste: o cenário acima deve devolver gpu-c. Isso também elimina F-04. | M |
| F-03 | `src/components/builder/BuildResultView.tsx:154-168` + `src/services/builder/auto-build.ts:645-649` | médio | Banco real com 1 peça sem spec (o caso normal após `collect:specs`, ver COLETA-SPECS "dever de casa"). `autoBuild` já põe em `notes` "1 peça do catálogo foi ignorada por falta de especificação técnica." e a tela acrescenta outro `<li>` "1 peça do catálogo ficou de fora porque não temos a especificação técnica dela." → duas frases iguais na caixa "Como chegamos aqui". Sonda: `notes` tem a frase e `ignored.count` = 1. No modo de demonstração não aparece (as 20 peças têm spec), por isso passou pelo e2e. | Apagar as linhas 160-166 do BuildResultView (a nota do serviço já cobre) e simplificar a condição da linha 154 para `result.notes.length > 0`. | P |
| F-04 | `src/services/builder/auto-build.ts:510-520,537-545` | médio | Mesmo catálogo de F-02 com gpu-b perf 60: depois do rebaixamento para gpu-b, o passo 5 "sobe" para gpu-c (ganho ≥ 10%, cabe) com `priceDelta = -400`. Nota na tela: "Subimos a placa de vídeo: gpu-b → gpu-c, por mais -R$ 400,00 (+67% de desempenho)." Sonda confirmou. | Corrigir F-02 (a troca deixa de existir). Como guarda, em `notaDaTroca`: se `priceDelta < 0`, escrever "economizando R$ X" e não contar a troca em `usedWiggleRoom`. | P |
| F-05 | `src/components/builder/PerformanceChart.tsx:68-70` | médio | `<div role="img" aria-label>` envolve um `<BarChart>` sem `accessibilityLayer={false}`. No Recharts 3.8.1 o padrão é `true` (`node_modules/recharts/es6/chart/CartesianChart.js:24`), então dentro de uma "imagem" há um contêiner focável com teclado (Tab para em um elemento sem nome dentro de `role=img`). O `PriceHistoryChart.tsx:33-37` desliga exatamente isso e explica por quê; aqui ficou inconsistente com o DESIGN.md ("todo gráfico tem role=img + tabela"). | `accessibilityLayer={false}` no `BarChart` (e o mesmo comentário do histórico). | P |
| F-06 | `docs/diagramas/README.md` (tabela "Em que ponto a V2 estava"), `fluxo-montador.md:77-81`, `fluxo-pagamento.md:22`, `arquitetura.md` (tabela de tabelas e seção 4), `jornada-usuario.md` ("Pontos de atrito"), `fluxo-dados.md` (seção 5) | médio | O README raiz (`README.md:38`) diz que os diagramas "seguem o código real". Eles dizem que: B "ainda não existe", A/D/E "código pronto, não ligado", F e G "ainda não existem", "/api/check-alerts fica aberta sem CRON_SECRET" (hoje devolve 503), "login cai em /conta" (hoje volta ao `next`), "alerta de uso único continua listado" (hoje desliga e tem Reativar), "a aba Misturar fica escondida" (hoje aparece). Tudo isso mudou na onda 2. | Atualizar os nós tracejados e as tabelas (M), ou, no mínimo, trocar a frase do README dos diagramas por "retrato de 04/11 ANTES da onda 2; ver `estado-exercito.md`" e remover do README raiz a promessa de que seguem o código (P). | M |
| F-07 | `src/services/references.ts:102-106,115` e `src/services/references.test.ts:108-116` | médio | Supabase configurado, `reference_builds` vazia ou consulta com erro → devolve `REFERENCE_BUILDS` (o mock). AGENTS.md: "com Supabase configurado, em erro ou tabela vazia devolve vazio/null e a tela avisa"; `specs.ts` e `installments.ts` seguem a regra, este não, e o comentário da linha 4 ("mesmo padrão de products.ts") é falso (products devolve `[]`). O teste fixa o comportamento errado. A tela já sabe lidar com lista vazia (`NOTA_SEM_REFERENCIAS`, `SEM_REFERENCIA`). | Devolver `[]` em erro e em tabela vazia (manter o mock só sem Supabase); ajustar os 3 testes e o comentário. Em `montar/page.tsx`, mostrar um Callout "Sem PCs de referência cadastrados: rode seed-references.sql" quando `references.length === 0`, como já faz para specs. | P |
| F-08 | `docs/superpowers/specs/2026-11-04-montador-de-pc-design.md` §2 (tabela "Lojas confiáveis"), §4.3:72, §5.3:116 | médio | AGENTS.md manda ler a spec para saber como o Montador funciona, mas: §2 diz "oficial e nota ≥ 4,5" (o código também exige Reclame Aqui ≥ 6 quando informado e `blocked = false`); §4.3 diz "seis montagens" (são 12); §5.3 descreve a escolha categoria a categoria, mas o código escolhe processador + placa-mãe como PAR (B2, `GREEDY_STEPS`) com utilidade ponderada pelas fatias; §5.5 descreve o rebaixamento "pela próxima mais barata" (origem de F-02). | Atualizar §2, §4.3, §5.3 e §5.5 (depois de decidir F-02). | P |
| F-09 | `docs/superpowers/plans/2026-11-04-montador-de-pc-v2.md` (todas as caixas `- [ ]` abertas), `docs/superpowers/army/estado-exercito.md:53-56` | baixo | Pergunta 6 do roteiro: "o que ficou pendente está listado?" Parcialmente. Há 20 marcadores `TODO(V2-*)` no código (A4 cooler, A3 `--atualizar`, B otimização global, C dados reais do Reclame Aqui, D benchmarks por jogo, E cupom na tela e cashback, H lojas com poucas ofertas e concorrência da coleta). "Flags abertas" lista só 4 itens e ainda cita R-14 como pendente, mas o e2e já tem o teste do filtro desligado (`tests/e2e/montar.spec.ts:156`). | Seção "Pendências pós-V2" no plano (ou no estado-exercito) com os 20 TODOs, marcar as caixas feitas e tirar R-14. | P |
| F-10 | `src/app/entrar/page.tsx:29-30,50-59`; `src/components/builder/BuilderForm.tsx:76` | baixo | `/entrar?erro=Sua%20conta%20foi%20bloqueada.%20Ligue%20para%200800...` mostra o texto do atacante numa caixa vermelha oficial (texto, não HTML: React escapa, então não é XSS, mas é vetor de phishing em link compartilhado). `/conta` já resolveu isso com códigos (`AVISOS`). O mesmo vale para `?b=`: `notasDoLink` ecoa o slug do link (até 120 caracteres livres) em "A peça “…” do link não está mais no catálogo." | Em `/entrar`, as actions passam códigos (`erro=credenciais`, `mensagem=conta-criada`) e a página traduz. Em `notasDoLink`, só ecoar slugs `^[a-z0-9-]{1,60}$`; senão "uma peça do link". | P |
| F-11 | `src/components/builder/PaymentPlanner.tsx:243-252`; `src/services/builder/mixed-plan.ts:158-160` | baixo | Modo Misturar: preencher só "Tenho à vista" = 3000 e deixar "Cabe por mês" vazio → o plano roda com `monthly = 0`, mostra "Ainda não cabe por mês" e "Falta R$ 3xx,xx por mês para caber no seu orçamento", embora a pessoa não tenha dito quanto cabe. Sonda confirmou (`fits: false`). | Só calcular quando os dois campos estiverem preenchidos (mensagem "Preencha também quanto cabe por mês"), ou tratar vazio como "sem limite" (`fits = true`, menor número de parcelas sem acréscimo). | P |
| F-12 | `src/components/builder/BuildSummary.tsx:28-31`; `src/app/peca/[slug]/page.tsx:142-146` | baixo | Oferta Terabyte com `installment_count = 12` e `price_installment = 1.120` (dado real plausível; no mock a 2ª loja de cada peça tem 12x), com a tabela de juros da Terabyte indo só até 10x. A lista de peças diz "ou 12x de R$ 93,33" e a tabela "Como pagar", logo abaixo, diz que a Terabyte parcela até 10x (10x de R$ 115). Sonda confirmou. O cálculo é refeito na tela (regra de negócio em componente, contra o AGENTS.md) sem o teto de 24x nem a tabela. | Expor em `payments.ts` um `offerInstallment(offer, table?)` e usar em BuildSummary, `/peca` e CSV. | P |
| F-13 | `src/lib/share.ts:152-153,162` | baixo | Oferta com `price_installment = 230` válido e `installment_count = null`: `buildPaymentSummary` conta R$ 230 como preço a prazo (`validInstallmentPrice` ignora o count), mas o CSV escreve "Parcelado 200,00; Parcelas 1". O total parcelado do CSV (que a pessoa leva para a loja) diverge do da tela. Sonda confirmou. | Reutilizar `validInstallmentPrice` e `parcelasDaOferta` de `payments.ts` (mesma correção de F-12). | P |
| F-14 | `src/lib/money.ts:27-28` (e `money.test.ts:16`, que fixa isso) | baixo | `parseMoney("6000.5")` → 60005; `"1500.5"` → 15005; `"1.5"` → 15. Com `inputMode="decimal"` em Android pt-BR o teclado costuma oferecer "." como decimal; quem digita "6000.5" monta um PC de R$ 60.005 sem aviso (o campo não mostra o valor interpretado). | Regra: sem vírgula e com UM ponto seguido de 1 ou 2 dígitos no fim → decimal (hoje só 2). E mostrar na dica do campo o valor interpretado ("= R$ 6.000,50"). | P |
| F-15 | `src/components/builder/PerformancePanel.tsx:25-27,55,212` | baixo | Comentários dizem "o app ainda não tem uma página para a metodologia" e "/montar ainda não passa references" — os dois já existem (`/metodologia`, `montar/page.tsx:73`). O link para `/metodologia` (interno) abre em nova aba. | Apagar os dois TODOs; tirar `target="_blank"` (ou usar `<Link>`). | P |
| F-16 | `supabase/schema-builder.sql:1`; `supabase/schema.sql:3` | baixo | Cabeçalho diz "scaffold V1 — ainda NÃO usadas pelo app" (part_specs, reference_builds e saved_builds são lidas e gravadas hoje); `schema.sql` cita `src/lib/types.ts` (é `src/models/types.ts`). Quem roda o SQL lê isso primeiro. | Atualizar os dois cabeçalhos. | P |
| F-17 | `src/app/montar/page.tsx:64-67`; `src/services/builder/auto-build.ts:577-579` | baixo | (a) Supabase fora do ar: `getProducts` devolve `[]` e a tela diz "Catálogo vazio: o banco não tem peças, rode os scripts" (diagnóstico errado). (b) Banco com peças mas `part_specs` vazia: além do Callout de specs, a montagem falha com "Não há placa de vídeo disponível com os filtros atuais. Desative Só lojas confiáveis", sugerindo a ação errada. | (a) `getProducts` devolver `null` em erro e a página mostrar "Não conseguimos ler o catálogo agora". (b) Em `autoBuild`, se `ignored.count === products.length`, falhar com "Nenhuma peça tem especificação técnica cadastrada". | P |
| F-18 | `src/app/montar/page.tsx:51-55`; `src/models/mock-data.ts:16-18,28,41,54` | baixo | Modo de demonstração: a faixa diz "Peças, preços, juros e índices de desempenho são de exemplo", mas cada peça mostra "Por que confiável: Loja oficial · Nota 4,8 (125.000 avaliações) · Reclame Aqui 8,2 · 22 anos de mercado" — números que o próprio mock marca como ILUSTRATIVOS e que citam lojas reais. `/peca` diz "Peças, lojas e preços são de exemplo"; `/montar` não cita lojas nem reputação. | Faixa de `/montar`: "Peças, preços, lojas e reputação (nota, Reclame Aqui), juros e índices de desempenho são de exemplo." | P |
| F-19 | `tests/e2e/montar.spec.ts:166-168`; `src/services/builder/auto-build.test.ts:539,550` | baixo | (a) O teste R-01 do e2e só afirma algo `if (temOfertaSuspeita)`; como a regra exclui a oferta, o `if` é falso e o teste passa sem conferir nada da regra. (b) O teste "em menos de 200 ms" só falha acima de 400 ms (meta do plano B1 é 200). | (a) Afirmar explicitamente `await expect(pecas.getByText(/1\.399,90/)).toHaveCount(0)` e, num segundo cenário com mock sem oferta confiável, o aviso visível. (b) Nome e limite iguais (200 ms, com `retry` se o CI oscilar). | P |
| F-20 | `src/app/api/check-alerts/route.ts`, `src/app/account/actions.ts` (sem `*.test.ts`) | baixo | As partes com mais regra de segurança (503/401 do segredo, "e-mail simulado não marca avisado", conferência de `product_id` da oferta ao salvar, limite de 50 montagens, dono na reativação) não têm teste; só os helpers puros de `saved-builds.ts` têm. Uma regressão (ex.: trocar `timingSafeEqual` por `===`, ou esquecer `.eq("user_id")`) passa no CI. | Testes com cliente falso encadeável, como `products.test.ts` faz; para a rota, `vi.stubEnv("CRON_SECRET")` e mock de `getAdminSupabase`/`sendEmail`. | M |
| F-21 | `src/app/montar/page.tsx:70-78`; `src/components/builder/BuilderForm.tsx:95-112`; `src/services/builder/auto-build.ts:85-100` | baixo | Todo o catálogo (`products` com `offers` e, em cada oferta, o objeto `store` inteiro), `specs`, `references` e `installmentTables` viram props do componente cliente → serializados no HTML/RSC. Com 20 peças é irrelevante; com 500 peças × 3 ofertas × loja repetida por oferta passa de 1 MB por visita, e `makeTrustCache` faz `JSON.stringify` de cada cópia de loja. | V3: rodar `autoBuild` numa server action (ou Web Worker) e mandar para o cliente só o resultado; ou, no mínimo, enviar só ofertas `in_stock`, lojas num mapa por id e sem `description`. | G |
| F-22 | `next.config.ts:5-11` | baixo | CSP só com `frame-ancestors 'none'`: não há `script-src`/`object-src` nem HSTS. Hoje o site não injeta HTML (sem `dangerouslySetInnerHTML`), então é endurecimento, não falha. | Adicionar `Strict-Transport-Security` e, com nonce do Next, `script-src 'self' 'nonce-…'`; `object-src 'none'`. | M |
| F-23 | `src/components/builder/SaveBuildButton.tsx:56-64`; `src/app/entrar/page.tsx:45-49` | baixo | Modo de demonstração (o que qualquer pessoa vê primeiro): o resultado mostra "Entre para salvar a montagem"; o link leva a `/entrar`, que diz "O login ainda não está configurado". Beco sem saída guiado pelo próprio site. | Sem Supabase, esconder o botão ou trocar por texto "Salvar e alertas precisam do banco configurado (modo de demonstração)". | P |

Itens conferidos e SEM achado (para o Portão 2 não repetir): invariantes `total ≤ teto`,
`trustedOnly`, bloqueio e compatibilidade (testes + leitura de `collectCandidates`,
`escolherOferta`, `makePlanner`); arredondamento de centavos no parcelado (resto na 1ª parcela,
Σ fecha); `suspiciousPrice` no limite exato (25% com epsilon); `teto = alvo`; orçamento enorme;
strings numéricas do banco (`normalizeStore`/`normalizeOffer`, `lerNumero`); `caminhoSeguro`
(`//`, `/\`, controle, `/entrar`); `decodeBuild` (tamanho, versão, tipos, clamp do slider);
`safeHref`/`safeHttpUrl`; `escapeHtml` no e-mail e nome da montagem sem quebras de linha;
`celula` do CSV; `sanitizeSearchTerm`; RLS de `price_alerts` com `exists` em `saved_builds`;
`offer_last_seen` com `security_invoker`; cupom com dia de Brasília; `mixedPlan` por custo
evitado; headers de segurança básicos; skip link visível só no foco; `aria-current`;
`SegmentedControl` com roving tabindex; tabela do gráfico; títulos por página.

## Qualidade dos testes

- Forte onde importa: `auto-build.test.ts` tem invariantes sobre 200 preferências aleatórias
  (catálogo sintético de 150 peças/categoria), força bruta para a montagem mais barata (40
  sementes), equivalência entre o cache de confiança do Montador e `validOffers` +
  `flagSuspiciousOffers`, e cenários nomeados para folga, par CPU + placa-mãe, perfis de uso e
  oferta suspeita. `payments.test.ts` cobre faixas, centavos, tabelas inválidas, "sem acréscimo"
  e a coerência mock × ofertas. `performance.test.ts` cobre NaN/zero/vazio e a regra de memória
  sem dupla contagem. Os testes de dados (`references.test.ts`, `specs.test.ts`) conferem que
  seeds SQL e mocks não divergem e que a fonte não cita mês inexistente — bom para honestidade.
- Passam "por acaso" ou dizem uma coisa e conferem outra: F-19 (e2e condicional; 200 ms vs
  400 ms). `references.test.ts:108-116` fixa um comportamento que contraria a regra do
  AGENTS.md (F-07).
- Mocks que escondem: os clientes falsos de `specs.test.ts`/`installments.test.ts` ignoram o
  texto do `select` (um erro de join `product:products(slug, category)` não seria pego); aceitável
  para lógica pura, mas é por isso que F-20 pesa.
- Cobertura do spec §5–§7: §5.1 candidatos e suspeitas (sim), §5.2 utilidade (sim), §5.3 fatias e
  perfis (sim), §5.4 folga e notas (sim), §5.5 teto (invariante sim; QUALIDADE do rebaixamento
  não — F-02 não tem teste), §5.6 compatibilidade (sim), §6 desempenho (sim), §7 pagamento (sim).
- Lacunas: nenhum teste de componente (BuildResultView, PaymentPlanner, SaveBuildButton); nada
  para `check-alerts` e `account/actions` (F-20); `coupons.test.ts` testa código que a tela não
  usa. O e2e cobre desktop e celular (overflow) e o link `?b=`, mas não o banco real.

## Honestidade dos dados e das mensagens

- Correto: `reference-builds.ts` e `seed-references.sql` dizem "Estimativa GarimpoPC… parte
  ilustrativa (V1)… consultados em nov/2026" e guardam o mês de referência das fontes
  (2026-05) separado do mês da consulta (2026-11); a tela mostra "Base: estimativa · fontes
  consultadas em nov/2026 (dados de mai/2026) · ver metodologia", e `/metodologia` explica que
  nada foi medido. Specs do mock têm `source: "ilustrativo (V1)"`; o JSON do coletor tem 20
  entradas, todas com `source`. Seeds de demonstração (`seed-stores`, `seed-payments`,
  `seed-builder`) avisam no cabeçalho. `specs.ts` e `installments.ts` não devolvem mock com banco
  configurado. E-mail e rodapé pedem para conferir o preço na loja. "Equivale a um…" e "FPS médio
  estimado" vêm rotulados como estimativa.
- Falhas: F-07 (referências do mock em erro/tabela vazia com banco real), F-18 (faixa de
  demonstração de `/montar` não cobre reputação de loja), F-06/F-08 (docs dizendo que o código
  é outro). "lido em 15/06 09:00" no modo de demonstração vem de datas fixas do mock; a faixa
  "preços são de exemplo" cobre, mas uma pessoa pode achar que a coleta está parada.

## Dívida e recomendações para a V3

1. Mover `autoBuild` para o servidor (server action com o catálogo em cache) ou para um Web
   Worker, e enviar ao cliente só o resultado (F-21). Hoje `montar/page.tsx` faz 4 consultas
   por visita sem cache; `cache()`/`revalidate` resolvem o custo do servidor.
2. Uma regra só para "parcelado da oferta": `BuildSummary`, `/peca`, CSV e `payments.ts` têm
   quatro versões (F-12/F-13). Vale o mesmo para "preço a prazo" e teto de 24x.
3. A lista de campos obrigatórios por categoria vive em três lugares (`compatibility.ts`,
   `specs.ts`, `collect-specs.mjs`), com avisos "mude os três". Gerar os três de um único
   arquivo de dados (JSON importado pelos três) e fazer `specs.ts` validar os enums
   (`socket`, `ramType`, `formFactor`, `caseSupports`) como o script já faz.
4. O planejador (`makePlanner`) depende do formato das regras de compatibilidade (documentado
   em `compatibility.ts:69-71`). Antes de adicionar comprimento de GPU/altura de cooler
   (TODO V2-A), trocar por um modelo genérico de restrições por par de categorias.
5. Rebaixamento e subida operam uma categoria por vez (F-02/F-04, TODO V2-B). Uma busca em
   feixe pequena (k = 5) sobre as 7 categorias com o planejador como limite inferior resolve
   os dois e aproxima o total do alvo.
6. `BuilderForm` → `BuildResultView` → `PaymentPlanner`/`PerformancePanel` passam `prefs`,
   `references`, `parts` e `payment` em cascata; um contexto React (`BuildContext`) reduz o
   acoplamento e o `memo` manual.
7. `storeTrust` monta textos localizados a cada chamada (por isso o cache no Montador).
   Separar o predicado (`isTrusted`) dos motivos (`trustReasons`).
8. `coupons.ts` está pronto e sem tela há duas ondas: ligar (campo de cupom) ou remover até a
   tabela existir, para não acumular código morto testado.
9. Docs: os diagramas envelheceram em um dia (F-06). Incluir no checklist de PR "diagramas e
   spec tocados?" e um teste simples que falhe se `docs/diagramas` citar função inexistente.
10. Segurança: F-10 (códigos em `/entrar`), F-22 (CSP com nonce, HSTS), testes de rota/actions
    (F-20), e um limite de tentativas no login (hoje só o do Supabase).
11. Tamanho: `auto-build.ts` (677 linhas) junta candidatos, planejador, guloso, rebaixamento,
    subida e notas; separar em `candidates.ts`, `planner.ts`, `passes.ts`, `notes.ts` antes da
    V3 facilita o item 5.

## Verificação

Rodado neste ambiente (sem build, e2e nem servidor, conforme o roteiro):

| comando | resultado |
|---|---|
| `npx tsc --noEmit` | 0 erros (exit 0) |
| `npm run lint` | 0 erros (exit 0) |
| `npx vitest run` | 21 arquivos, 376/376 testes passando, 8,1 s |
| sondas descartáveis (7) no scratchpad, apagadas depois | F-02, F-04, F-03, F-13, F-14, F-11 e F-12 reproduzidos com os valores citados na tabela |
| `git status --short` | árvore limpa antes desta revisão; nenhum arquivo de código alterado |

Leituras: PRODUCT.md, DESIGN.md, AGENTS.md, spec, plano V2, estado-exercito, METODOLOGIA,
COLETA-SPECS, os 6 diagramas, todo `src/` (serviços, telas, componentes, modelos, testes),
`supabase/*.sql`, `scripts/*.mjs`, `tests/e2e`, `playwright.config.ts`, `.github/workflows`,
`next.config.ts`, `.env.example`, e o padrão do Recharts 3.8.1 em `node_modules`.
