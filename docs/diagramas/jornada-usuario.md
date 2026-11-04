# Jornada da pessoa leiga

Quem é a pessoa: alguém que sabe **quanto quer gastar** (por exemplo, "6 mil, no máximo 7"),
mas não entende de hardware e tem medo de comprar peça errada ou cair em golpe
(ver `PRODUCT.md`). Esta página mostra o caminho dela, do primeiro clique até o alerta de
preço, **incluindo o que ela vê quando algo dá errado**.

Tudo aqui vem do código real: `src/app/page.tsx` (home), `src/app/montar/page.tsx` e
`src/components/builder/BuilderForm.tsx` (tela do Montador), `src/services/builder/auto-build.ts`
(erros do algoritmo), `src/app/peca/[slug]/page.tsx`, `src/components/PriceAlertButton.tsx`,
`src/app/entrar/page.tsx`, `src/app/conta/page.tsx` e `src/app/api/check-alerts/route.ts`.

> **Legenda de cores** nos fluxos: amarelo = tela, azul = decisão, vermelho = erro,
> verde = sucesso, cinza claro = site de fora, **cinza tracejado = V2 que ainda não existe**,
> **cinza-azulado tracejado = V2 com código pronto, mas ainda não ligado à tela**.

---

## 1. Visão geral da jornada

As notas (1 = frustrante, 5 = ótimo) são uma **hipótese de experiência** feita a partir do
desenho das telas, não uma medição com pessoas reais. A parte do login tem nota baixa de
propósito: é o ponto com mais atrito (ver "Pontos de atrito", no fim da página).

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
      Conferir a folga e o filtro de lojas: 4: Pessoa
      Ajustar o slider Desempenho e Estética: 4: Pessoa
      Clicar em Montar meu PC: 5: Pessoa
    section Entender o resultado
      Ler o total e a situação do orçamento: 5: Pessoa
      Ler a caixa Como chegamos aqui: 4: Pessoa
      Ver o desempenho esperado: 4: Pessoa
      Comparar Pix e parcelado: 4: Pessoa
    section Ir à loja
      Clicar em Ver na loja: 5: Pessoa
    section Opcional
      Entrar ou criar conta: 2: Pessoa
      Criar um alerta de preço: 4: Pessoa
      Receber o e-mail quando o preço cair: 5: Pessoa
```

---

## 2. Do orçamento ao resultado (decisões e erros)

Este fluxo cobre as três decisões que mais importam para a pessoa leiga:

1. **Teto menor que o alvo** — o site corrige sozinho e avisa; não trava.
2. **Orçamento insuficiente** — o site diz quanto custa a montagem mais barata possível.
3. **Filtro de lojas** — "Só lojas confiáveis" ligado pode deixar uma categoria sem nenhuma peça.

```mermaid
flowchart TD
    classDef tela fill:#fff4d6,stroke:#9a6b00,color:#2b2200
    classDef decisao fill:#e3ecff,stroke:#2f4fbf,color:#0f1d4d
    classDef erro fill:#ffe3e6,stroke:#b3261e,color:#4a0d12
    classDef ok fill:#dff5e6,stroke:#1b7a3f,color:#0b3320
    classDef v2 fill:#eeeeee,stroke:#777777,stroke-dasharray:5 5,color:#444444
    classDef v2pronto fill:#eef3f7,stroke:#4f7390,stroke-dasharray:5 5,color:#1f3547

    A["Home /<br/>Quanto você pode gastar?"]:::tela
    A --> B{"Preencheu o formulário<br/>da home?"}:::decisao
    B -->|"sim"| C["Abre /montar com alvo e teto<br/>já preenchidos"]:::tela
    B -->|"não, clicou em Montar meu PC"| D["Abre /montar com os valores padrão<br/>alvo 6.000 e teto 7.000"]:::tela
    C --> E["/montar no estado Vazio<br/>o card O que vai acontecer explica 4 passos"]:::tela
    D --> E

    E --> F{"Valores válidos?<br/>alvo maior que zero e teto sem erro"}:::decisao
    F -->|"não"| F1["Campo em erro com mensagem<br/>botão Montar desabilitado"]:::erro
    F1 --> E
    F -->|"sim"| G{"Teto menor que o alvo?"}:::decisao
    G -->|"sim"| G1["Aviso no campo: o teto será tratado<br/>como igual ao alvo, sem folga"]:::tela
    G -->|"não"| G2["Mostra a folga calculada<br/>ou Sem folga se forem iguais"]:::tela
    G1 --> H
    G2 --> H
    H["Ajusta Só lojas confiáveis<br/>e o slider Desempenho e Estética"]:::tela
    H --> I["Clica em Montar meu PC"]:::tela
    I --> J["Estado Carregando<br/>botão em loading, resultado anterior esmaecido"]:::tela

    J --> K{"Toda categoria tem ao menos uma<br/>peça disponível com os filtros?"}:::decisao
    K -->|"não"| K1["Erro: Não há categoria disponível<br/>com os filtros atuais"]:::erro
    K -->|"sim"| L{"Existe alguma combinação<br/>compatível de peças?"}:::decisao
    L -->|"não"| L1["Erro: Não encontramos uma combinação<br/>compatível de peças no catálogo"]:::erro
    L -->|"sim"| M{"A montagem compatível mais barata<br/>cabe no teto?"}:::decisao
    M -->|"não"| M1["Erro: Orçamento insuficiente, a montagem mais<br/>barata compatível custa R$ X"]:::erro

    K1 --> R
    L1 --> R
    M1 --> R
    R["Estado Erro: caixa Não deu para montar<br/>a pessoa sobe o teto ou desliga o filtro de lojas"]:::erro
    R --> H

    M -->|"sim"| N["Algoritmo monta as peças<br/>detalhes em fluxo-montador.md"]:::tela
    N --> O{"Sobrou menos de R$ 1<br/>até o teto?"}:::decisao
    O -->|"sim"| O1["Selo No teto"]:::ok
    O -->|"não"| O2{"Total passou do alvo?"}:::decisao
    O2 -->|"sim"| O3["Selo Usou a folga<br/>nota explica quanto e por quê"]:::ok
    O2 -->|"não"| O4["Selo Dentro do alvo"]:::ok
    O1 --> Q
    O3 --> Q
    O4 --> Q
    Q["Estado Sucesso<br/>Total no Pix, Peças, Desempenho esperado, Como pagar"]:::ok

    Q --> S{"O resultado serve?"}:::decisao
    S -->|"não, quer mudar algo"| H
    S -->|"sim"| T["Segue para Ir à loja<br/>diagrama da seção 4"]:::tela

    Q -.-> X1["V2 pacotes B e F - ainda não existe<br/>perfil de uso e resolução na tela"]:::v2
    Q -.-> X2["V2 pacote F - ainda não existe<br/>copiar link e baixar lista de compras"]:::v2
    Q -.-> X3["V2 pacote G - ainda não existe<br/>salvar a montagem na conta"]:::v2
    Q -.-> X4["V2 pacote E - código pronto<br/>aba Misturar em Como pagar, escondida até<br/>o pacote F passar as peças para a tela"]:::v2pronto
```

### O que a pessoa vê em cada decisão

| Situação | O que acontece | Mensagem na tela | Onde no código |
|---|---|---|---|
| Teto menor que o alvo | Não bloqueia. O teto é tratado como igual ao alvo (folga zero) | "Teto menor que o alvo: vamos considerar o teto igual ao alvo (sem folga)." | `normalizeBudget` em `budget.ts`; dica no `BuilderForm` |
| Teto em branco | Usa o valor do alvo | "Sem folga: a montagem fica dentro do valor que você quer gastar." | `BuilderForm` |
| Alvo vazio, zero ou não numérico | Botão "Montar meu PC" desabilitado | "Informe um valor maior que zero." | `BuilderForm` (`alvoInvalido`) |
| Orçamento insuficiente | Não monta nada | "Orçamento insuficiente: a montagem mais barata compatível custa R$ 4.699,30. Suba o teto ou desative “Só lojas confiáveis”." (valor do catálogo de exemplo) | `autoBuild` (passo 2) |
| Filtro de lojas deixou uma categoria vazia | Não monta nada | "Não há fonte disponível com os filtros atuais. Desative “Só lojas confiáveis” ou tente mais tarde." (a categoria muda) | `autoBuild` (passo 1) |
| Sem filtro de lojas | Passa a aceitar ofertas de marketplaces, que costumam ser mais baratas e menos seguras | Em `/montar` a pessoa só vê o selo da loja (nota, "Oficial" e, ao passar o mouse, os motivos da confiança). O aviso "Preço bom demais?" já existe, mas só na página `/peca/[slug]` (V2 pacote C) | `cheapestOffer` em `trust.ts`; `flagSuspiciousOffers` em `suspicious.ts` |

---

## 3. Estados da tela `/montar`

A tela tem quatro estados normais mais um estado de falha do servidor. O cálculo roda **no
navegador** (`autoBuild` é chamado dentro do `BuilderForm`), por isso o estado "Carregando"
dura frações de segundo; ele existe para o botão e o resultado antigo não parecerem travados.

```mermaid
stateDiagram-v2
    direction LR
    state "Catálogo vazio" as CatalogoVazio
    state "Vazio" as Vazio
    state "Carregando" as Carregando
    state "Erro" as Erro
    state "Sucesso" as Sucesso

    [*] --> CatalogoVazio : banco sem nenhuma peça
    [*] --> Vazio : catálogo carregado
    Vazio --> Carregando : clica em Montar meu PC
    Carregando --> Erro : autoBuild devolve ok falso
    Carregando --> Sucesso : autoBuild devolve ok verdadeiro
    Erro --> Carregando : muda os dados e clica em Montar de novo
    Sucesso --> Carregando : muda os dados e clica em Montar de novo
    CatalogoVazio --> [*]
```

| Estado | O que a pessoa vê | Onde no código |
|---|---|---|
| Catálogo vazio | Caixa vermelha "Catálogo vazio" no lugar do formulário, mandando rodar os scripts da pasta `supabase/` | `src/app/montar/page.tsx` |
| Vazio | Card "O que vai acontecer" com os 4 passos do Montador | `EstadoVazio` em `BuilderForm.tsx` |
| Carregando | Botão em estado *loading*; o resultado anterior fica a 60% de opacidade; leitores de tela são avisados (`aria-live`) | `useTransition` em `BuilderForm.tsx` |
| Erro | Caixa vermelha "Não deu para montar" com o motivo; o botão passa a dizer "Montar de novo" | `BuilderForm.tsx` |
| Sucesso | Total no Pix, selo da situação, notas "Como chegamos aqui", Peças, Desempenho esperado e Como pagar | `BuildResultView.tsx` |
| Faixa "Modo de demonstração" | Aparece em qualquer estado quando o Supabase não está configurado: peças e preços são de exemplo | `usingRealData()` em `src/services/products.ts` |

---

## 4. Depois do resultado: ir à loja, login opcional e alerta

O login é **opcional** e só é necessário para criar alerta de preço. O alerta é **por peça**
(criado na página `/peca/[slug]`), não pela montagem inteira; o alerta da montagem inteira é
V2 (pacote G).

```mermaid
flowchart TD
    classDef tela fill:#fff4d6,stroke:#9a6b00,color:#2b2200
    classDef decisao fill:#e3ecff,stroke:#2f4fbf,color:#0f1d4d
    classDef erro fill:#ffe3e6,stroke:#b3261e,color:#4a0d12
    classDef ok fill:#dff5e6,stroke:#1b7a3f,color:#0b3320
    classDef externo fill:#eceff1,stroke:#607d8b,color:#263238
    classDef v2 fill:#eeeeee,stroke:#777777,stroke-dasharray:5 5,color:#444444

    R["Resultado em /montar<br/>lista de peças com loja e preço"]:::ok
    R --> R1{"O que a pessoa faz?"}:::decisao

    R1 -->|"clica em Ver na loja"| L1{"A oferta tem link?"}:::decisao
    L1 -->|"sim"| L2["Abre o site da loja em nova aba"]:::externo
    L1 -->|"não"| L3["Aparece sem link<br/>não há o que clicar"]:::erro
    L2 --> L4["Compra no site da loja<br/>fora do GarimpoPC, o preço pode ter mudado"]:::externo

    R1 -->|"clica no nome da peça"| P["Página /peca/slug<br/>lojas lado a lado com os motivos de confiança,<br/>aviso Preço bom demais e histórico de preços"]:::tela
    P --> P1{"Quer ser avisada<br/>quando o preço cair?"}:::decisao
    P1 -->|"não"| L2
    P1 -->|"sim"| B1["Botão Criar alerta de preço<br/>desabilitado enquanto descobre se há login"]:::tela
    B1 --> B2{"Está logada?"}:::decisao

    B2 -->|"não"| E1["Botão vira Entre para criar um alerta de preço"]:::tela
    E1 --> E2["Tela /entrar<br/>e-mail e senha de pelo menos 6 caracteres"]:::tela
    E2 --> E3{"Já tem conta?"}:::decisao
    E3 -->|"não"| E4["Criar conta<br/>volta a /entrar com a mensagem Conta criada"]:::ok
    E4 --> E2
    E3 -->|"sim"| E5{"E-mail e senha corretos?"}:::decisao
    E5 -->|"não"| E6["Volta a /entrar com o erro em português<br/>por exemplo E-mail ou senha incorretos"]:::erro
    E6 --> E2
    E5 -->|"sim"| E7["Entra e vai para /conta<br/>lista de alertas ativos"]:::ok
    E7 --> E8["A pessoa volta sozinha à peça<br/>o login não devolve para a página anterior"]:::tela
    E8 --> B3

    B2 -->|"sim"| B3["Campo Avise-me quando custar até<br/>sugestão: 90% do preço atual"]:::tela
    B3 --> B4{"createAlert aceita?"}:::decisao
    B4 -->|"sem login, preço inválido, peça inexistente ou erro do banco"| B5["Mensagem de erro em vermelho<br/>abaixo do campo"]:::erro
    B5 --> B3
    B4 -->|"sim"| B6["Alerta criado!<br/>Avisaremos quando o preço cair"]:::ok

    B6 --> J["Job /api/check-alerts<br/>chamado por um agendador externo"]:::tela
    J --> J1{"Menor preço em estoque<br/>menor ou igual ao alvo?"}:::decisao
    J1 -->|"não"| J2["Continua esperando<br/>o alerta segue ativo"]:::tela
    J1 -->|"sim"| J3["E-mail: peça caiu para R$ X<br/>com link para /peca/slug"]:::ok
    J3 --> J4["Alerta marcado como avisado<br/>notified_at preenchido, não avisa de novo"]:::tela
    J4 --> P

    B6 -.-> X1["V2 pacote G<br/>alerta da montagem inteira"]:::v2
    L4 -.-> X2["V2 pacote G<br/>aviso Preço de hoje às HH:MM"]:::v2
```

### Pontos de atrito observados no código

- **Depois de entrar, a pessoa cai em `/conta`**, não volta para a peça em que queria criar o
  alerta (`login` em `src/app/auth/actions.ts` sempre faz `redirect("/conta")`). Por isso a
  nota baixa no diagrama de visão geral.
- **Da home para `/montar` ainda falta um clique**: os valores digitados chegam preenchidos,
  mas a montagem só roda quando a pessoa clica em "Montar meu PC".
- **Sem filtro de lojas, `/montar` não avisa do risco** além do selo da loja. O aviso "Preço bom
  demais?" (oferta 25% ou mais abaixo da mediana das lojas confiáveis) já existe na página da
  peça, mas ainda não chega à tela do Montador.
- **Alertas já avisados continuam na lista de `/conta`**: a tela lista todos os alertas
  `is_active`, e o job só preenche `notified_at`, sem desativar o alerta.
- **Sem Supabase configurado** (modo de demonstração) não dá para entrar: `/entrar` mostra
  "O login ainda não está configurado" e `/conta` redireciona de volta para `/entrar`. O
  formulário continua visível, mas não há banco para autenticar.
