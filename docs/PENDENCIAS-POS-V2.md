# Pendências depois da V2

Data: 04/11/2026, ao fim da rodada final de correções da V2.

Este arquivo junta num só lugar **tudo o que ficou para depois da V2**:

1. os marcadores `TODO(V2-<pacote>)` que ainda estão no código;
2. os itens que o Comandante do *agent army* adiou de propósito;
3. outros adiamentos registrados pelos revisores.

Cada linha diz o que falta, por que importa e onde está. O pacote é a letra do plano da V2
(`docs/superpowers/plans/2026-11-04-montador-de-pc-v2.md`). Nenhum item quebra as invariantes do
Montador: `total ≤ teto`, só lojas confiáveis com o filtro ligado e peças compatíveis.

Para conferir a lista de marcadores:

```bash
grep -rn "TODO(V2" src scripts supabase
```

O comando também acha `src/services/references.test.ts`, mas nesse arquivo a sigla não é uma
pendência. É um teste que confere que o `seed-references.sql` **não** tem mais o `TODO(V2-D)`.

---

## 1. Marcadores `TODO(V2-*)` no código (18)

### Pacote A: catálogo e especificações (5)

| # | O que falta | Arquivo |
|---|---|---|
| A-1 | Regras de compatibilidade que ainda não existem: comprimento da placa de vídeo no gabinete, altura do cooler, slots M.2, quantidade de pentes de memória e fonte SFX em gabinete ITX. | `src/services/builder/compatibility.ts` (topo) |
| A-2 | O planejador da montagem mais barata (`makePlanner`) depende do formato das regras de hoje. Uma regra nova que ligue outras categorias (por exemplo, placa de vídeo × gabinete) obriga a mudar o planejador junto. | `src/services/builder/auto-build.ts` (comentário do planejador) |
| A-3 | Decidir se a tabela `part_specs` ganha uma coluna `category` com CHECK. Hoje a categoria vem do produto. | `src/services/specs.ts` (tipo `PartSpecRow`) |
| A-4 | Curadoria contínua das specs para cobrir todo o catálogo coletado. Uma peça sem spec fica fora da montagem e vira nota. | `src/models/part-specs.ts` (topo) |
| A-5 | Opção `--atualizar` no coletor de specs, para regravar peças que já têm spec quando o JSON mudar. Hoje o script só preenche lacunas. | `scripts/collect-specs.mjs` (fim do script) |

### Pacote B: algoritmo (2)

| # | O que falta | Arquivo |
|---|---|---|
| B-1 | Trocar o passo guloso por uma otimização global (por exemplo, busca em feixe) que também troque categorias juntas no rebaixamento e na subida. Hoje a subida do processador mantém a placa-mãe. Também falta a resolução escolhida mudar a montagem (hoje ela só destaca a coluna de FPS). | `src/services/builder/auto-build.ts` (topo) |
| B-2 | Voltar a chamar `flagSuspiciousOffers` direto no Montador quando a confiança da loja tiver cache próprio em `trust.ts`. Hoje o Montador repete a regra com um cache local, e um teste confere que as duas dão o mesmo resultado. | `src/services/builder/auto-build.ts` (`ofertasDaPeca`) |

### Pacote C: confiança das lojas (3)

| # | O que falta | Arquivo |
|---|---|---|
| C-1 | Tornar configuráveis os limites de confiança (nota 4,5, Reclame Aqui 6) e alimentar o Reclame Aqui com dados reais. | `src/services/builder/trust.ts` (topo) |
| C-2 | "Preço bom demais" também olhar o histórico de preços da peça, e não só as ofertas de hoje. | `src/services/builder/suspicious.ts` (topo) |
| C-3 | Trocar a nota do Reclame Aqui e os anos de mercado de demonstração por dados reais. | `supabase/seed-stores.sql` (cabeçalho) |

### Pacote D: desempenho (2)

| # | O que falta | Arquivo |
|---|---|---|
| D-1 | Usar benchmarks reais por jogo. Hoje os FPS são estimativas (ver `docs/METODOLOGIA-DESEMPENHO.md`). | `src/services/builder/performance.ts` (topo) |
| D-2 | Trocar as estimativas dos 12 PCs de referência por médias medidas por jogo, de uma fonte aberta e estável, e atualizar todo mês. | `src/models/reference-builds.ts` (cabeçalho) |

### Pacote E: pagamentos (4)

| # | O que falta | Arquivo |
|---|---|---|
| E-1 | Campo de cupom na tela "Como pagar". A lógica já existe em `coupons.ts`. | `src/components/builder/PaymentPlanner.tsx` (topo) |
| E-2 | Cupons e cashback por loja no resumo de pagamento. | `src/services/builder/payments.ts` (topo) |
| E-3 | Tabela `coupons` no Supabase, serviço com fallback, campo na tela e cashback. Hoje não há cupom cadastrado e a tela não usa `applyCoupon`. | `src/services/builder/coupons.ts` (topo) |
| E-4 | A mistura Pix + cartão escolher a combinação ótima de peças (hoje é gulosa, pelo custo evitado) e considerar cupons e cashback. | `src/services/builder/mixed-plan.ts` (topo) |

### Pacote H: qualidade e operação (2)

| # | O que falta | Arquivo |
|---|---|---|
| H-1 | O monitor de seletores ignorar lojas com poucas ofertas (1 falha em 2 ofertas já passa de 30%) e separar falha de rede de seletor quebrado. | `scripts/collect-prices.mjs` (`resumirColeta`) |
| H-2 | Coleta com concorrência limitada por loja: intercalar lojas, pausar por domínio e interromper cedo uma loja cujas primeiras ofertas falharam todas. | `scripts/collect-prices.mjs` (laço da coleta) |

Os pacotes F (tela do Montador) e G (montagens salvas e alertas) não deixaram marcadores no código.

---

## 2. Adiados pelo Comandante

| Item | O que falta | Por que ficou para depois | Onde |
|---|---|---|---|
| F-21 | Rodar `autoBuild` numa *server action* (ou num Web Worker) e mandar para o navegador só o resultado. Hoje o catálogo inteiro (peças, ofertas e lojas), as specs, as referências e os juros viram props do `BuilderForm`. | Com 20 peças não faz diferença. Com 500 peças × 3 ofertas, passaria de 1 MB por visita. | `src/app/montar/page.tsx`, `src/components/builder/BuilderForm.tsx` |
| F-22 | Política de segurança de conteúdo (CSP) com *nonce* do Next: `script-src 'self' 'nonce-…'` e `object-src 'none'`. | O site não injeta HTML (não usa `dangerouslySetInnerHTML`), então isso é endurecimento, não falha. Os cabeçalhos básicos já estão no ar. | `next.config.ts` |
| SEG-06 | Deduplicar as visitas a uma peça (por sessão ou janela de tempo) e registrar sem `await`. Hoje cada recarga e cada robô contam como visita. | Infla o ranking "Mais procuradas" e faz a tabela `product_views` crescer sem limite, mas não muda preço nem montagem. | `src/app/peca/[slug]/page.tsx`, `src/services/popularity.ts` |
| DAD-01 | Restrições no banco: `CHECK (price_pix > 0)`, `CHECK (installment_count >= 1)` e `UNIQUE (product_id, store_id)` em `offers`, e CHECK de `perf > 0` e `aesthetics` entre 0 e 100 em `part_specs`. | O código já valida tudo isso na leitura (`validOffers`, `hasRequiredSpec`, `specs.ts`). O banco seria a segunda defesa. | `supabase/schema.sql`, `supabase/schema-builder.sql` |
| A4 | Categoria nova "cooler" (e ventoinhas): `Category`, `CATEGORIES`, relevância estética 0,6, fatia própria e regra de altura do cooler no gabinete. | Tarefa opcional do plano, só depois de A1–A3. Mexe em fatias, testes e planejador. | `src/models/types.ts`, `src/services/builder/scoring.ts`, `compatibility.ts` |

---

## 3. Outros adiamentos registrados pelos revisores

Estes itens foram vistos nos pareceres (`docs/superpowers/army/`) e ficaram para depois.
Nenhum muda o que a pessoa paga ou vê como fato.

| Item | O que falta | Onde está descrito |
|---|---|---|
| PERF-02 | Tirar a sessão do cabeçalho para um componente cliente e deixar as páginas públicas estáticas ou com `revalidate`. | `onda2-trufas.md` |
| PERF-03 | Uma verificação de login por requisição (hoje roda no `proxy.ts` e de novo no cabeçalho). | `onda2-trufas.md` |
| PERF-04 | Paginação no servidor para "Todas as peças" e para a busca. | `onda2-trufas.md` |
| Notas da folga | Reescrever as duas notas de uma troca ("Subimos…" e "No total, as trocas usaram…") numa frase só. O texto está correto e testado. | `portao2-tranquilo.md` |
| Avisos para o dono do site | Os avisos "Sem especificações cadastradas" e "Catálogo vazio" de `/montar` falam de scripts. Trocar por um texto para a pessoa e um log para o dono. | `portao2-tranquilo.md` |
| E-mail do alerta de montagem | Citar loja e peça no e-mail, e mostrar o "total atual" na `/conta` (hoje mostra o total salvo, com a data). | `portao2-tranquilo.md` |
| Recomendações para a V3 | Uma regra só para o parcelado da oferta, campos obrigatórios por categoria gerados de um arquivo único, separar `auto-build.ts` em módulos, contexto React para o resultado, limite de tentativas no login. | `revisao-fable.md`, seção "Dívida e recomendações para a V3" |

## Como manter este arquivo

- Resolveu um `TODO(V2-*)`? Apague o marcador no código e a linha aqui, no mesmo commit.
- Criou um marcador novo? Use `TODO(V2-<letra do pacote>)` e acrescente uma linha na seção 1.
- A contagem do título da seção 1 é o número de linhas que o `grep` acima devolve, menos a do teste.
