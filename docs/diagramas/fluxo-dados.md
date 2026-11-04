# O caminho de um preço: da loja ao e-mail de alerta

O dado mais valioso do GarimpoPC é o **preço**. Esta página segue um preço do começo ao fim:

1. A **loja** publica o preço na página do produto.
2. Um robô (**`scripts/collect-prices.mjs`**) lê essa página uma vez por dia.
3. O robô grava o preço atual na tabela **`offers`** e acrescenta um ponto na tabela **`price_history`**.
4. As **telas** leem essas tabelas: comparam lojas, desenham o gráfico de histórico, mostram
   "lido em DD/MM, HH:MM" e alimentam o Montador.
5. O **job de alertas** (`/api/check-alerts`) compara o preço atual (de uma peça ou de uma
   montagem salva inteira) com o que a pessoa pediu e manda um **e-mail** quando ele cai.

> **Legenda**: amarelo = passo, azul = decisão, laranja = robô, roxo = banco de dados, verde = resultado
> para a pessoa, vermelho = falha, cinza claro = fora do projeto.

## 1. Ciclo de vida do dado

```mermaid
flowchart TD
    classDef passo fill:#fff4d6,stroke:#9a6b00,color:#2b2200
    classDef decisao fill:#e3ecff,stroke:#2f4fbf,color:#0f1d4d
    classDef robo fill:#ffe9d6,stroke:#c25b00,color:#3d1c00
    classDef banco fill:#f3ecff,stroke:#6a4bc4,color:#22124d
    classDef ok fill:#dff5e6,stroke:#1b7a3f,color:#0b3320
    classDef falha fill:#ffe3e6,stroke:#b3261e,color:#4a0d12
    classDef externo fill:#eceff1,stroke:#607d8b,color:#263238

    subgraph E0["0. Ponto de partida"]
        SEED["Seeds SQL<br/>seed.sql e seed-extras.sql criam lojas,<br/>peças, ofertas e um histórico de exemplo"]:::passo
    end

    subgraph E1["1. Coleta - uma vez por dia"]
        GHA["GitHub Actions - coleta.yml<br/>todo dia às 06:00 UTC<br/>ou disparo manual, com opção de simulação"]:::externo
        C1["collect-prices.mjs<br/>lê as ofertas que têm url<br/>e um adaptador para a loja"]:::robo
        LOJA["Página do produto na loja<br/>KaBuM, Pichau ou Terabyte"]:::externo
        C2["O adaptador da loja espera o preço carregar<br/>e lê os seletores da página<br/>parseBRL converte R$ 1.899,90 em número"]:::robo
        C3{"Leu um preço válido?<br/>número finito maior que zero"}:::decisao
        C4{"É simulação, flag dry-run?"}:::decisao
        C5["Só mostra no console<br/>o que gravaria"]:::passo
        C6["Atualiza offers.price_pix<br/>e insere uma linha em price_history<br/>confere o erro de cada gravação"]:::robo
        C7["Conta a falha e guarda o motivo<br/>por exemplo seletor não encontrou nada"]:::falha
        C8["Pausa de 4 segundos e vai para a próxima oferta"]:::passo
        C9["Fim: resumo por loja e arquivo coleta-resultado.json"]:::robo
        C10{"Alguma loja com mais de 30%<br/>das ofertas falhando?"}:::decisao
        C11["Sai com código 2<br/>o workflow abre ou atualiza a issue<br/>Seletor quebrado: loja"]:::falha
        C12["Sai com código 0"]:::ok
    end

    subgraph E2["2. Banco - Supabase"]
        OFF[("offers<br/>preço de agora")]:::banco
        HIST[("price_history<br/>um ponto por coleta")]:::banco
        LAST[("offer_last_seen<br/>hora da última leitura")]:::banco
    end

    subgraph E3["3. Telas leem o preço"]
        S1["products.ts<br/>getProducts, searchProducts, getProductBySlug<br/>cada oferta traz recorded_at"]:::passo
        S2["Cartões e Melhor preço agora<br/>getBestOffer: em estoque, preço válido,<br/>loja não bloqueada e sem oferta boa demais"]:::ok
        S3["getPriceHistory<br/>só ofertas honestas de hoje<br/>agrupa por dia de Brasília, MENOR preço do dia"]:::passo
        S4["Gráfico de histórico em /peca/slug<br/>PriceHistoryChart"]:::ok
        S5["Montador autoBuild<br/>oferta mais barata não suspeita<br/>só lojas confiáveis se o filtro estiver ligado<br/>lido em DD/MM, HH:MM em cada peça"]:::ok
        S6["offerWarning<br/>aviso Preço bom demais e loja bloqueada<br/>em /peca/slug, nos cartões e no Montador"]:::ok
    end

    subgraph E4["4. Alertas por e-mail"]
        A1["Pessoa cria o alerta<br/>createAlert na peça ou createBuildAlert<br/>na montagem salva, em /conta"]:::passo
        ALR[("price_alerts<br/>target_price, is_active, notified_at,<br/>product_id ou saved_build_id")]:::banco
        A2["Agendador externo chama GET /api/check-alerts<br/>com Authorization Bearer CRON_SECRET"]:::externo
        A2b{"CRON_SECRET configurado, token certo<br/>e, em produção, RESEND_API_KEY configurada?"}:::decisao
        A2c["503 sem CRON_SECRET ou, em produção,<br/>sem RESEND_API_KEY<br/>401 com token errado"]:::falha
        A3["Lê alertas ativos sem notified_at, em lotes<br/>com a peça ou a montagem salva"]:::robo
        A4{"Melhor preço da peça, ou total atual<br/>da montagem, menor ou igual ao alvo?<br/>montagem com peça sem oferta não avisa"}:::decisao
        A5["Descobre o e-mail da pessoa<br/>e envia pelo Resend, sendEmail"]:::robo
        A6{"O e-mail saiu de verdade?<br/>simulado sem RESEND_API_KEY não conta"}:::decisao
        A7["Desliga o alerta: is_active falso<br/>e notified_at com a data de agora"]:::passo
        A8["E-mail: a peça ou a montagem caiu para R$ X<br/>com link para /peca/slug ou /conta"]:::ok
        A9["Segue esperando<br/>na próxima chamada do job"]:::passo
        A10["/conta mostra avisado em DD/MM<br/>com o botão Reativar"]:::ok
    end

    SEED --> OFF
    SEED --> HIST
    GHA --> C1
    C1 --> LOJA
    LOJA --> C2
    C2 --> C3
    C3 -->|"não"| C7
    C3 -->|"sim"| C4
    C4 -->|"sim"| C5
    C4 -->|"não"| C6
    C6 --> OFF
    C6 --> HIST
    C5 --> C8
    C6 --> C8
    C7 --> C8
    C8 -->|"há mais ofertas"| C1
    C8 -->|"acabaram"| C9
    C9 --> C10
    C10 -->|"sim"| C11
    C10 -->|"não"| C12

    HIST --> LAST
    OFF --> S1
    LAST --> S1
    S1 --> S2
    S1 --> S5
    S1 --> S6
    HIST --> S3
    S3 --> S4

    S2 -.->|"a pessoa decide que quer ser avisada"| A1
    S5 -.->|"salva a montagem e pede o aviso"| A1
    A1 --> ALR
    A2 --> A2b
    A2b -->|"não"| A2c
    A2b -->|"sim"| A3
    ALR --> A3
    OFF --> A3
    A3 --> A4
    A4 -->|"não"| A9
    A4 -->|"sim"| A5
    A5 --> A6
    A6 -->|"sim"| A7
    A6 -->|"não"| A9
    A7 --> ALR
    A7 --> A8
    A7 --> A10
```

## 2. Um exemplo, do começo ao fim (ilustrativo)

O preço abaixo é inventado para mostrar a sequência; a peça é a RTX 4060 do catálogo de exemplo
(KaBuM!, R$ 1.899,90 no Pix). A pessoa já criou um alerta para R$ 1.700.

```mermaid
sequenceDiagram
    autonumber
    participant GHA as GitHub Actions
    participant Col as collect-prices.mjs
    participant Loja as Site da loja
    participant Banco as offers e price_history
    participant Tela as Pagina /peca/rtx-4060
    actor Pessoa
    participant Agenda as Agendador do job
    participant Job as api/check-alerts
    participant Resend as Resend

    GHA->>Col: Dispara npm run collect às 06:00 UTC
    Col->>Banco: Lê as ofertas que têm url
    Col->>Loja: Abre a página do produto
    Loja-->>Col: HTML com o preço, por exemplo R$ 1.689,90
    Col->>Banco: Atualiza offers.price_pix e insere um ponto em price_history
    Pessoa->>Tela: Abre a página da peça
    Tela->>Banco: getProductBySlug e getPriceHistory
    Banco-->>Tela: Ofertas, hora da última leitura e pontos do histórico
    Tela-->>Pessoa: Melhor preço agora e gráfico com o novo ponto
    Agenda->>Job: GET com Authorization Bearer CRON_SECRET
    Job->>Banco: price_alerts ativos e sem notified_at, com as ofertas
    Job->>Job: getBestOffer dá 1.689,90, menor ou igual ao alvo 1.700
    Job->>Resend: sendEmail com o assunto e o link da peça
    Resend-->>Job: enviado de verdade
    Job->>Banco: Grava notified_at e desliga o alerta
    Resend-->>Pessoa: E-mail A RTX 4060 caiu para R$ 1.689,90
```

## 3. Onde o preço mora (tabelas)

```mermaid
erDiagram
    stores ||--o{ offers : vende
    stores ||--o{ store_installments : parcela
    products ||--o{ offers : tem
    products ||--o| part_specs : ficha
    offers ||--o{ price_history : registra
    products ||--o{ price_alerts : alvo_da_peca
    saved_builds ||--o{ price_alerts : alvo_da_montagem
    auth_users ||--o{ price_alerts : cria
    auth_users ||--o{ saved_builds : salva
    products ||--o{ product_views : visitas

    stores {
        text id PK
        text name
        numeric rating
        boolean is_official
        numeric reclame_aqui_score
        boolean blocked
    }
    products {
        uuid id PK
        text slug
        text category
        boolean featured
    }
    offers {
        uuid id PK
        uuid product_id FK
        text store_id FK
        text url
        numeric price_pix
        numeric price_installment
        int installment_count
        boolean in_stock
    }
    price_history {
        uuid id PK
        uuid offer_id FK
        timestamptz recorded_at
        numeric price_pix
    }
    part_specs {
        uuid product_id PK
        numeric perf
        int aesthetics
        text socket
        text ram_type
        int wattage
    }
    store_installments {
        text store_id FK
        int count
        numeric factor
    }
    saved_builds {
        uuid id PK
        uuid user_id FK
        text name
        jsonb prefs
        jsonb parts
        numeric total_pix
    }
    price_alerts {
        uuid id PK
        uuid user_id FK
        uuid product_id FK
        uuid saved_build_id FK
        numeric target_price
        boolean is_active
        timestamptz notified_at
    }
    product_views {
        uuid id PK
        uuid product_id FK
        timestamptz viewed_at
    }
    auth_users {
        uuid id PK
    }
```

## 4. O que cada etapa muda

| Campo | Quem escreve | Quem lê | Observação |
|---|---|---|---|
| `offers.price_pix` | `collect-prices.mjs` (e os seeds) | Telas, Montador, `check-alerts` | É o preço "de agora" |
| `offers.price_installment` e `installment_count` | Só os seeds | Telas e Montador (pagamento) | **A coleta não atualiza**: o parcelado pode ficar defasado em relação ao Pix |
| `offers.in_stock` | Só os seeds | Telas, Montador, `check-alerts` | **A coleta não atualiza**: uma peça esgotada na loja continua "em estoque" no site |
| `price_history` | `collect-prices.mjs` (e os seeds) | `getPriceHistory`, view `offer_last_seen` | Um ponto por oferta e por coleta; o gráfico usa o menor preço do dia entre as ofertas honestas |
| `price_alerts.target_price` | `createAlert`, `createBuildAlert` | `check-alerts`, `/conta` | Comparado com o melhor preço Pix da peça ou com o total atual da montagem |
| `price_alerts.notified_at` e `is_active` | `check-alerts` (avisou: desliga), `reactivateAlert` (liga de novo) | `check-alerts`, `/conta` | Alerta avisado aparece como "avisado em DD/MM" e pode ser reativado |
| `saved_builds.parts` e `total_pix` | `saveBuild` (com o preço lido do banco) | `/conta`, `check-alerts` | O total salvo é o da data em que a pessoa salvou |

## 5. Lacunas do ciclo (o que o código ainda não faz)

- **A coleta só atualiza o preço Pix.** Parcelado, número de parcelas e estoque nunca mudam depois do
  seed, o que afeta o plano de pagamento do Montador e a decisão do alerta.
- **Só há adaptadores para `kabum`, `pichau` e `terabyte`.** Ofertas de outras lojas (por exemplo, o
  marketplace do catálogo de exemplo) nunca são atualizadas pelo robô.
- **O job de alertas depende de um agendador externo.** Ele roda pelo workflow `alertas.yml` do
  GitHub Actions (segredos `SITE_URL` e `CRON_SECRET`, de hora em hora) ou por um cron do provedor
  de hospedagem. Sem `CRON_SECRET`, ou em produção sem `RESEND_API_KEY`, a rota responde 503 e o
  agendamento fica vermelho, em vez de "avisar" sem mandar e-mail.
- **O monitor de seletores é simples demais** para lojas com poucas ofertas e não separa falha de rede
  de seletor quebrado (pendências H-1 e H-2).
- **A visita a uma peça não é deduplicada**: cada recarga conta para "Mais procuradas" (pendência SEG-06).
