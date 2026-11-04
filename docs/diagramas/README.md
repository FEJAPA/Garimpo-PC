# Diagramas do GarimpoPC

Esta pasta explica o GarimpoPC com **desenhos** (diagramas Mermaid) e textos curtos em português
simples. Os desenhos seguem o **código real**: os nomes de funções, rotas e tabelas existem com
esses nomes. Retrato de **04/11/2026, ao fim da rodada final de correções da V2**. Onde algo
ainda não existe, o desenho marca em cinza tracejado e aponta para
[`../PENDENCIAS-POS-V2.md`](../PENDENCIAS-POS-V2.md).

## Os diagramas

| Arquivo | Para quem | O que explica |
|---|---|---|
| [`jornada-usuario.md`](jornada-usuario.md) | Produto, design, qualquer pessoa | O caminho da pessoa leiga: home, orçamento, `/montar` (perfil de uso, resolução, filtro de lojas), resultado, ir à loja, salvar a montagem, entrar (o login volta para onde ela estava) e criar alertas. Mostra os estados da tela e as mensagens de erro. |
| [`mapa-de-telas.md`](mapa-de-telas.md) | Produto, design, desenvolvimento | Todas as rotas (`/`, `/busca`, `/peca/[slug]`, `/montar`, `/metodologia`, `/entrar`, `/conta` e a API `/api/check-alerts`), o que cada uma mostra e como se chega de uma à outra. Inclui as ações de servidor. |
| [`fluxo-montador.md`](fluxo-montador.md) | Desenvolvimento | O algoritmo de `autoBuild` passo a passo: `collectCandidates` (peças ignoradas e oferta suspeita), o planejador exato, o guloso com o par processador + placa-mãe, o rebaixamento por utilidade, a folga na ordem do perfil de uso, o desempenho e o pagamento. Com exemplos numéricos reais. |
| [`fluxo-pagamento.md`](fluxo-pagamento.md) | Produto, desenvolvimento | Como o site calcula Pix × parcelado: o preço a prazo como piso, as parcelas anunciadas pela oferta, as tabelas de juros por loja, as faixas, o parcelado mais barato (`bestInstallment`) e a aba Misturar. Com exemplo numérico. |
| [`arquitetura.md`](arquitetura.md) | Desenvolvimento | As camadas `models`, `services` e `app`/`components`, o Supabase × modo de demonstração (e a regra "dado ilustrativo nunca vira fato"), a coleta de preços, o job de alertas e todas as tabelas do banco. |
| [`fluxo-dados.md`](fluxo-dados.md) | Desenvolvimento, operação | O ciclo de vida de um preço: loja, `collect-prices.mjs`, `offers` e `price_history`, telas e gráfico, e o e-mail de alerta (de peça e de montagem inteira). Aponta as lacunas que sobraram. |

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
| **Cinza tracejado** | **Ainda não existe: pendência pós-V2** (ver `PENDENCIAS-POS-V2.md`) |
| **Cinza-azulado tracejado** | **Código pronto, mas sem tela** (hoje, só os cupons) |

## Em que ponto a V2 está (04/11/2026)

O plano está em `docs/superpowers/plans/2026-11-04-montador-de-pc-v2.md`. Todos os pacotes estão
**no ar**. O que falta em cada um está em `docs/PENDENCIAS-POS-V2.md`.

| Pacote | Tema | Situação | O que ficou para depois |
|---|---|---|---|
| A | Catálogo e specs reais | **No ar.** `/montar` carrega as specs com `getPartSpecs()`. Sem Supabase usa o mock; com Supabase usa só o banco, e tabela vazia mostra o aviso "Sem especificações cadastradas". `hasRequiredSpec` barra spec incompleta, e as peças ignoradas viram nota. `collect-specs.mjs` grava `part_specs`. | Regras de compatibilidade extras, categoria cooler (A4), `--atualizar` |
| B | Algoritmo v2 | **No ar.** Planejador exato da montagem mais barata, par processador + placa-mãe no guloso, utilidade ponderada pelas fatias, perfis de uso nas fatias e na ordem da folga, rebaixamento pela peça de maior utilidade que cabe, oferta suspeita só como último recurso e com aviso. | Otimização global (busca em feixe) |
| C | Confiança de lojas | **No ar.** Uma régua só (`isTrustedStore`/`storeTrust`): oficial, nota 4,5 ou mais, Reclame Aqui 6 ou mais quando informado e nunca bloqueada. O selo mostra os motivos. "Preço bom demais?" aparece em `/peca`, nos cards e em cada peça de `/montar`. | Reclame Aqui real, limites configuráveis, histórico na suspeita |
| D | Benchmarks e gráfico | **No ar.** 12 PCs de referência, "PCs parecidos com o seu", desconto de memória sem dupla contagem, nota de upscaling, página `/metodologia`. Com Supabase, erro ou tabela vazia não mostram referências de exemplo: a tela avisa que não há comparação. | Benchmarks medidos por jogo |
| E | Pagamentos realistas | **No ar.** Tabelas de juros ligadas à tela, preço a prazo como piso, "sem acréscimo" até o número de parcelas anunciado pela oferta, faixas por loja, parcelado mais barato e aba "Misturar" visível. | Cupom na tela, cashback, mistura ótima |
| F | UI/UX do Montador | **No ar.** `parseMoney` com limite, perfil de uso e resolução, link `?b=`, lista em CSV, esqueleto de carregamento, foco no resultado, ajustes de acessibilidade. | — |
| G | Montagens salvas e alertas | **No ar.** "Salvar montagem", "Minhas montagens" em `/conta`, alerta da montagem inteira, "lido em DD/MM, HH:MM" em cada peça. A rota de alertas responde 503 sem `CRON_SECRET` e 401 com token errado. O alerta avisado é desligado e ganha "Reativar". O login volta para a página de origem. | — |
| H | Qualidade e operação | **No ar.** CI (`ci.yml`), coleta diária com monitor de seletores (`coleta.yml`) e testes ponta a ponta. | Monitor e concorrência da coleta |

## Como manter estes diagramas em dia

1. Mudou uma rota, função ou tabela? Procure o nome antigo com `grep -rn "nomeAntigo" docs/diagramas`
   e atualize o desenho e o texto.
2. Uma pendência foi resolvida? Troque o nó cinza tracejado por um nó normal, atualize a tabela acima
   e apague a linha em `docs/PENDENCIAS-POS-V2.md`.
3. Regras de nomes nos desenhos: rótulos sempre entre aspas (`["texto"]`), sem aspas dentro do texto
   e sem `;` ou `#` nas mensagens de diagramas de sequência.
4. Os números dos exemplos vêm do catálogo de exemplo (`src/models/mock-data.ts` e
   `src/models/installment-tables.ts`). Se os preços ou os juros de exemplo mudarem, rode
   `npx vitest run src/services/builder` e confira os valores citados em `fluxo-montador.md` e
   `fluxo-pagamento.md`.
