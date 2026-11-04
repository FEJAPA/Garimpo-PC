# Montador de PC — especificação (V1 scaffold → V2)

Data: 2026-11-04 · Status: **V2 no ar** (revisada ao fim da rodada final de correções da V2).

Este documento diz **como o Montador funciona**, passo a passo, e é a referência para quem for
mexer nele (o `AGENTS.md` manda ler esta spec). O plano de execução da V2 está em
`docs/superpowers/plans/2026-11-04-montador-de-pc-v2.md`; o que ficou para depois está em
`docs/PENDENCIAS-POS-V2.md`; os desenhos estão em `docs/diagramas/`.

## 1. Objetivo

Dado um orçamento, montar automaticamente um PC gamer completo (7 categorias: placa de
vídeo, processador, placa-mãe, memória, armazenamento, fonte, gabinete) com peças
compatíveis entre si, compradas em lojas confiáveis, e mostrar:

1. a lista de peças com loja e preço (Pix e parcelado);
2. o desempenho esperado, comparado com computadores de referência (gráfico + tabela);
3. um plano de pagamento (Pix à vista, parcelado ou misturado, por loja).

Três **invariantes** valem em todo resultado `ok` e são testadas: `totalPix ≤ hardCap`; com
`trustedOnly`, nenhuma peça vem de loja não confiável; as peças são compatíveis entre si.

## 2. Vocabulário

| Termo | Significado |
|---|---|
| **Orçamento alvo** (`target`) | quanto a pessoa *quer* gastar. Ex.: R$ 6.000. |
| **Teto** (`hardCap`) | o máximo absoluto. Ex.: R$ 7.000. **Nunca** é ultrapassado. |
| **Folga** (*wiggle room*) | `hardCap − target`. Só é usada se destravar uma melhora real (regra em §5.4). |
| **Loja confiável** | `isTrustedStore` em `trust.ts`, a mesma régua para o filtro, o selo e o "melhor preço": loja **nunca bloqueada** (`blocked = false`), **oficial** (`is_official = true`), com **nota ≥ 4,5** e, **quando o Reclame Aqui é informado, nota do Reclame Aqui ≥ 6** (0 a 10). Sem Reclame Aqui informado, valem só oficial + nota. Nota ilegível conta como 0. `storeTrust` devolve a mesma decisão e os motivos em linguagem simples ("Loja oficial", "Nota 4,8 (125.000 avaliações)", "Reclame Aqui 8,2" a partir de 7, "22 anos de mercado" a partir de 3). |
| **Loja bloqueada** | loja com denúncias de golpe (`blocked = true`). Fica de fora **sempre**, com o filtro ligado ou não. |
| **Oferta suspeita** ("preço bom demais") | oferta de loja **não confiável** cujo preço Pix está **25% ou mais abaixo da mediana** dos preços das lojas confiáveis para a mesma peça (`suspiciousPrice`, `flagSuspiciousOffers`). Oferta de loja confiável nunca é suspeita; sem preço confiável para comparar, nada é marcado. |
| **Preço a prazo** | o preço parcelado que a oferta anuncia (`price_installment`), nunca abaixo do Pix. É o piso do parcelado (§7). |
| **Balanço** (`aesthetics`, 0–100) | 0 = máximo desempenho, 100 = máxima estética. |
| **Perfil de uso** (`usage`) | `"jogos"` (padrão), `"trabalho"` ou `"criacao"`. Muda as fatias (§5.3) e a ordem da folga (§5.4). |
| **Resolução** (`resolution`) | `"1080p"` (padrão) ou `"1440p"`. Destaca a coluna de FPS; não muda as peças. |
| **Índice de desempenho** | número relativo por categoria (RTX 4060 = 100 entre GPUs; Ryzen 5 7600 = 100 entre CPUs). |
| **Índice GarimpoPC** | nota única da montagem: `round(0,7 × GPU + 0,3 × CPU)`. |

Interpretação do brief: "6k mas o limite é 7k" → `target = 6000`, `hardCap = 7000`,
folga = 1.000. Esses são os **valores padrão** do formulário; a pessoa pode mudar os
dois. O teto é da pessoa, não um limite global do site.

## 3. Fluxo da pessoa (tela `/montar`)

1. Informa **orçamento alvo** e **teto** (aceita "6.000", "6000,50" e "6000.5"; até R$ 1.000.000;
   o campo mostra como o valor foi entendido, ex.: "= R$ 6.000,50"). Se o teto for menor que o
   alvo, o formulário iguala o teto ao alvo (folga zero) e avisa. Teto em branco = alvo.
2. Escolhe **para que vai usar** (Jogos / Trabalho / Criação) e a **resolução do monitor**
   (Full HD / Quad HD).
3. Liga/desliga **"Só lojas confiáveis"** (ligado por padrão).
4. Ajusta o **slider** Desempenho ↔ Estética (padrão 25, levemente para desempenho).
5. Clica **"Montar meu PC"**. A montagem é calculada na hora, no navegador; o código do
   algoritmo só é baixado nesse clique. A URL vira `/montar?b=<código>` da montagem na tela.
6. Vê o resultado: cabeçalho (total, selo, ações), "Como chegamos aqui", **Peças**,
   **Desempenho esperado** e **Como pagar**.
7. Pode salvar a montagem (com login), copiar o link, baixar a lista em CSV, alterar qualquer
   entrada e remontar, ou ir para a loja de cada peça.

Entradas pela URL: `?alvo=6000&teto=7000` (vem do formulário da home) e `?b=<código>` (link de
compartilhamento: restaura as escolhas e monta sozinho, com os preços de hoje).

Estados: vazio (antes de montar: explica o que vai acontecer), carregando (esqueleto do
resultado; depois, resultado anterior esmaecido e botão em *loading*), erro (caixa "Não deu para
montar" com o motivo), sucesso (o foco vai para o resumo).

## 4. Dados necessários

O servidor (`src/app/montar/page.tsx`) carrega em paralelo: `getProducts()`, `getPartSpecs()`,
`getReferenceBuilds()` e `getInstallmentTables()`, e passa tudo ao `BuilderForm`. Regra do
`AGENTS.md`, "dado ilustrativo nunca vira fato no modo real": **sem Supabase** (modo de
demonstração) os quatro usam os dados de exemplo do código; **com Supabase**, um erro ou uma
tabela vazia devolvem vazio (`[]` ou `{}`), nunca o exemplo, e a tela avisa.

### 4.1 Catálogo
`products` + `offers` + `stores` (ver `src/models/types.ts`). A montagem usa apenas ofertas
`in_stock`, com `price_pix` finito e maior que zero, de loja não bloqueada (`validOffers`). Cada
oferta traz `recorded_at` (última leitura do preço, da view `offer_last_seen`).

### 4.2 Especificações por peça (`PartSpec`)
Chaveado por `slug`. Fonte: `getPartSpecs()` (tabela `part_specs`, join com `products.slug`);
no modo de demonstração, `PART_SPECS` de `src/models/part-specs.ts` (ilustrativo).

| Campo | Categorias | Descrição |
|---|---|---|
| `perf` | todas | índice de desempenho relativo (ver §2), **maior que zero**. Para gabinete = fluxo de ar; fonte = potência/eficiência; placa-mãe = recursos. |
| `aesthetics` | todas | 0–100, quanto a peça contribui para o visual (vidro, ARGB, branco…). |
| `tdp` | gpu, cpu | consumo em W para dimensionar a fonte. |
| `socket` | cpu, motherboard | `AM5`, `AM4`, `LGA1700`. |
| `ramType` | motherboard, ram | `DDR4`, `DDR5`. |
| `formFactor` | motherboard | `ATX`, `mATX`, `ITX`. |
| `caseSupports` | case | lista de form factors aceitos. |
| `wattage` | psu | potência nominal em W. |
| `capacityGb` | ram, ssd | capacidade; na memória, entra na regra de §6. |
| `upscaling` | gpu | tecnologias suportadas (`DLSS`, `FSR`, `XeSS`), para a nota de §6. |
| `source` | todas | de onde veio a spec. |

Linhas do banco inválidas ou incompletas são descartadas na leitura e contadas no log. A lista de
campos obrigatórios por categoria é a mesma em `hasRequiredSpec` (`compatibility.ts`), em
`specs.ts` e em `scripts/collect-specs.mjs`.

### 4.3 Computadores de referência (`ReferenceBuild`)
**12 montagens típicas**, em ordem de índice: Equivalente a console, PC de entrada econômico,
PC de entrada 2025, PC intermediário, PC intermediário 2026, PC intermediário forte, PC avançado,
PC avançado forte, PC de alto desempenho, PC entusiasta, PC entusiasta forte e PC topo de linha.

Cada uma tem: `id`, `name`, `description`, `parts` (peças principais), `approxPrice` (ordem de
grandeza do preço no Brasil), `score` (Índice GarimpoPC, pela mesma fórmula da montagem), `fps`
estimado em `1080p` e `1440p` para três perfis de jogo (`esports` leve, `aaa-medio`, `aaa-pesado`),
`ramGb` (os FPS já embutem a memória da referência), `source` e `measuredAt`. `measuredAt` **não**
é data de medição: é o mês de referência das fontes (AAAA-MM). O mês em que a GarimpoPC consultou
as fontes fica em `FONTES_CONSULTADAS_EM` (`2026-11`). **Nada foi medido pela GarimpoPC**: são
estimativas a partir de índices e de agregados públicos, explicadas em
`docs/METODOLOGIA-DESEMPENHO.md` e na página `/metodologia`.

Fonte e *fallback* (`getReferenceBuilds`, em `src/services/references.ts`):

- **sem Supabase**: `REFERENCE_BUILDS` (`src/models/reference-builds.ts`);
- **com Supabase**: só as linhas válidas de `reference_builds` (score e FPS finitos e maiores que
  zero), ordenadas por score; **erro de consulta ou nenhuma linha válida → `[]`**. Com lista vazia,
  `estimatePerformance` devolve `closest = SEM_REFERENCIA`, FPS zerados e a nota
  `NOTA_SEM_REFERENCIAS` ("Não há computadores de referência disponíveis agora; sem eles não dá para
  estimar os FPS."); a tela mostra só o índice e o aviso, sem comparações nem FPS.

O mesmo conteúdo da lista local está em `supabase/seed-references.sql` (só demonstração); um teste
confere que os dois não divergem.

## 5. Algoritmo de montagem automática (`autoBuild`)

Entrada: catálogo, `PartSpec`s, preferências `{ budget: {target, hardCap}, trustedOnly,
aesthetics, usage?, resolution? }` e, opcionalmente, o contexto `ctx = { references,
installmentTables }` vindo do servidor. Saída: `BuildResult` — sucesso (`parts`, `totalPix`,
`totalInstallment`, `budget`, `usedWiggleRoom`, `leftover`, `notes`, `upgrades`, `ignored`,
`performance`, `payment`) ou falha `{ ok: false, reason }`.

### 5.1 Candidatos (`collectCandidates`)
Para cada produto:

1. **Spec válida**: precisa existir spec da **mesma categoria** do produto e `hasRequiredSpec`
   aprovar: `perf` finito e > 0 e `aesthetics` entre 0 e 100 em todas; gpu e cpu com `tdp` > 0;
   cpu com `socket`; placa-mãe com `socket`, `ramType` e `formFactor`; memória com `ramType`;
   gabinete com `caseSupports` não vazio; fonte com `wattage` > 0. Sem isso, o produto vai para
   `BuildSuccess.ignored` (`{ count, slugs }`), mesmo sem estoque (o problema é do cadastro), e a
   montagem ganha a nota "N peças do catálogo foram ignoradas por falta de especificação técnica."
   (ou "1 peça do catálogo foi ignorada…").
2. **Ofertas válidas**: `validOffers(product, false)` (estoque, preço > 0, loja não bloqueada); com
   `trustedOnly`, só as de lojas confiáveis.
3. **Suspeitas**: entre as ofertas de lojas **não** confiáveis, marca as suspeitas (§2) contra a
   mediana das confiáveis da mesma peça.
4. **Escolha da oferta** (`escolherOferta`): a válida mais barata **que não é suspeita**. Se todas
   as válidas forem suspeitas, usa a mais barata e preenche `Candidate.suspicious = { reason }`; a
   montagem ganha o aviso "Atenção: a placa de vídeo veio de uma oferta com preço bom demais na loja
   X — confira antes de pagar." e a peça mostra "Preço bom demais?". Uma oferta suspeita **nunca** é
   recomendada em silêncio.

O preço do candidato é o `price_pix` da oferta escolhida. Falhas deste passo:

- nenhuma peça do catálogo com spec válida → "Nenhuma peça do catálogo tem especificação técnica
  cadastrada; não dá para montar agora.";
- uma categoria sem candidato porque todas as peças dela estão sem spec → "Nenhuma placa de vídeo do
  catálogo tem especificação técnica cadastrada; não dá para montar agora." (a categoria muda);
- uma categoria sem candidato por falta de oferta → "Não há placa de vídeo disponível com os filtros
  atuais. Desative “Só lojas confiáveis” ou tente mais tarde." (sem o filtro: "… Tente mais tarde.").

### 5.2 Utilidade de uma peça
Para a categoria, `perfNorm = perf / maior perf entre os candidatos` e
`aesNorm = aesthetics / 100`. A estética só pesa nas peças visíveis:

| Categoria | relevância estética |
|---|---|
| case 1,0 · ram 0,8 · gpu 0,6 · psu 0,3 · motherboard 0,3 · cpu 0 · ssd 0 |

`w = (aesthetics / 100) × relevância` e **`utilidade = (1 − w) × perfNorm + w × aesNorm`**.
Desempate: menor preço, depois `slug`.

**Utilidade ponderada do par** processador + placa-mãe (§5.3):
`(fatia_cpu × u_cpu + fatia_placa × u_placa) ÷ (fatia_cpu + fatia_placa)`.

### 5.3 Montagem mais barata e divisão do orçamento

**Passo 2: planejador exato (`makePlanner`).** Antes de tudo, calcula a montagem compatível **mais
barata possível**, de forma exata. As regras de §5.6 formam uma árvore em volta do processador: para
cada processador (em ordem de preço), soma a placa-mãe + memória + gabinete mais baratos que servem
nele, a placa de vídeo + fonte mais baratas para ele e o SSD mais barato; cada pedaço fica em cache.
O resultado é conferido com `allCompatible`. Sem montagem compatível → "Não encontramos uma combinação
compatível de peças no catálogo atual."; se ela passar do teto → "Orçamento insuficiente: a montagem
mais barata compatível custa R$ N. Suba o teto ou desative “Só lojas confiáveis”." (sem o filtro,
só "Suba o teto."). Com 150 peças por categoria, responde em menos de 200 ms (testado).

**Passo 3: guloso por fatias (`greedyPass`).** Fatias do `target` por categoria, interpoladas
linearmente pelo slider (`a = aesthetics/100`):

| Categoria | a = 0 (desempenho) | a = 1 (estética) |
|---|---|---|
| gpu | 0,42 | 0,30 |
| cpu | 0,17 | 0,14 |
| motherboard | 0,13 | 0,12 |
| ram | 0,07 | 0,09 |
| ssd | 0,08 | 0,07 |
| psu | 0,08 | 0,08 |
| case | 0,05 | 0,20 |

Depois da interpolação, o **perfil de uso** soma um ajuste (cada linha soma zero, então as fatias
continuam somando 1; nenhuma fica negativa):

| Perfil | gpu | cpu | ram | ssd |
|---|---|---|---|---|
| jogos | 0 | 0 | 0 | 0 |
| trabalho | −0,12 | +0,05 | +0,03 | +0,04 |
| criacao | −0,06 | +0,05 | +0,04 | −0,03 |

Passos de escolha (`GREEDY_STEPS`): **gpu → (cpu + motherboard) → ram → ssd → case → psu**. O
processador e a placa-mãe são escolhidos **juntos, como um par** (só pares do mesmo socket), porque
o processador mais barato sozinho pode obrigar a uma placa-mãe cara e o par sair mais caro. A fonte
vem por último porque depende do consumo. Em cada passo, `allowance = fatia × target + sobra`, onde
a fatia do par é a soma das duas e a `sobra` é o acumulado de `(allowance − gasto)` dos passos
anteriores (pode ficar negativa). As opções são ordenadas por utilidade (§5.2) e o passo escolhe a
primeira que **cabe** em `allowance` **e é viável**: compatível com o que já foi escolhido e, segundo
o planejador (`podeCompletar`), ainda permite completar uma montagem compatível. Se nenhuma cabe,
escolhe a viável **mais barata** e registra a categoria; no fim, uma nota só: "Para caber no
orçamento, usamos as opções compatíveis mais baratas em: processador, placa-mãe e memória RAM."
Se nenhuma opção for viável, o guloso devolve nada e vale a montagem mais barata do passo 2.

### 5.4 Sobras e folga (passo 5, `upgradePass`)
Com o limite igual ao teto (quando teto = alvo, só as sobras do alvo contam), sobe as peças na
**ordem do perfil de uso** (`upgradeOrder` em `scoring.ts`):

| Perfil | Ordem |
|---|---|
| jogos (padrão) | placa de vídeo → processador |
| criacao | processador → placa de vídeo |
| trabalho | **só o processador** (a folga nunca vai para a placa de vídeo) |

Em cada categoria, percorre os candidatos em ordem de utilidade e aceita o **melhor** que (a) tenha
utilidade ≥ 1,10 × a atual (`MIN_UPGRADE_GAIN`; com utilidade atual zero, exige só que seja maior),
(b) seja compatível com as outras peças e (c) mantenha `total ≤ hardCap` — trocando também a fonte
pela mais barata suficiente, se a atual não servir mais.

Notas (textos reais):

- uma por troca: "Subimos a placa de vídeo: A → B, por mais R$ X (+N% de desempenho)." Troca que
  sai mais barata: "…, economizando R$ X…"; sem diferença: "…, pelo mesmo preço…". Com troca da
  fonte: ", já contando a troca da fonte". Sem ganho de desempenho: "(mesmo desempenho, visual
  melhor)" ou "(visual melhor, N% menos desempenho)". O "+N%" vem só do `perf`;
- se as peças já passavam do alvo antes das trocas: "Antes das trocas, as peças já passavam R$ X do
  alvo (dentro do teto).";
- se as trocas pagas fizeram o total passar do alvo: "No total, as trocas usaram R$ X da folga
  (acima do alvo, dentro do teto); o resto veio do que sobrou dentro do alvo." (a última parte só
  quando parte do preço veio da sobra);
- acima do alvo sem troca paga: "A montagem ficou R$ X acima do alvo, mas dentro do teto."

`usedWiggleRoom = true` **só** quando houve troca que custou dinheiro **e** `totalPix > target`.
`BuildSuccess.upgrades` guarda as trocas (`category`, `from`, `to`, `priceDelta`, `perfGainPct`).
Selos na tela: "Usou a folga" (ou "Usou a folga até o teto" com sobra < R$ 1), "Acima do alvo,
dentro do teto" e "Dentro do alvo".

### 5.5 Teto (passo 4, garantia)
Se após o passo 3 o total for maior que `hardCap`, `downgradeToCap` repete, até caber:

1. pega a peça **mais cara** que tem opção compatível mais barata;
2. entre essas opções mais baratas, troca pela de **maior utilidade cuja troca já faz o total
   caber** no teto;
3. se nenhuma basta sozinha, troca pela mais barata dela e, na rodada seguinte, rebaixa a próxima
   peça.

Assim o rebaixamento nunca fica com uma peça pior **e** mais cara do que outra que também cabia
(ex. do teste: placa B de R$ 2.900 e perf 95 no lugar da C de R$ 2.500 e perf 100). Se ainda não
couber, usa a montagem mais barata do passo 2, com a nota "Para caber no teto, usamos a montagem
compatível mais barata." Se nem ela coubesse, o passo 2 já teria falhado com "Orçamento
insuficiente: a montagem mais barata compatível custa R$ N." **Invariante testada: `total ≤
hardCap` em todo resultado `ok`.**

### 5.6 Compatibilidade
- `cpu.socket === motherboard.socket`
- `ram.ramType === motherboard.ramType`
- `case.caseSupports` inclui `motherboard.formFactor`
- `psu.wattage ≥ ceil((gpu.tdp + cpu.tdp + 75) × 1,3)` (75 W de base para o resto)

`isCompatible` só compara pares em que as duas peças estão presentes; por isso o Montador exige
`hasRequiredSpec` (§5.1). O planejador (§5.3) depende do formato destas regras: uma regra nova que
ligue outras categorias obriga a mudar o planejador junto (pendência A-2).

## 6. Estimativa de desempenho (`estimatePerformance`)

1. `score = round(0,7 × gpu.perf + 0,3 × cpu.perf)`. `perf` inválido conta como 0 e gera a nota
   "O índice de desempenho … está inválido; a estimativa é parcial."
2. Gargalo: se `cpu.perf < 0,5 × gpu.perf`, nota "O processador pode limitar a placa de vídeo
   (gargalo)…".
3. Sem nenhuma referência válida (§4.3): nota `NOTA_SEM_REFERENCIAS`, `closest = SEM_REFERENCIA` e
   FPS zerados (nunca NaN).
4. FPS por perfil × resolução: interpolação linear entre as duas referências que cercam o `score`;
   abaixo da menor ou acima da maior, escala proporcional (`fps × score / scoreRef`). Arredonda para
   inteiro.
5. Memória, sem dupla contagem: com `capacityGb ≤ 16` e menos memória que as referências vizinhas,
   os FPS de `aaa-pesado` caem até 8%, proporcional ao peso das vizinhas de 32 GB; a nota diz "16 GB
   de memória: jogos pesados podem engasgar; 32 GB dá folga" e, se houve desconto, "Já descontamos N%
   dos FPS de jogos AAA pesados." Capacidade ausente: sem desconto e sem nota.
6. Upscaling: se a placa tem `DLSS`, `FSR` ou `XeSS`, nota informativa "Com DLSS ou FSR, os FPS podem
   subir bastante em 1440p. As estimativas não contam esse ganho." (os números não mudam).
7. **Comparável mais próximo**: a referência com menor `|score − ref.score|`; a tela diz
   "Equivale a um *PC intermediário forte*". **PCs parecidos com o seu**: as 3 mais próximas
   (`closestReferences`), com preço aproximado.
8. Gráfico: barras horizontais ordenadas por `score` com todas as referências e "Sua montagem" em
   destaque (uma cor para a sua, tom intermediário para as parecidas, cinza para as demais), dentro
   de `role="img"` com texto alternativo (`describeScorePosition`). A tabela de FPS é a versão
   textual e destaca a coluna da resolução escolhida.

Toda estimativa vem rotulada: "Estimativa: o resultado real varia com jogo, drivers e
configurações", com a faixa "Base: estimativa · fontes consultadas em nov/2026 · ver metodologia"
e o link para `/metodologia`.

## 7. Pagamento (`buildPaymentSummary`, `payments.ts`)

Premissa: no Brasil, "10x sem juros" vale sobre o **preço a prazo**, que já é maior que o Pix.
O site nunca mostra um parcelado abaixo do preço a prazo anunciado, nem um cartão mais barato que o
Pix.

**Por oferta.** Preço a prazo = `price_installment` se for número finito > 0 (`validInstallmentPrice`),
e **nunca abaixo do `price_pix`**; sem ele, vale o Pix e a oferta não parcela. Parcelas anunciadas =
`installment_count` entre **1 e 24** (`MAX_INSTALLMENTS`); sem preço a prazo válido, 1.
`offerInstallment(offer, tabela)` é a **fonte única** do "ou Nx de R$ X" na lista de peças, no CSV e
na página da peça (parcelas anunciadas, no máximo o fim da tabela da loja; total = preço a prazo).

**Por loja** (`StorePayment`; cada loja é um pagamento separado): `items`, `pixTotal`,
`installmentTotal` (soma dos preços a prazo), `installmentCount`, `interestTable` (se houver) e
`offersInstallmentCount` = o **menor** número de parcelas anunciado pelas ofertas da loja (**0** se
alguma oferta da loja só tem Pix).

**Total da loja em n parcelas** (n limitado ao máximo da loja):

1. sem tabela de juros: o preço a prazo, para qualquer n até o que as ofertas anunciam;
2. com tabela, **até `offersInstallmentCount`**: o preço a prazo das ofertas (o que a peça anuncia
   vale, mesmo que a tabela diga outra coisa);
3. com tabela, **acima disso**: `max(preço a prazo, pixTotal × fator(n))`. A tabela só encarece.

`fator(n)` (`rateFor`): a menor faixa da tabela que cobre n; entre faixas, a de cima (a mais cara);
acima da maior faixa, a maior. Faixas fora de 1..24 ou com fator < 1 são descartadas. Máximo da loja:
o maior número da tabela, ou o que as ofertas anunciam.

**Resumo** (`PaymentSummary`):

- `pixTotal` e `installmentTotal` = somas das lojas;
- `maxInstallments` = **sempre o MAIOR máximo entre as lojas**. Uma loja que só aceita Pix (ou parcela
  menos) limita só a si mesma; as faixas cuidam do resto;
- `installmentPlan(summary, n)`: n limitado a `[1, maxInstallments]`; cada loja fica em
  `min(n, máximo dela)`; devolve `count`, `monthly` (1ª parcela, a maior), `total` e `schedule`
  (faixas, ex.: "10x de R$ 586,17 + 2x de R$ 551,49", com Σ count × monthly = total). Os centavos que
  sobram da divisão de cada loja vão na 1ª parcela (`installmentBands` mostra as faixas sem eles e o
  valor do arredondamento à parte);
- `installmentOptions`: de 1x ao máximo, com o acréscimo de cada uma sobre o preço a prazo
  ("sem acréscimo" ou "+R$ X");
- `bestInstallment` = o plano **mais barato com mais de 1 parcela** (empate: o maior n);
  `pixSavings = bestInstallment.total − pixTotal`, **nunca negativo** ("Você economiza R$ X em relação a
  Nx no cartão, o parcelado mais barato.");
- `defaultInstallmentCount`: o seletor abre no **maior número de parcelas sem acréscimo**; se todas as
  opções têm acréscimo, em `bestInstallment.count`;
- `storeNoExtraUpTo`: até quantas parcelas a loja cobra só o preço a prazo ("sem acréscimo até Nx").

`BuildSuccess.totalInstallment` (o "ou R$ X parcelado" do cabeçalho) = `bestInstallment.total`, um
parcelado que existe de verdade.

**Tabelas de juros** (`store_installments(store_id, count, factor)`, `check (count between 1 and 24)`
e `factor ≥ 1`), lidas por `getInstallmentTables`: sem Supabase, `INSTALLMENT_TABLES` (ilustrativo);
com Supabase, erro ou tabela vazia → `{}` (vale o preço parcelado de cada oferta). As tabelas de
demonstração (iguais em `installment-tables.ts` e `seed-payments.sql`): KaBuM! 10x fator 1,10 e 12x
1,16; Pichau 12x 1,10; Terabyte 10x 1,10 e 12x 1,15; Promo Center 12x 1,15.

**Mistura Pix + cartão** (`mixedPlan`, aba "Misturar"): a pessoa informa "Tenho à vista" e "Cabe por
mês"; o plano só é calculado com **os dois campos preenchidos** (0 vale; com um só, a tela pede o
outro). O dinheiro à vista vai primeiro para as peças com **maior custo evitado** =
`max(preço a prazo, Pix × fator da loja no máximo de parcelas) − Pix` (empate: a mais cara); se uma
não cabe, tenta as seguintes. O resto vai para o cartão no **menor** número de parcelas cuja 1ª
parcela cabe no "cabe por mês"; se nenhum cabe, usa o máximo e avisa "Falta R$ X por mês para caber
no seu orçamento."

**Cupons** (`applyCoupon` em `coupons.ts`): lógica pronta e testada, **sem tela** e sem tabela no
banco (pendência E-1/E-3).

## 8. Interface

Tela `/montar`. Duas colunas no desktop (entradas à esquerda, fixas ao rolar; resultado à direita)
→ empilha no celular, sem rolagem horizontal.

1. **Painel de entradas**: "Quero gastar", "No máximo (teto)" (mostra a folga calculada), "Para que
   você vai usar?" (Jogos / Trabalho / Criação), "Resolução do monitor" (Full HD / Quad HD; a dica
   diz que só destaca a coluna de FPS), toggle "Só lojas confiáveis" ("Lojas oficiais com nota 4,5 ou
   mais e sem reclamações graves…"), slider "O que importa mais?" e o botão "Montar meu PC".
2. **Resultado**:
   - cabeçalho: "Total no Pix" como número-herói, "Alvo · Teto · Sobra até o teto", selo da situação
     (§5.4), "ou R$ X parcelado" (= `bestInstallment.total`) e as ações **"Salvar montagem"**,
     **"Copiar link"** e **"Baixar lista (CSV)"**;
   - "Como chegamos aqui": as notas de `autoBuild` (avisos de oferta suspeita primeiro);
   - **Peças**: categoria, nome (link para `/peca/[slug]`), loja com selo e motivos, preço Pix,
     "ou Nx de R$ X" (`offerInstallment`), "lido em DD/MM, HH:MM", "Ver na loja" e, quando for o
     caso, o aviso "Preço bom demais?";
   - **Desempenho esperado**: Índice GarimpoPC, "Equivale a um…", "PCs parecidos com o seu", gráfico
     de comparáveis, tabela de FPS e a faixa "Base: estimativa · … · ver metodologia";
   - **Como pagar**: abas Pix (à vista), Parcelado (faixas, seletor e acréscimos) e Misturar, mais a
     tabela por loja (§7).

**Link `?b=`** (`src/lib/share.ts`): `encodeBuild(prefs, parts)` gera base64url de um JSON compacto
com as preferências e as peças (slug + loja); `decodeBuild` é tolerante (código estranho, longo
demais ou com valores fora do permitido → `null`, e a tela avisa "Não conseguimos abrir este link").
Ao abrir, a tela restaura as escolhas, monta com os preços de hoje e explica o que mudou ("X saiu da
montagem: com os preços de hoje, outra peça ficou melhor.").

**CSV** ("Baixar lista (CSV)"): separador `;`, BOM para o Excel, colunas Categoria, Peça, Loja,
Preço Pix (R$), Parcelado (R$), Parcelas e Link, mais a linha Total; células que começam com `=`,
`+`, `-` ou `@` são neutralizadas.

**Salvar** (`SaveBuildButton` → `saveBuild`): com login, pede o nome (até 60 caracteres, padrão
"Minha montagem"); o servidor confere no banco que cada oferta é daquela peça e grava o preço de lá
em `saved_builds` (até 50 por pessoa). Sem login: "Entre para salvar a montagem" (volta à mesma
página depois de entrar). Sem banco (modo de demonstração): só o texto "Salvar montagens e alertas
precisam do banco configurado (modo de demonstração)." Em `/conta`, cada montagem tem "Abrir no
Montador", "Remover" e o alerta "Avisar quando a montagem custar até R$ X".

**`/metodologia`**: mostra `docs/METODOLOGIA-DESEMPENHO.md` dentro do site (o que é estimado, margem
de erro, fontes e o que não entra na conta).

Navegação: "Montar PC" no cabeçalho e no rodapé; a home tem o bloco "Quanto você pode gastar?" que
leva para `/montar?alvo=…&teto=…`. Design system e tokens: `DESIGN.md`.

## 9. Erros e limites

Mensagens reais, por onde aparecem:

| Situação | Comportamento e mensagem |
|---|---|
| Teto < alvo | Iguala e avisa (não bloqueia): "Teto menor que o alvo: vamos considerar o teto igual ao alvo (sem folga)." |
| Teto em branco | Usa o alvo: "Sem folga: a montagem fica dentro do valor que você quer gastar." |
| Valor vazio, zero, negativo ou ilegível | Campo em erro, botão desabilitado: "Informe um valor maior que zero." |
| Valor acima de R$ 1.000.000 | "Valor acima do permitido (R$ 1.000.000)." |
| Nenhuma peça com spec | "Nenhuma peça do catálogo tem especificação técnica cadastrada; não dá para montar agora." |
| Categoria sem spec | "Nenhuma placa de vídeo do catálogo tem especificação técnica cadastrada; não dá para montar agora." |
| Categoria sem oferta (ex.: filtro restritivo) | "Não há placa de vídeo disponível com os filtros atuais. Desative “Só lojas confiáveis” ou tente mais tarde." |
| Nenhuma combinação compatível | "Não encontramos uma combinação compatível de peças no catálogo atual." |
| Orçamento insuficiente | "Orçamento insuficiente: a montagem mais barata compatível custa R$ N. Suba o teto ou desative “Só lojas confiáveis”." |
| Catálogo vazio ou banco fora do ar | Caixa "Catálogo indisponível": "Não conseguimos ler o catálogo agora, ou ele ainda está vazio…" |
| Banco sem `part_specs` | Caixa "Sem especificações cadastradas" |
| Link `?b=` inválido | Caixa "Não conseguimos abrir este link": "O link de montagem está incompleto ou foi alterado…" |
| Misturar com um campo só | "Preencha também quanto cabe por mês (pode ser 0)." ou "Preencha também quanto você tem à vista (pode ser 0)." |
| Valor ilegível em Misturar | "Digite um valor em reais, ex.: 1.500 ou 1.500,50" |
| Salvar sem login | "Você precisa entrar para salvar a montagem." |
| Limite de montagens | "Você já tem 50 montagens salvas. Remova alguma em Minha conta para salvar esta." |
| Oferta mudou ao salvar | "Alguma oferta da montagem mudou ou saiu do ar. Monte de novo e tente salvar." |
| Nome longo | "O nome pode ter até 60 caracteres." |
| Preço-alvo de alerta inválido | "Informe um preço-alvo válido." / "O preço-alvo pode ser de no máximo R$ 1.000.000,00." |
| Modo de demonstração (sem Supabase) | Faixa "Modo de demonstração. Peças, preços, lojas e reputação (nota, Reclame Aqui), juros e índices de desempenho são de exemplo." |

Login (`/entrar`): a URL só carrega **códigos** (`?erro=credenciais`, `?mensagem=conta-criada`), que a
página traduz ("E-mail ou senha incorretos.", "A senha deve ter pelo menos 6 caracteres." etc.);
código desconhecido não mostra nada.

Rota de alertas (`/api/check-alerts`): **503** sem `CRON_SECRET`, sem a chave de serviço ou, em
produção, sem `RESEND_API_KEY`; **401** com token errado (comparação em tempo constante). E-mail
simulado não marca o alerta como avisado. Ao avisar, o alerta é desligado (`is_active = false`,
`notified_at` preenchido) e a `/conta` oferece "Reativar".

## 10. Testes

**Vitest** (`npm test`, padrão `src/**/*.test.ts`): **23 arquivos**.

| Arquivo | O que cobre |
|---|---|
| `src/services/builder/auto-build.test.ts` | Invariantes (120 combinações do exemplo e 200 preferências aleatórias sobre 150 peças por categoria), montagem mais barata contra força bruta, tempo com catálogo grande, folga com ganho ≥ 10%, folga por perfil, par CPU + placa-mãe, rebaixamento por utilidade, oferta suspeita, peças ignoradas, falhas e textos das notas |
| `src/services/builder/budget.test.ts` | Normalização teto < alvo, folga, `fitsHardCap` |
| `src/services/builder/compatibility.test.ts` | Socket, RAM, form factor, fonte e `hasRequiredSpec` |
| `src/services/builder/scoring.test.ts` | Utilidade (slider 0 e 100), fatias somando 1 em cada perfil, ordem da folga por perfil (`upgradeOrder`) |
| `src/services/builder/trust.test.ts` | Régua de confiança, motivos, bloqueio, números como texto, `validOffers` |
| `src/services/builder/suspicious.test.ts` | Limite de 25%, mediana, sem preço confiável |
| `src/services/builder/performance.test.ts` | Índice, interpolação, referências inválidas e vazias, memória sem dupla contagem, upscaling, PCs parecidos |
| `src/services/builder/payments.test.ts` | Piso a prazo, parcelas anunciadas × tabela, máximo entre lojas, faixas e centavos, `bestInstallment`, seletor, `offerInstallment` |
| `src/services/builder/mixed-plan.test.ts` | Custo evitado, menor número de parcelas que cabe, campos obrigatórios |
| `src/services/builder/coupons.test.ts` | Validade, mínimo e teto do desconto |
| `src/services/specs.test.ts` | Mock só sem Supabase, vazio com banco, validação das linhas, coerência com o seed |
| `src/services/references.test.ts` | Mock só sem Supabase, `[]` em erro ou tabela vazia, `mapReferenceRow`, coerência com o seed |
| `src/services/installments.test.ts` | Agrupamento e validação das linhas de juros |
| `src/services/products.test.ts` | Normalização, busca, histórico só com ofertas honestas |
| `src/services/saved-builds.test.ts` | Serialização da montagem salva, validações, total atual |
| `src/services/email.test.ts` | Escape do HTML e links seguros |
| `src/lib/money.test.ts` | `parseMoney` ("6.000,50", "6000.5", lixo) e limites |
| `src/lib/share.test.ts` | Ida e volta do link `?b=`, códigos inválidos ou fora do permitido, CSV (formato, fórmulas neutralizadas, parcelado igual ao da tela) |
| `src/lib/format.test.ts` | Formatação, `getBestOffer` (pula suspeita e loja bloqueada), `offerWarning`, `trustLabel` |
| `src/models/categories.test.ts` | As sete categorias, apelidos em português na busca e rótulos |
| `src/app/auth/actions.test.ts` | Caminho seguro do `next` e códigos de erro e de sucesso do login |
| `src/app/account/actions.test.ts` | Salvar com o preço do banco, oferta de outra peça, limite de 50, alertas e reativação só do dono |
| `src/app/api/check-alerts/route.test.ts` | 503 sem `CRON_SECRET`, 401 com token errado, e-mail simulado não marca, avisado desliga, oferta suspeita não dispara |

**Playwright** (`npm run test:e2e`, pasta `tests/e2e/`, 3 arquivos): `montar.spec.ts` (montagem
dentro do teto, Pix × parcelado, seletor abrindo no maior número sem acréscimo, orçamento pequeno,
celular sem rolagem horizontal, aba Misturar, perfil e resolução, valor inválido e prévia do valor
entendido, link `?b=` válido e inválido, URL com `?b=` depois de montar, oferta "boa demais" com o
filtro desligado), `navegacao.spec.ts` (home → Montador com valor quebrado, busca, comparação de
lojas, `/conta` sem login volta depois de entrar, códigos de erro do `/entrar`, cabeçalhos de
segurança) e `peca.spec.ts` (melhor preço honesto, aviso "Preço bom demais?" e parcelado igual ao
anunciado).

## 11. O que a V1 entregou, o que a V2 entregou e o que fica para depois

- **V1 (scaffold):** o fluxo completo com dados ilustrativos, UI nova e testes da lógica.
- **V2 (no ar):** specs, referências e juros vindos do banco com a regra "dado ilustrativo nunca vira
  fato" (A, D, E); planejador exato, par processador + placa-mãe, perfis de uso, rebaixamento por
  utilidade e oferta suspeita no Montador (B); régua única de confiança com motivos e "Preço bom
  demais?" (C); 12 PCs de referência, memória, upscaling e `/metodologia` (D); preço a prazo como
  piso, parcelas anunciadas, faixas, parcelado mais barato e aba Misturar (E); `parseMoney`, perfil,
  resolução, link `?b=`, CSV e acessibilidade (F); montagens salvas, alerta da montagem inteira,
  "lido em" e rota de alertas fechada (G); CI, coleta diária com monitor de seletores e e2e (H).
- **Depois da V2:** todos os `TODO(V2-<pacote>)` do código e os itens adiados (catálogo como prop,
  CSP com nonce, deduplicação de visitas, restrições no banco, categoria cooler) estão em
  `docs/PENDENCIAS-POS-V2.md`.
