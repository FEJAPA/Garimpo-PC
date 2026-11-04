# Diagramas do GarimpoPC

Esta pasta explica o GarimpoPC com **desenhos** (diagramas Mermaid) e textos curtos em português
simples. Os desenhos seguem o **código real** (nomes de funções, rotas e tabelas existem com
esses nomes); onde a V2 do Montador ainda não existe, o desenho marca isso em cinza tracejado.

## Os diagramas

| Arquivo | Para quem | O que explica |
|---|---|---|
| [`jornada-usuario.md`](jornada-usuario.md) | Produto, design, qualquer pessoa | O caminho da pessoa leiga: chegar na home, informar o orçamento, montar o PC em `/montar`, ajustar, ler o resultado, ir à loja e, se quiser, entrar e criar um alerta. Mostra os estados da tela (vazio, carregando, erro, sucesso) e as decisões que mais importam: teto menor que o alvo, orçamento insuficiente e filtro de lojas. |
| [`mapa-de-telas.md`](mapa-de-telas.md) | Produto, design, desenvolvimento | Todas as rotas (`/`, `/busca`, `/peca/[slug]`, `/montar`, `/entrar`, `/conta` e a API `/api/check-alerts`), o que cada uma mostra e qual botão ou link leva de uma para outra. Inclui as ações de servidor que não são páginas. |
| [`fluxo-montador.md`](fluxo-montador.md) | Desenvolvimento | O algoritmo de `autoBuild` passo a passo: candidatos, montagem mais barata, passo guloso por fatias, rebaixamento até o teto, subida de placa de vídeo e processador com sobras e folga, desempenho e pagamento. Traz as regras (fatias, utilidade, compatibilidade, ganho mínimo de 10%, `total ≤ teto`) e exemplos numéricos reais. |
| [`fluxo-pagamento.md`](fluxo-pagamento.md) | Produto, desenvolvimento | Como o site calcula Pix × parcelado por loja, o que a tela "Como pagar" faz e o que a V2 (juros por loja, mistura Pix + cartão, cupons) já tem de código pronto. Com um exemplo numérico real. |
| [`arquitetura.md`](arquitetura.md) | Desenvolvimento | As camadas `models`, `services` e `app`/`components`, o Supabase × modo de demonstração, a coleta de preços, o job de alertas e todas as tabelas do banco. |
| [`fluxo-dados.md`](fluxo-dados.md) | Desenvolvimento, operação | O ciclo de vida de um preço: loja, `collect-prices.mjs`, `offers` e `price_history`, telas e gráfico, e por fim o e-mail de alerta. Aponta as lacunas do ciclo. |

## Como visualizar

- **No GitHub**: abra qualquer arquivo `.md` desta pasta. Os blocos marcados como `mermaid` viram
  desenhos automaticamente (inclusive no celular).
- **No VS Code**: instale a extensão "Markdown Preview Mermaid Support" e abra a visualização do
  Markdown (`Ctrl+Shift+V`).
- **Em qualquer navegador**: copie o conteúdo de um bloco `mermaid` e cole em
  <https://mermaid.live> para ver, editar ou exportar como imagem.

## Como ler as cores

Os diagramas usam as mesmas cores com o mesmo significado, e cada página repete a legenda:

| Cor | Significado |
|---|---|
| Amarelo | Tela ou passo que roda hoje |
| Azul | Decisão (pergunta com "sim" e "não") |
| Vermelho | Erro ou falha |
| Verde | Sucesso ou resultado para a pessoa |
| Roxo | Regra ou banco de dados |
| Laranja | Robô ou script |
| Cinza claro | Fora do projeto (lojas, e-mail, agendador) |
| **Cinza tracejado** | **V2 que ainda não existe** |
| **Cinza-azulado tracejado** | **V2 com código pronto, mas ainda não ligado à tela** |

## Em que ponto a V2 estava quando os diagramas foram feitos (04/11/2026)

O plano está em `docs/superpowers/plans/2026-11-04-montador-de-pc-v2.md`. Os desenhos refletem
esta situação:

| Pacote | Tema | Situação nos diagramas |
|---|---|---|
| A | Catálogo e specs reais | `getPartSpecs` e `collect-specs.mjs` existem, mas `/montar` ainda usa `PART_SPECS` do mock. O aviso "peças ignoradas por falta de spec" ainda não existe. |
| B | Algoritmo v2 | Ainda não existe: `autoBuild` segue guloso. |
| C | Confiança de lojas | Está no ar: `storeTrust` decide quem é confiável e `/peca/[slug]` mostra motivos e o aviso "Preço bom demais?". O aviso ainda não aparece em `/montar`. |
| D | Benchmarks e gráfico | Código pronto (`closestReferences`, penalidade de 16 GB, nota de upscaling, `getReferenceBuilds`); `/montar` ainda não passa as referências do servidor. |
| E | Pagamentos realistas | Código pronto (juros por loja, `mixedPlan`, `applyCoupon`); a aba Misturar fica escondida e nenhuma página carrega as tabelas de juros. |
| F | UI/UX do Montador | Ainda não existe (compartilhar link, perfil de uso, resolução). |
| G | Montagens salvas e alertas | Ainda não existe: só a tabela `saved_builds` no SQL. |
| H | Qualidade e operação | Existem o CI (`ci.yml`), a coleta diária com monitor de seletores (`coleta.yml`) e os testes e2e. |

## Como manter estes diagramas em dia

1. Mudou uma rota, função ou tabela? Procure o nome antigo com `grep -rn "nomeAntigo" docs/diagramas`
   e atualize o desenho e o texto.
2. Uma peça da V2 foi ligada à tela? Troque o nó cinza tracejado por um nó normal e atualize a
   tabela acima.
3. Regras de nomes nos desenhos: rótulos sempre entre aspas (`["texto"]`), sem aspas dentro do texto
   e sem `;` ou `#` nas mensagens de diagramas de sequência.
4. Os números dos exemplos vêm do catálogo de exemplo (`src/models/mock-data.ts`). Se os preços de
   exemplo mudarem, rode `npx vitest run src/services/builder/auto-build.test.ts` e confira os
   valores citados em `fluxo-montador.md` e `fluxo-pagamento.md`.
