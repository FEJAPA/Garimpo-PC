# Jornada da pessoa leiga

Quem é a pessoa: alguém que sabe **quanto quer gastar** (por exemplo, "6 mil, no máximo 7"),
mas não entende de hardware e tem medo de comprar peça errada ou cair em golpe
(ver `PRODUCT.md`). Esta página mostra o caminho dela, do primeiro clique até o alerta de
preço, **incluindo o que ela vê quando algo dá errado**.

Tudo aqui vem do código real: `src/app/page.tsx` (home), `src/app/montar/page.tsx` e
`src/components/builder/BuilderForm.tsx` (tela do Montador), `src/components/builder/BuildResultView.tsx`
(resultado), `src/services/builder/auto-build.ts` (erros do algoritmo), `src/app/peca/[slug]/page.tsx`,
`src/components/PriceAlertButton.tsx`, `src/components/builder/SaveBuildButton.tsx`,
`src/app/entrar/page.tsx`, `src/app/conta/page.tsx`, `src/app/metodologia/page.tsx` e
`src/app/api/check-alerts/route.ts`.

> **Legenda de cores** nos fluxos: amarelo = tela, azul = decisão, vermelho = erro,
> verde = sucesso, cinza claro = site de fora.

---

## 1. Visão geral da jornada

As notas (1 = frustrante, 5 = ótimo) são uma **hipótese de experiência** feita a partir do
desenho das telas, não uma medição com pessoas reais. Entrar na conta continua sendo o passo com
mais atrito (ver "Pontos de atrito", no fim da página), mas agora o login volta para a página de
onde a pessoa veio.

```mermaid
journey
    title Do primeiro acesso ao alerta de preço
    section Chegar
      Abrir a página inicial: 4: Pessoa
      Ler a promessa e os 3 passos: 4: Pessoa
    section Informar o orçamento
      Preencher Quero gastar e No máximo: 5: Pessoa
      Clicar em Montar com esse orçamento: 5: Pessoa
    section Montar o PC
      Escolher o uso e a resolução do monitor: 4: Pessoa
      Conferir a folga e o filtro de lojas: 4: Pessoa
      Ajustar o slider Desempenho e Estética: 4: Pessoa
      Clicar em Montar meu PC: 5: Pessoa
    section Entender o resultado
      Ler o total e a situação do orçamento: 5: Pessoa
      Ler a caixa Como chegamos aqui: 4: Pessoa
      Ver o desempenho esperado e a metodologia: 4: Pessoa
      Comparar Pix, parcelado e Misturar: 4: Pessoa
    section Guardar e ir à loja
      Copiar o link ou baixar a lista: 4: Pessoa
      Clicar em Ver na loja: 5: Pessoa
    section Opcional
      Entrar ou criar conta e voltar à montagem: 3: Pessoa
      Salvar a montagem e criar um alerta: 4: Pessoa
      Receber o e-mail quando o preço cair: 5: Pessoa
```

---

## 2. Do orçamento ao resultado (decisões e erros)

Este fluxo cobre as decisões que mais importam para a pessoa leiga:

1. **Teto menor que o alvo**: o site corrige sozinho e avisa; não trava.
2. **Orçamento insuficiente**: o site diz quanto custa a montagem mais barata possível.
3. **Filtro de lojas**: "Só lojas confiáveis" ligado pode deixar uma categoria sem nenhuma peça;
   desligado, o site avisa quando um preço é bom demais.

```mermaid
flowchart TD
    classDef tela fill:#fff4d6,stroke:#9a6b00,color:#2b2200
    classDef decisao fill:#e3ecff,stroke:#2f4fbf,color:#0f1d4d
    classDef erro fill:#ffe3e6,stroke:#b3261e,color:#4a0d12
    classDef ok fill:#dff5e6,stroke:#1b7a3f,color:#0b3320

    A["Home /<br/>Quanto você pode gastar?"]:::tela
    A --> B{"Preencheu o formulário<br/>da home?"}:::decisao
    B -->|"sim"| C["Abre /montar com alvo e teto<br/>já preenchidos, aceita 6.550 ou 6.550,50"]:::tela
    B -->|"não, clicou em Montar meu PC"| D["Abre /montar com os valores padrão<br/>alvo 6.000 e teto 7.000"]:::tela
    B -->|"abriu um link /montar?b="| LK{"O código do link é válido?"}:::decisao
    LK -->|"não"| LK1["Aviso: Não conseguimos abrir este link<br/>a pessoa preenche os campos"]:::erro
    LK -->|"sim"| LK2["Restaura as escolhas e monta sozinho<br/>com os preços de hoje e avisa o que mudou"]:::tela
    LK1 --> E
    LK2 --> Q
    C --> E["/montar no estado Vazio<br/>o card explica os passos do Montador"]:::tela
    D --> E

    E --> F{"Valores válidos?<br/>maior que zero e até R$ 1.000.000"}:::decisao
    F -->|"não"| F1["Campo em erro com mensagem<br/>botão Montar desabilitado"]:::erro
    F1 --> E
    F -->|"sim"| G{"Teto menor que o alvo?"}:::decisao
    G -->|"sim"| G1["Aviso no campo: o teto será tratado<br/>como igual ao alvo, sem folga"]:::tela
    G -->|"não"| G2["Mostra a folga calculada<br/>ou Sem folga se forem iguais"]:::tela
    G1 --> H
    G2 --> H
    H["Escolhe Para que você vai usar, Resolução do monitor,<br/>Só lojas confiáveis e o slider Desempenho e Estética"]:::tela
    H --> I["Clica em Montar meu PC"]:::tela
    I --> J["Estado Carregando<br/>esqueleto do resultado ou resultado anterior esmaecido"]:::tela

    J --> K0{"Alguma peça tem<br/>especificação técnica?"}:::decisao
    K0 -->|"não"| K01["Erro: Nenhuma peça do catálogo tem<br/>especificação técnica cadastrada"]:::erro
    K0 -->|"sim"| K{"Toda categoria tem ao menos uma<br/>peça disponível com os filtros?"}:::decisao
    K -->|"não"| K1["Erro: Não há categoria disponível<br/>com os filtros atuais"]:::erro
    K -->|"sim"| L{"Existe alguma combinação<br/>compatível de peças?"}:::decisao
    L -->|"não"| L1["Erro: Não encontramos uma combinação<br/>compatível de peças no catálogo"]:::erro
    L -->|"sim"| M{"A montagem compatível mais barata<br/>cabe no teto?"}:::decisao
    M -->|"não"| M1["Erro: Orçamento insuficiente, a montagem mais<br/>barata compatível custa R$ X"]:::erro

    K01 --> R
    K1 --> R
    L1 --> R
    M1 --> R
    R["Estado Erro: caixa Não deu para montar<br/>a pessoa sobe o teto ou desliga o filtro de lojas"]:::erro
    R --> H

    M -->|"sim"| N["Algoritmo monta as peças<br/>detalhes em fluxo-montador.md"]:::tela
    N --> O{"Houve troca paga e o total<br/>passou do alvo?"}:::decisao
    O -->|"sim"| O0{"Sobrou menos de R$ 1<br/>até o teto?"}:::decisao
    O0 -->|"sim"| O1["Selo Usou a folga até o teto"]:::ok
    O0 -->|"não"| O3["Selo Usou a folga<br/>a nota explica quanto e por quê"]:::ok
    O -->|"não"| O2{"Total passou do alvo?"}:::decisao
    O2 -->|"sim"| O5["Selo Acima do alvo, dentro do teto"]:::ok
    O2 -->|"não"| O4["Selo Dentro do alvo"]:::ok
    O1 --> Q
    O3 --> Q
    O4 --> Q
    O5 --> Q
    Q["Estado Sucesso<br/>Total no Pix, Peças, Desempenho esperado, Como pagar<br/>a URL vira /montar?b= da montagem na tela"]:::ok

    Q --> S{"O resultado serve?"}:::decisao
    S -->|"não, quer mudar algo"| H
    S -->|"sim"| T["Salvar montagem, Copiar link, Baixar lista CSV<br/>ou ir à loja, diagrama da seção 4"]:::tela
```

### O que a pessoa vê em cada decisão

| Situação | O que acontece | Mensagem na tela | Onde no código |
|---|---|---|---|
| Teto menor que o alvo | Não bloqueia. O teto é tratado como igual ao alvo (folga zero) | "Teto menor que o alvo: vamos considerar o teto igual ao alvo (sem folga)." | `normalizeBudget` em `budget.ts`; dica no `BuilderForm` |
| Teto em branco | Usa o valor do alvo | "Sem folga: a montagem fica dentro do valor que você quer gastar." | `BuilderForm` |
| Alvo vazio, zero ou não numérico | Botão "Montar meu PC" desabilitado | "Informe um valor maior que zero." | `moneyError` em `src/lib/money.ts` |
| Valor acima de R$ 1.000.000 | Botão desabilitado | "Valor acima do permitido (R$ 1.000.000)." | `moneyError` |
| Nenhuma peça com especificação | Não monta nada | "Nenhuma peça do catálogo tem especificação técnica cadastrada; não dá para montar agora." | `autoBuild` (passo 1) |
| Orçamento insuficiente | Não monta nada | "Orçamento insuficiente: a montagem mais barata compatível custa R$ 4.699,30. Suba o teto ou desative “Só lojas confiáveis”." (valor do catálogo de exemplo) | `autoBuild` (passo 2) |
| Filtro de lojas deixou uma categoria vazia | Não monta nada | "Não há fonte disponível com os filtros atuais. Desative “Só lojas confiáveis” ou tente mais tarde." (a categoria muda) | `autoBuild` (passo 1) |
| Sem filtro de lojas | Aceita ofertas de marketplaces, mas a oferta "boa demais" (25% ou mais abaixo da mediana das lojas confiáveis) só é usada se for a única, e aí vem com aviso | Na peça: "Preço bom demais?" e, em "Como chegamos aqui": "Atenção: a placa de vídeo veio de uma oferta com preço bom demais na loja X — confira antes de pagar." | `collectCandidates` e `suspicionNotes` em `auto-build.ts` |
| Peças sem ficha técnica no banco | Ficam de fora e são contadas | "N peças do catálogo foram ignoradas por falta de especificação técnica." | `autoBuild` |

---

## 3. Estados da tela `/montar`

O cálculo roda **no navegador** (`autoBuild` é chamado dentro do `BuilderForm`), por isso o estado
"Carregando" é curto; ele existe para o botão e o resultado antigo não parecerem travados.

```mermaid
stateDiagram-v2
    direction LR
    state "Catálogo indisponível" as CatalogoIndisponivel
    state "Vazio" as Vazio
    state "Carregando" as Carregando
    state "Erro" as Erro
    state "Sucesso" as Sucesso

    [*] --> CatalogoIndisponivel : banco fora do ar ou sem peças
    [*] --> Vazio : catálogo carregado
    [*] --> Carregando : abriu um link com código válido
    Vazio --> Carregando : clica em Montar meu PC
    Carregando --> Erro : autoBuild devolve ok falso
    Carregando --> Sucesso : autoBuild devolve ok verdadeiro
    Erro --> Carregando : muda os dados e clica em Montar de novo
    Sucesso --> Carregando : muda os dados e clica em Montar de novo
    CatalogoIndisponivel --> [*]
```

| Estado | O que a pessoa vê | Onde no código |
|---|---|---|
| Catálogo indisponível | Caixa vermelha "Catálogo indisponível" no lugar do formulário: "Não conseguimos ler o catálogo agora, ou ele ainda está vazio." | `src/app/montar/page.tsx` |
| Sem especificações (banco real) | Caixa amarela "Sem especificações cadastradas" acima do formulário | `src/app/montar/page.tsx` |
| Vazio | Card "O que vai acontecer" com os passos do Montador | `EstadoVazio` em `BuilderForm.tsx` |
| Carregando | Esqueleto do resultado na primeira vez; depois, o resultado anterior fica esmaecido e o botão em *loading* | `useTransition` e `ResultSkeleton` em `BuilderForm.tsx` |
| Erro | Caixa vermelha "Não deu para montar" com o motivo; o botão passa a dizer "Montar de novo" | `BuilderForm.tsx` |
| Sucesso | Total no Pix, "ou R$ X parcelado" (o parcelado mais barato), "Sobra até o teto", selo da situação, botões Salvar, Copiar link e Baixar lista (CSV), notas "Como chegamos aqui", Peças (com "lido em DD/MM, HH:MM"), Desempenho esperado e Como pagar (Pix, Parcelado e Misturar). O foco vai para o resumo | `BuildResultView.tsx` |
| Faixa "Modo de demonstração" | Aparece quando o Supabase não está configurado: peças, preços, lojas e reputação, juros e índices de desempenho são de exemplo | `usingRealData()` em `src/services/products.ts` |

---

## 4. Depois do resultado: ir à loja, salvar, entrar e criar alertas

O login é **opcional**. Ele só é necessário para salvar montagens e criar alertas. Há dois tipos de
alerta: **de peça** (criado na página `/peca/[slug]`) e **da montagem inteira** (criado em `/conta`,
em cada montagem salva). Depois de entrar, a pessoa **volta para a página de onde veio**.

```mermaid
flowchart TD
    classDef tela fill:#fff4d6,stroke:#9a6b00,color:#2b2200
    classDef decisao fill:#e3ecff,stroke:#2f4fbf,color:#0f1d4d
    classDef erro fill:#ffe3e6,stroke:#b3261e,color:#4a0d12
    classDef ok fill:#dff5e6,stroke:#1b7a3f,color:#0b3320
    classDef externo fill:#eceff1,stroke:#607d8b,color:#263238

    R["Resultado em /montar<br/>lista de peças com loja, preço e lido em"]:::ok
    R --> R1{"O que a pessoa faz?"}:::decisao

    R1 -->|"clica em Ver na loja"| L2["Abre o site da loja em nova aba"]:::externo
    L2 --> L4["Compra no site da loja<br/>fora do GarimpoPC, o preço pode ter mudado"]:::externo

    R1 -->|"Copiar link ou Baixar lista"| SH["Link /montar?b= copiado<br/>ou arquivo CSV com as peças e os preços"]:::ok

    R1 -->|"clica em Salvar montagem"| SV{"Está logada?"}:::decisao
    SV -->|"sem banco, modo de demonstração"| SV0["Texto: Salvar montagens e alertas<br/>precisam do banco configurado"]:::tela
    SV -->|"não"| SV1["Link Entre para salvar a montagem<br/>leva a /entrar com next igual a esta página"]:::tela
    SV -->|"sim"| SV2["Campo Nome da montagem e Salvar<br/>o servidor confere as ofertas e grava o preço do banco"]:::tela
    SV2 --> SV3["Montagem salva<br/>aparece em Minhas montagens, em /conta"]:::ok

    R1 -->|"clica no nome da peça"| P["Página /peca/slug<br/>lojas lado a lado com os motivos de confiança,<br/>aviso Preço bom demais e histórico de preços"]:::tela
    P --> P1{"Quer ser avisada<br/>quando o preço cair?"}:::decisao
    P1 -->|"não"| L2
    P1 -->|"sim"| B2{"Está logada?"}:::decisao
    B2 -->|"sem banco, modo de demonstração"| B20["Texto: Alertas de preço precisam<br/>do banco configurado"]:::tela
    B2 -->|"não"| E1["Botão Entre para criar um alerta de preço<br/>leva a /entrar com next igual à peça"]:::tela

    SV1 --> E2
    E1 --> E2["Tela /entrar<br/>e-mail e senha de pelo menos 6 caracteres"]:::tela
    E2 --> E3{"Já tem conta?"}:::decisao
    E3 -->|"não"| E4["Criar conta<br/>volta a /entrar com a mensagem Conta criada"]:::ok
    E4 --> E2
    E3 -->|"sim"| E5{"E-mail e senha corretos?"}:::decisao
    E5 -->|"não"| E6["Volta a /entrar com o erro em português<br/>por exemplo E-mail ou senha incorretos"]:::erro
    E6 --> E2
    E5 -->|"sim"| E7["Entra e volta para a página do next<br/>caminho interno seguro, senão /conta"]:::ok
    E7 --> SV2
    E7 --> B3

    B2 -->|"sim"| B3["Campo Avise-me quando custar até<br/>sugestão: 90% do preço atual"]:::tela
    B3 --> B4{"createAlert aceita?"}:::decisao
    B4 -->|"preço inválido, peça inexistente ou erro do banco"| B5["Mensagem de erro em vermelho<br/>abaixo do campo"]:::erro
    B5 --> B3
    B4 -->|"sim"| B6["Alerta criado<br/>a confirmação fica visível"]:::ok

    SV3 --> BA["Em /conta: Avisar quando a montagem<br/>custar até R$ X, com createBuildAlert"]:::tela
    BA --> J
    B6 --> J["Job /api/check-alerts<br/>chamado de hora em hora por um agendador"]:::tela
    J --> J1{"Melhor preço da peça ou total atual<br/>da montagem menor ou igual ao alvo?"}:::decisao
    J1 -->|"não"| J2["Continua esperando<br/>o alerta segue ativo"]:::tela
    J1 -->|"sim"| J3["E-mail: caiu para R$ X<br/>com link para a peça ou para /conta"]:::ok
    J3 --> J4["Alerta desligado e marcado como avisado<br/>/conta mostra avisado em DD/MM e Reativar"]:::tela
    J4 -->|"Reativar"| J
```

### Pontos de atrito observados no código

- **Entrar ainda é um desvio**: a pessoa sai do Montador ou da peça, preenche e-mail e senha e só
  então volta (pelo `next`). Sem banco configurado (modo de demonstração), o site nem oferece o
  link: mostra um texto dizendo que salvar e alertas precisam do banco.
- **Da home para `/montar` ainda falta um clique**: os valores digitados chegam preenchidos,
  mas a montagem só roda quando a pessoa clica em "Montar meu PC".
- **A resolução não muda a montagem**: escolher "Quad HD" destaca a coluna de FPS em 1440p, mas
  as peças são as mesmas do Full HD (pendência B-1 em `docs/PENDENCIAS-POS-V2.md`).
- **O e-mail do alerta de montagem não diz qual peça baixou**, e `/conta` mostra o total de quando
  a montagem foi salva (com a data), não o de hoje.
