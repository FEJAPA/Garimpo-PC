# Arquitetura do GarimpoPC

Visão de cima: de onde vêm os dados, por quais camadas eles passam até a tela e quais "robôs"
(coleta de preços e alertas) mexem no banco. O banco é o **Supabase** (PostgreSQL + login). Quando
as chaves do Supabase não estão configuradas, o site entra em **modo de demonstração** e usa dados
de exemplo guardados no código (o "mock").

> **Legenda**: amarelo = tela e componentes, azul = regras (services), verde = dados (models),
> roxo = banco de dados, laranja = robôs e scripts, cinza claro = fora do projeto,
> **cinza-azulado tracejado = V2 com código pronto, mas ainda não ligado às telas**.

## 1. Camadas, banco, coleta de preços e alertas

A regra de dependência é de baixo para cima: `models` não depende de `services`, `app` nem
`components`; `services` usa `models`; `app` e `components` usam `services` e `models`. Nenhum
arquivo de `models` ou `services` importa de `app` ou `components`. Uma exceção de desenho: login e
alertas (`app/auth`, `app/account`, `/conta`, `/api/check-alerts`) falam direto com os clientes do
Supabase, sem passar por um serviço.

```mermaid
flowchart LR
    classDef tela fill:#fff4d6,stroke:#9a6b00,color:#2b2200
    classDef regra fill:#e3ecff,stroke:#2f4fbf,color:#0f1d4d
    classDef dado fill:#dff5e6,stroke:#1b7a3f,color:#0b3320
    classDef banco fill:#f3ecff,stroke:#6a4bc4,color:#22124d
    classDef robo fill:#ffe9d6,stroke:#c25b00,color:#3d1c00
    classDef externo fill:#eceff1,stroke:#607d8b,color:#263238
    classDef v2pronto fill:#eef3f7,stroke:#4f7390,stroke-dasharray:5 5,color:#1f3547

    subgraph FORA["Fora do projeto"]
        PESSOA["Pessoa<br/>navegador"]:::externo
        LOJAS["Sites das lojas<br/>KaBuM, Pichau, Terabyte"]:::externo
        RESEND["Resend<br/>envio de e-mails"]:::externo
        CRON["Agendador externo<br/>chama check-alerts<br/>não está no repositório"]:::externo
        GHA["GitHub Actions<br/>ci.yml e coleta.yml"]:::externo
    end

    subgraph NEXT["Aplicação Next.js 16"]
        subgraph C3["Camada 3 - app e components"]
            PROXY["proxy.ts<br/>renova a sessão de login"]:::tela
            PAGES["Páginas<br/>/, /busca, /peca/slug,<br/>/montar, /entrar, /conta"]:::tela
            COMP["components<br/>ui, builder e gráficos<br/>BuilderForm roda autoBuild no navegador"]:::tela
            ACTIONS["Ações de servidor<br/>auth/actions e account/actions"]:::tela
            API["api/check-alerts<br/>job de alertas"]:::tela
        end
        subgraph C2["Camada 2 - services"]
            SPROD["products.ts e popularity.ts<br/>busca, detalhe, histórico,<br/>mais procuradas, visitas"]:::regra
            SBUILD["builder/<br/>autoBuild, trust, scoring,<br/>compatibility, performance,<br/>payments, suspicious"]:::regra
            SEMAIL["email.ts<br/>sendEmail e priceAlertEmail"]:::regra
            SV2["V2 pronto, não ligado<br/>specs.ts, references.ts,<br/>installments.ts"]:::v2pronto
        end
        subgraph C1["Camada 1 - models"]
            CLIENTS["Clientes do Supabase<br/>supabase.ts chave anon<br/>supabase-server.ts sessão<br/>supabase-browser.ts navegador<br/>supabase-admin.ts chave de serviço"]:::dado
            TIPOS["Tipos e categorias<br/>types, builder-types, categories"]:::dado
            MOCK["Dados de exemplo mock<br/>mock-data, part-specs,<br/>reference-builds, installment-tables"]:::dado
        end
    end

    subgraph SCRIPTS["scripts - rodam fora do site"]
        COLLECT["collect-prices.mjs<br/>Playwright lê o preço nas lojas"]:::robo
        SPECS["collect-specs.mjs<br/>grava specs do catálogo curado<br/>scripts/data/specs-catalogo.json"]:::robo
    end

    subgraph DB["Supabase - PostgreSQL e Auth"]
        subgraph CAT["Catálogo e preços - schema.sql"]
            T_STORES[("stores")]:::banco
            T_PRODUCTS[("products")]:::banco
            T_OFFERS[("offers")]:::banco
            T_HIST[("price_history")]:::banco
        end
        subgraph USR["Conta da pessoa - schema-auth.sql"]
            T_USERS[("auth.users")]:::banco
            T_ALERTS[("price_alerts")]:::banco
            T_FAV[("favorites")]:::banco
        end
        subgraph POP["Popularidade - schema-popularity.sql"]
            T_VIEWS[("product_views")]:::banco
            V_POP[("popular_products<br/>view dos últimos 30 dias")]:::banco
        end
        subgraph MONT["Montador V2 - schema-builder, stores e payments"]
            T_SPECS[("part_specs")]:::banco
            T_REFS[("reference_builds")]:::banco
            T_INST[("store_installments")]:::banco
            T_SAVED[("saved_builds<br/>V2 pacote G")]:::banco
        end
    end

    PESSOA --> PROXY
    PROXY --> PAGES
    PAGES --> COMP
    PAGES --> SPROD
    COMP --> SBUILD
    PAGES --> ACTIONS
    SPROD --> CLIENTS
    SPROD -.->|"sem chaves do Supabase"| MOCK
    SBUILD --> TIPOS
    COMP -.->|"BuilderForm usa PART_SPECS direto"| MOCK
    SBUILD -.->|"performance usa REFERENCE_BUILDS por padrão"| MOCK
    ACTIONS --> CLIENTS
    API --> CLIENTS
    API --> SEMAIL
    SEMAIL --> RESEND
    CRON --> API
    SV2 --> CLIENTS
    SV2 -.-> MOCK

    CLIENTS -->|"chave anon, só leitura"| CAT
    CLIENTS -->|"sessão da pessoa, só as próprias linhas"| USR
    CLIENTS -->|"chave de serviço, registra visitas"| POP
    CLIENTS -->|"chave de serviço, job de alertas"| USR
    SV2 -.->|"lê"| MONT

    GHA -->|"todo dia às 06:00 UTC"| COLLECT
    COLLECT -->|"lê a página do produto"| LOJAS
    COLLECT -->|"chave de serviço, atualiza offers e grava price_history"| CAT
    SPECS -->|"chave de serviço"| T_SPECS
```

### Quem lê e quem grava cada tabela

| Tabela | Quem lê | Quem grava | Observação |
|---|---|---|---|
| `stores` | `products.ts` (junto com as ofertas), Montador (`storeTrust`) | seeds SQL (`seed.sql`, `seed-extras.sql`, `seed-stores.sql`) | Colunas `reclame_aqui_score`, `years_active` e `blocked` vêm do `schema-stores.sql` (V2 pacote C) |
| `products` | `products.ts`, `popularity.ts`, `check-alerts` | seeds SQL | `featured` vem do `schema-popularity.sql` |
| `offers` | `products.ts`, `check-alerts`, `collect-prices.mjs` | `collect-prices.mjs` (atualiza só `price_pix`), seeds SQL | A coleta **não** atualiza `price_installment`, `installment_count` nem `in_stock` |
| `price_history` | `getPriceHistory` em `products.ts` | `collect-prices.mjs` (um ponto por oferta e por coleta), seeds SQL | Alimenta o gráfico de `/peca/[slug]` |
| `price_alerts` | `/conta` (sessão da pessoa), `check-alerts` (chave de serviço) | `createAlert` e `deleteAlert` (sessão da pessoa), `check-alerts` (preenche `notified_at`) | Protegida por RLS: cada pessoa só vê as próprias linhas |
| `favorites` | — | — | Tabela criada, mas nenhuma tela usa ainda |
| `product_views` | view `popular_products` | `registerView` (chave de serviço), em cada visita a `/peca/[slug]` | |
| `popular_products` | `getPopularProducts` (home) | — (é uma view) | Soma as visitas dos últimos 30 dias |
| `part_specs` | `getPartSpecs` (V2, não ligado à tela) | `collect-specs.mjs`, `seed-builder.sql` | Hoje `/montar` usa `PART_SPECS` do mock |
| `reference_builds` | `getReferenceBuilds` (V2, não ligado à tela) | `seed-builder.sql`, `seed-references.sql` | Hoje a tela usa `REFERENCE_BUILDS` do mock |
| `store_installments` | `getInstallmentTables` (V2, não ligado à tela) | `seed-payments.sql` | Juros por loja |
| `saved_builds` | — | — | **V2 pacote G**: tabela criada, sem código que a use |

---

## 2. Supabase × modo de demonstração

`getSupabase()` (em `src/models/supabase.ts`) devolve `null` quando faltam `NEXT_PUBLIC_SUPABASE_URL`
ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Cada serviço decide o que fazer com esse `null`:

```mermaid
flowchart TD
    classDef passo fill:#fff4d6,stroke:#9a6b00,color:#2b2200
    classDef decisao fill:#e3ecff,stroke:#2f4fbf,color:#0f1d4d
    classDef mock fill:#dff5e6,stroke:#1b7a3f,color:#0b3320
    classDef banco fill:#f3ecff,stroke:#6a4bc4,color:#22124d

    S["Serviço precisa de dados<br/>por exemplo getProducts"]:::passo
    S --> D{"getSupabase devolve<br/>um cliente?"}:::decisao
    D -->|"não, modo de demonstração"| M["Devolve MOCK_PRODUCTS e MOCK_HISTORY<br/>telas mostram a faixa Modo de demonstração"]:::mock
    D -->|"sim"| Q["Consulta o Supabase com a chave anon"]:::banco
    Q --> E{"Deu erro?"}:::decisao
    E -->|"sim"| E1["Registra o erro no console<br/>e devolve lista vazia<br/>a tela mostra o estado vazio"]:::passo
    E -->|"não"| R["Devolve as linhas do banco"]:::banco
```

O que muda sem Supabase, por área:

| Área | Sem as chaves do Supabase |
|---|---|
| Catálogo (`products.ts`) | Usa `MOCK_PRODUCTS` e `MOCK_HISTORY` |
| Mais procuradas (`popularity.ts`) | Mostra as 6 primeiras peças do mock; `registerView` não faz nada |
| Montador (`/montar`) | Funciona normalmente com o catálogo e as specs do mock |
| Login (`/entrar`, `/conta`, botão de alerta) | `getCurrentUser()` devolve `null`; `/entrar` avisa que o login não está configurado; `/conta` redireciona para `/entrar` |
| `/api/check-alerts` | Responde 500 ("Supabase admin não configurado"), porque precisa da chave de serviço |
| Coleta de preços | `collect-prices.mjs` encerra com erro se faltarem as variáveis |

Um ponto de atenção: **com banco real, o catálogo vem do Supabase, mas as specs do Montador
ainda vêm do mock** (`PART_SPECS`). Peças novas do banco sem spec são ignoradas pela montagem. O
`getPartSpecs()` (V2 pacote A) resolve isso, mas ainda não está ligado à página `/montar`.

---

## 3. Onde cada parte roda: servidor × navegador

O Montador faz os cálculos **no navegador**. O servidor só entrega o catálogo.

```mermaid
sequenceDiagram
    autonumber
    actor Pessoa
    participant Proxy as proxy.ts
    participant Pag as montar/page.tsx no servidor
    participant Svc as products.ts
    participant Banco as Supabase ou mock
    participant Form as BuilderForm no navegador
    participant Algo as autoBuild

    Pessoa->>Proxy: Abre /montar
    Proxy->>Proxy: Renova o cookie de sessão, se houver Supabase
    Proxy->>Pag: Segue a requisição
    Pag->>Svc: getProducts
    Svc->>Banco: products com offers e stores
    Banco-->>Svc: peças com ofertas
    Svc-->>Pag: ProductWithOffers
    Pag-->>Form: HTML com products, alvo e teto iniciais
    Pessoa->>Form: Clica em Montar meu PC
    Form->>Algo: autoBuild com products, PART_SPECS e preferências
    Algo-->>Form: BuildResult, sem nenhuma chamada ao servidor
    Form-->>Pessoa: Resultado na hora
```

## 4. Robôs: coleta de preços e alertas

| Robô | O que faz | Quando roda | Como protege |
|---|---|---|---|
| `scripts/collect-prices.mjs` | Abre a página de cada oferta com Playwright, lê o preço e grava `offers.price_pix` e um ponto em `price_history`. Só tem adaptadores para `kabum`, `pichau` e `terabyte`; ofertas de outras lojas são ignoradas | Todo dia às 06:00 UTC pelo workflow `.github/workflows/coleta.yml`, ou à mão com `npm run collect` | Uma página por vez, pausa de 4 s entre elas, User-Agent identificado. Se mais de 30% das ofertas de uma loja falham, sai com código 2 e o workflow abre uma issue "Seletor quebrado" |
| `scripts/collect-specs.mjs` | Grava em `part_specs` as specs de peças que ainda não têm, a partir de `scripts/data/specs-catalogo.json` | À mão (`node scripts/collect-specs.mjs`) | Valida os valores antes de gravar; `--dry-run` não grava |
| `GET /api/check-alerts` | Procura alertas ativos ainda não avisados, compara com o menor preço em estoque e manda e-mail pelo Resend | Quando o agendador externo chamar (o repositório **não** define esse agendador) | Cabeçalho `Authorization: Bearer <CRON_SECRET>`. **Se `CRON_SECRET` não estiver definido, a rota fica aberta** |
| `.github/workflows/ci.yml` | Confere tipos, lint, testes unitários, build e testes e2e a cada push | Em todo push e pull request | Roda em modo de demonstração, sem Supabase |

O fluxo completo do preço, da loja até o e-mail, está em [`fluxo-dados.md`](fluxo-dados.md).
