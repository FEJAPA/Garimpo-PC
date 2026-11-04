# Montador de PC — especificação (V1 scaffold → V2)

Data: 2026-11-04 · Status: aprovado para scaffold V1 (esta sessão) e base do plano V2.

Este documento diz **como o Montador deve funcionar**, passo a passo. O plano de
execução da V2 (pacotes de trabalho para o agent army) está em
`docs/superpowers/plans/2026-11-04-montador-de-pc-v2.md`.

## 1. Objetivo

Dado um orçamento, montar automaticamente um PC gamer completo (7 categorias: placa de
vídeo, processador, placa-mãe, memória, armazenamento, fonte, gabinete) com peças
compatíveis entre si, compradas em lojas confiáveis, e mostrar:

1. a lista de peças com loja e preço (Pix e parcelado);
2. o desempenho esperado, comparado com computadores de referência (gráfico + tabela);
3. um plano de pagamento (Pix à vista ou parcelado, por loja).

## 2. Vocabulário

| Termo | Significado |
|---|---|
| **Orçamento alvo** (`target`) | quanto a pessoa *quer* gastar. Ex.: R$ 6.000. |
| **Teto** (`hardCap`) | o máximo absoluto. Ex.: R$ 7.000. **Nunca** é ultrapassado. |
| **Folga** (*wiggle room*) | `hardCap − target`. Só é usada se destravar uma melhora real (regra em §5.4). |
| **Lojas confiáveis** | loja com `is_official = true` **e** `rating ≥ 4.5`. |
| **Balanço** (`aesthetics`, 0–100) | 0 = máximo desempenho, 100 = máxima estética. |
| **Índice de desempenho** | número relativo por categoria (RTX 4060 = 100 entre GPUs; Ryzen 5 7600 = 100 entre CPUs). |
| **Índice GarimpoPC** | nota única da montagem: `round(0,7 × GPU + 0,3 × CPU)`. |

Interpretação do brief: "6k mas o limite é 7k" → `target = 6000`, `hardCap = 7000`,
folga = 1.000. Esses são os **valores padrão** do formulário; a pessoa pode mudar os
dois. O teto é da pessoa, não um limite global do site.

## 3. Fluxo da pessoa (tela `/montar`)

1. Informa **orçamento alvo** e **teto**. Se o teto for menor que o alvo, o formulário
   iguala o teto ao alvo (folga zero) e avisa.
2. Liga/desliga **"Só lojas confiáveis"** (ligado por padrão).
3. Ajusta o **slider** Desempenho ↔ Estética (padrão 25, levemente para desempenho).
4. Clica **"Montar meu PC"**. A montagem é calculada na hora (no navegador, V1).
5. Vê o resultado em três blocos: **Peças**, **Desempenho esperado**, **Pagamento**.
6. Pode alterar qualquer entrada e remontar; pode ir para a loja de cada peça.

Estados: vazio (antes de montar: explica o que vai acontecer), carregando (botão em
estado *loading*, resultado anterior esmaecido), erro (orçamento insuficiente), sucesso.

## 4. Dados necessários

### 4.1 Catálogo (já existe)
`products` + `offers` + `stores` (ver `src/models/types.ts`). A montagem usa apenas
ofertas `in_stock`.

### 4.2 Especificações por peça (`PartSpec`, novo — `src/models/part-specs.ts`)
Chaveado por `slug`:

| Campo | Categorias | Descrição |
|---|---|---|
| `perf` | todas | índice de desempenho relativo (ver §2). Para gabinete = fluxo de ar; fonte = potência/eficiência; placa-mãe = recursos. |
| `aesthetics` | todas | 0–100, quanto a peça contribui para o visual (vidro, ARGB, branco…). |
| `tdp` | gpu, cpu | consumo em W para dimensionar a fonte. |
| `socket` | cpu, motherboard | `AM5`, `AM4`, `LGA1700`. |
| `ramType` | motherboard, ram | `DDR4`, `DDR5`. |
| `formFactor` | motherboard | `ATX`, `mATX`, `ITX`. |
| `caseSupports` | case | lista de form factors aceitos. |
| `wattage` | psu | potência nominal em W. |

Na V1 os valores são **ilustrativos** (mantidos num arquivo TS). Na V2 vão para a tabela
`part_specs` (scaffold em `supabase/schema-builder.sql`) e são alimentados por fontes reais.

### 4.3 Computadores de referência (`ReferenceBuild`, novo — `src/models/reference-builds.ts`)
Seis montagens típicas (de "equivalente a console" a "entusiasta") com: nome, descrição,
peças principais, preço aproximado, `score` (Índice GarimpoPC) e FPS médio estimado em
`1080p` e `1440p` para três perfis de jogo: `esports` (leve), `aaa-medio`, `aaa-pesado`.
Ilustrativos na V1; benchmarks agregados reais na V2 (pacote D).

## 5. Algoritmo de montagem automática (`autoBuild`)

Entrada: catálogo, `PartSpec`s, preferências `{ budget: {target, hardCap}, trustedOnly,
aesthetics }`. Saída: `BuildResult` (sucesso com peças, totais, notas, desempenho e
pagamento; ou falha com motivo).

### 5.1 Candidatos
Para cada categoria: produtos que têm `PartSpec` **válida** (`hasRequiredSpec`: campos obrigatórios por
categoria, `perf` > 0, categoria igual à do produto) e ao menos uma oferta `in_stock` com preço > 0
(se `trustedOnly`, só ofertas de lojas confiáveis; loja bloqueada nunca). O preço do candidato é o **menor
`price_pix`** entre as ofertas válidas **não suspeitas** (≥ 25% abaixo da mediana das lojas confiáveis =
suspeita); se só houver suspeitas, usa a mais barata e marca `Candidate.suspicious`, e a tela avisa.
Peças ignoradas por spec ausente/inválida são contadas em `BuildSuccess.ignored` e viram uma nota.
`BuildPreferences.usage` ("jogos" | "trabalho" | "criacao") ajusta as fatias de §5.3.

### 5.2 Utilidade de uma peça
Para a categoria, `perfNorm = perf / maior perf entre os candidatos` e
`aesNorm = aesthetics / 100`. A estética só pesa nas peças visíveis:

| Categoria | relevância estética |
|---|---|
| case 1,0 · ram 0,8 · gpu 0,6 · psu 0,3 · motherboard 0,3 · cpu 0 · ssd 0 |

`w = (aesthetics / 100) × relevância` e **`utilidade = (1 − w) × perfNorm + w × aesNorm`**.
Desempate: menor preço, depois `slug`.

### 5.3 Divisão do orçamento (passo 1, dentro do alvo)
Fatias do `target` por categoria, interpoladas linearmente pelo slider (`a = aesthetics/100`):

| Categoria | a = 0 (desempenho) | a = 1 (estética) |
|---|---|---|
| gpu | 0,42 | 0,30 |
| cpu | 0,17 | 0,14 |
| motherboard | 0,13 | 0,12 |
| ram | 0,07 | 0,09 |
| ssd | 0,08 | 0,07 |
| psu | 0,08 | 0,08 |
| case | 0,05 | 0,20 |

Ordem de escolha: **gpu → cpu → motherboard → ram → ssd → case → psu** (fonte por último
porque depende do consumo). Em cada categoria, percorre os candidatos compatíveis em ordem
de utilidade e escolhe o primeiro cujo preço cabe em `fatia + sobra`, onde `sobra` é o
acumulado de `(fatia − gasto)` das categorias anteriores (pode ficar negativa). Se nenhum
cabe, escolhe o **mais barato compatível** e registra uma nota.

### 5.4 Sobras e folga (passo 2)
Com o limite igual ao teto (quando teto = alvo, só as sobras do alvo contam), tenta **subir a placa de vídeo** e depois o **processador**:
percorre os candidatos compatíveis em ordem de utilidade e aceita o **melhor** que (a)
tenha utilidade ≥ 1,10 × utilidade atual e (b) mantenha `total ≤ hardCap` — incluindo,
se a troca exigir, a troca da fonte pela mais barata suficiente. Se aceitou alguma troca e
`total > target`, marca `usedWiggleRoom = true` (só quando houve troca E o total passou do alvo) e explica
em uma nota por troca ("Usou R$ X da folga para subir de A para B") mais uma nota com o total;
`BuildSuccess.upgrades` guarda as trocas. Um total acima do alvo sem troca aparece como
"Acima do alvo, dentro do teto".

### 5.5 Teto (garantia)
Se após o passo 1 o total for maior que `hardCap`, rebaixa a categoria mais cara para a
próxima opção compatível mais barata, repetindo até caber ou esgotar. Se não couber de
jeito nenhum: `{ ok: false, reason: "Orçamento insuficiente: a montagem mais barata
compatível custa R$ N." }`. **Invariante testada: `total ≤ hardCap` em todo resultado
`ok`.**

### 5.6 Compatibilidade
- `cpu.socket === motherboard.socket`
- `ram.ramType === motherboard.ramType`
- `case.caseSupports` inclui `motherboard.formFactor`
- `psu.wattage ≥ ceil((gpu.tdp + cpu.tdp + 75) × 1,3)` (75 W de base para o resto)

## 6. Estimativa de desempenho (`estimatePerformance`)

1. `score = round(0,7 × gpu.perf + 0,3 × cpu.perf)`.
2. Gargalo: se `cpu.perf < 0,5 × gpu.perf`, nota "o processador pode limitar a placa".
3. FPS por perfil × resolução: interpolação linear entre os dois computadores de
   referência que cercam o `score`; abaixo do menor ou acima do maior, escala proporcional
   (`fps × score / scoreRef`). Arredonda para inteiro.
4. **Comparável mais próximo**: a referência com menor `|score − ref.score|`; a tela diz
   "equivale a um *PC intermediário 2025*".
5. Gráfico: barras horizontais ordenadas por `score` com todas as referências e "Sua
   montagem" em destaque (forma *ênfase*: uma cor para a sua, cinza para as demais).
   Legenda/tabela: a tabela de FPS é a versão textual (nunca só tooltip).

Toda estimativa vem rotulada: "Estimativa com base em computadores comparáveis; o
resultado real varia com jogo, drivers e configurações".

## 7. Pagamento (`buildPaymentSummary`, scaffold)

- `pixTotal` = soma dos `price_pix`.
- `installmentTotal` = soma dos `price_installment` (se nulo ou ≤ 0, usa `price_pix`). É o **preço a prazo** das ofertas e,
  na V2, é o piso do parcelado mesmo com tabela de juros (a tabela só encarece).
- `maxInstallments` = menor `installment_count` entre as lojas usadas (nulo = 1). **V2 (pacote E):**
  quando a loja tem tabela de juros (`store_installments`), cada loja usa o seu máximo e o seletor
  vai até o MAIOR deles; parcela = soma por loja de `pixTotal × fator(n)`.
- Por loja: itens, `pixTotal`, `installmentTotal`, `installmentCount`. (Cada loja é um
  pagamento separado; a tela mostra isso.)
- `installmentPlan(summary, n)`: `n` limitado a `[1, maxInstallments]`; parcela =
  `installmentTotal / n`. **Premissa V1:** o preço parcelado da loja vale para qualquer
  número de parcelas até o máximo. V2 (pacote E): tabela de juros por loja e por número de
  parcelas, mistura Pix + cartão, "quanto cabe por mês".
- `pixSavings = bestInstallment.total − pixTotal`, onde `bestInstallment` é o plano parcelado mais barato com
  mais de 1 parcela ("você economiza R$ X em relação a Nx no cartão"). **V2 (pacote E):** `installmentPlan`
  devolve também `schedule` (faixas, ex.: 10x de R$ 586,17 + 2x de R$ 551,49, com Σ count × monthly = total e
  os centavos ajustados na 1ª parcela de cada loja); "sem acréscimo até Nx" significa "mesmo preço a prazo da
  oferta até Nx"; parcelas limitadas a 1..24; o seletor abre no maior número de parcelas sem acréscimo.
  O plano misto (`mixedPlan`) manda para o Pix as peças com maior custo evitado (ágio a prazo e juros).

## 8. Interface

Tela `/montar` (Operate). Três colunas no desktop → empilha no celular:

1. **Painel de entradas** (esquerda, fixo ao rolar no desktop): orçamento alvo, teto
   (mostra a folga calculada), toggle lojas confiáveis, slider, botão "Montar meu PC".
2. **Resultado** (centro/direita): 
   - cabeçalho com total Pix, "dentro do alvo / usou folga / no teto" e Índice GarimpoPC
     como número-herói;
   - lista de peças (categoria, nome, loja com selo, preço Pix, parcelado, "Ver na loja");
   - desempenho esperado: comparável mais próximo, gráfico, tabela de FPS;
   - pagamento: Pix × Parcelado, seletor de parcelas, por loja.

Navegação: "Montar PC" entra no cabeçalho; a home ganha um bloco "Diga quanto pode
gastar" que leva para `/montar`.

Design system e tokens: `DESIGN.md`.

## 9. Erros e limites

- Teto < alvo → iguala e avisa (não bloqueia).
- Valores não numéricos/negativos → campo em erro, botão desabilitado.
- Nenhuma peça em alguma categoria (ex.: filtro de lojas muito restritivo) → falha com
  motivo que diz a categoria e sugere desligar o filtro.
- Catálogo vazio (Supabase sem dados) → tela explica e aponta para o seed.
- Modo demonstração (sem Supabase) → faixa "dados de exemplo" como nas outras telas.

## 10. Testes (Vitest, `src/services/builder/*.test.ts`)

- orçamento: normalização teto<alvo; folga; `fitsHardCap`.
- lojas confiáveis: filtro de ofertas; menor preço entre as válidas.
- utilidade: slider 0 ignora estética; slider 100 em gabinete ignora desempenho; CPU
  nunca pesa estética.
- compatibilidade: socket, RAM, form factor, fonte.
- montagem: invariante `total ≤ hardCap`; folga só usada com ganho ≥ 10%; com
  `trustedOnly` nenhuma peça vem de loja não confiável; slider alto escolhe gabinete
  mais bonito; orçamento impossível → `ok: false` com valor mínimo na mensagem.
- desempenho: índice; interpolação; comparável mais próximo; gargalo.
- pagamento: totais, parcelas limitadas, economia no Pix.

## 11. O que a V1 (scaffold) entrega e o que fica para a V2

V1: tudo acima funcionando com dados ilustrativos, UI nova, testes da lógica.
V2 (plano): catálogo e specs reais, algoritmo com otimização global e perfis de uso,
reputação de lojas, benchmarks reais, pagamentos com juros reais, salvar/compartilhar
montagem, e2e + CI. Cada `TODO(V2-<pacote>)` no código aponta para um pacote do plano.
