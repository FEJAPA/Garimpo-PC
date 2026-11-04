# Arquitetura do GarimpoPC

Visão de cima: de onde vêm os dados, por quais camadas eles passam até a tela e quais "robôs"
(coleta de preços e alertas) mexem no banco. O banco é o **Supabase** (PostgreSQL + login). Quando
as chaves do Supabase não estão configuradas, o site entra em **modo de demonstração** e usa dados
de exemplo guardados no código (o "mock").

> **Legenda**: amarelo = tela e componentes, azul = regras (services), verde = dados (models),
> roxo = banco de dados, laranja = robôs e scripts, cinza claro = fora do projeto.

## 1. Camadas, banco, coleta de preços e alertas

A regra de dependência é de baixo para cima: `models` não depende de `services`, `app` nem
`components`; `services` usa `models`; `app` e `components` usam `services` e `models`. Nenhum
arquivo de `models` ou `services` importa de `app` ou `components`. Uma exceção de desenho: login,
conta e alertas (`app/auth`, `app/account`, `/conta`, `/api/check-alerts`) falam direto com os
clientes do Supabase; a lógica pura deles (validar e serializar montagens, total atual da
montagem) fica em `services/saved-builds.ts`.

```mermaid
flowchart LR
    classDef tela fill:#fff4d6,stroke:#9a6b00,color:#2b2200
    classDef regra fill:#e3ecff,stroke:#2f4fbf,color:#0f1d4d
    classDef dado fill:#dff5e6,stroke:#1b7a3f,color:#0b3320
    classDef banco fill:#f3ecff,stroke:#6a4bc4,color:#22124d
    classDef robo fill:#ffe9d6,stroke:#c25b00,color:#3d1c00
    classDef externo fill:#eceff1,stroke:#607d8b,color:#263238

    subgraph FORA["Fora do projeto"]
        PESSOA["Pessoa<br/>navegador"]:::externo
        LOJAS["Sites das lojas<br/>KaBuM, Pichau, Terabyte"]:::externo
        RESEND["Resend<br/>envio de e-mails"]:::externo
        CRON["Agendador do job de alertas<br/>workflow alertas.yml ou cron do provedor"]:::externo
        GHA["GitHub Actions<br/>ci.yml, coleta.yml e alertas.yml"]:::externo
    end

    subgraph NEXT["Aplicação Next.js 16"]
        subgraph C3["Camada 3 - app e components"]
            PROXY["proxy.ts<br/>renova a sessão de login"]:::tela
            PAGES["Páginas<br/>/, /busca, /peca/slug, /montar,<br/>/metodologia, /entrar, /conta"]:::tela
            COMP["components<br/>ui, builder e gráficos<br/>BuilderForm roda autoBuild no navegador"]:::tela
            ACTIONS["Ações de servidor<br/>auth/actions e account/actions<br/>login, alertas e montagens salvas"]:::tela
            API["api/check-alerts<br/>job de alertas"]:::tela
        end
        subgraph C2["Camada 2 - services"]
            SPROD["products.ts e popularity.ts<br/>busca, detalhe, histórico,<br/>mais procuradas, visitas"]:::regra
            SDADOS["specs.ts, references.ts e installments.ts<br/>specs, PCs de referência e juros<br/>que /montar carrega no servidor"]:::regra
            SBUILD["builder/<br/>autoBuild, trust, suspicious, scoring,<br/>compatibility, performance,<br/>payments, mixed-plan, coupons"]:::regra
            SSAVED["saved-builds.ts<br/>montagem salva e total atual"]:::regra
            SEMAIL["email.ts<br/>sendEmail, priceAlertEmail<br/>e buildAlertEmail"]:::regra
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
        subgraph CAT["Catálogo e preços - schema.sql e schema-stores.sql"]
            T_STORES[("stores")]:::banco
            T_PRODUCTS[("products")]:::banco
            T_OFFERS[("offers")]:::banco
            T_HIST[("price_history<br/>e a view offer_last_seen")]:::banco
        end
        subgraph USR["Conta da pessoa - schema-auth e schema-alerts"]
            T_USERS[("auth.users")]:::banco
            T_ALERTS[("price_alerts<br/>de peça ou de montagem")]:::banco
            T_SAVED[("saved_builds")]:::banco
            T_FAV[("favorites")]:::banco
        end
        subgraph POP["Popularidade - schema-popularity.sql"]
            T_VIEWS[("product_views")]:::banco
            V_POP[("popular_products<br/>view dos últimos 30 dias")]:::banco
        end
        subgraph MONT["Montador - schema-builder e schema-payments"]
            T_SPECS[("part_specs")]:::banco
            T_REFS[("reference_builds")]:::banco
            T_INST[("store_installments")]:::banco
        end
    end

    PESSOA --> PROXY
    PROXY --> PAGES
    PAGES --> COMP
    PAGES --> SPROD
    PAGES --> SDADOS
    COMP --> SBUILD
    COMP --> ACTIONS
    PAGES --> ACTIONS
    ACTIONS --> SSAVED
    API --> SSAVED
    SPROD --> CLIENTS
    SDADOS --> CLIENTS
    SPROD -.->|"só sem chaves do Supabase"| MOCK
    SDADOS -.->|"só sem chaves do Supabase"| MOCK
    SBUILD --> TIPOS
    ACTIONS --> CLIENTS
    API --> CLIENTS
    API --> SEMAIL
    SEMAIL --> RESEND
    CRON -->|"GET com Bearer CRON_SECRET"| API

    CLIENTS -->|"chave anon, só leitura"| CAT
    CLIENTS -->|"chave anon, só leitura"| MONT
    CLIENTS -->|"sessão da pessoa, só as próprias linhas"| USR
    CLIENTS -->|"chave de serviço, registra visitas"| POP
    CLIENTS -->|"chave de serviço, job de alertas"| USR

    GHA -->|"todo dia às 06:00 UTC"| COLLECT
    COLLECT -->|"lê a página do produto"| LOJAS
    COLLECT -->|"chave de serviço, atualiza offers e grava price_history"| CAT
    SPECS -->|"chave de serviço"| T_SPECS
```

### Quem lê e quem grava cada tabela

| Tabela | Quem lê | Quem grava | Observação |
|---|---|---|---|
| `stores` | `products.ts` (junto com as ofertas), Montador (`isTrustedStore`/`storeTrust`) | seeds SQL (`seed.sql`, `seed-extras.sql`, `seed-stores.sql`) | `reclame_aqui_score`, `years_active` e `blocked` vêm do `schema-stores.sql`. Os valores do `seed-stores.sql` são de demonstração |
| `products` | `products.ts`, `popularity.ts`, `check-alerts` | seeds SQL | `featured` vem do `schema-popularity.sql` |
| `offers` | `products.ts`, `check-alerts`, `collect-prices.mjs`, `saveBuild` (confere a oferta antes de gravar) | `collect-prices.mjs` (atualiza só `price_pix`), seeds SQL | A coleta **não** atualiza `price_installment`, `installment_count` nem `in_stock` |
| `price_history` | `getPriceHistory` em `products.ts`; a view `offer_last_seen` | `collect-prices.mjs` (um ponto por oferta e por coleta), seeds SQL | Alimenta o gráfico de `/peca/[slug]`. `offer_last_seen` dá a hora da última leitura de cada oferta ("lido em DD/MM, HH:MM") |
| `price_alerts` | `/conta` (sessão da pessoa), `check-alerts` (chave de serviço) | `createAlert`, `createBuildAlert`, `deleteAlert` e `reactivateAlert` (sessão da pessoa); `check-alerts` (grava `notified_at` e desliga o alerta) | RLS: cada pessoa só vê as próprias linhas e só aponta para as próprias montagens. `saved_build_id` vem do `schema-alerts.sql` |
| `saved_builds` | `/conta` (sessão), `check-alerts` (chave de serviço) | `saveBuild` e `deleteSavedBuild` (sessão) | Nome até 60 caracteres, de 1 a 20 peças, até 50 montagens por pessoa |
| `favorites` | — | — | Tabela criada, mas nenhuma tela usa ainda |
| `product_views` | view `popular_products` | `registerView` (chave de serviço), em cada visita a `/peca/[slug]` | Sem deduplicação (pendência SEG-06) |
| `popular_products` | `getPopularProducts` (home) | — (é uma view) | Soma as visitas dos últimos 30 dias |
| `part_specs` | `getPartSpecs` → `/montar` | `collect-specs.mjs`, `seed-builder.sql` | Linha incompleta é descartada e contada no log |
| `reference_builds` | `getReferenceBuilds` → `/montar` | `seed-references.sql` | Os 12 PCs de referência; o seed é de demonstração |
| `store_installments` | `getInstallmentTables` → `/montar` | `seed-payments.sql` | Juros por loja; o seed é de demonstração |

---

## 2. Supabase × modo de demonstração

`getSupabase()` (em `src/models/supabase.ts`) devolve `null` quando faltam `NEXT_PUBLIC_SUPABASE_URL`
ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`. A regra do projeto (`AGENTS.md`) é: **dado ilustrativo nunca vira
fato no modo real**. O mock só é usado quando não há banco. Com banco, um erro ou uma tabela vazia
devolve vazio, e a tela avisa.

```mermaid
flowchart TD
    classDef passo fill:#fff4d6,stroke:#9a6b00,color:#2b2200
    classDef decisao fill:#e3ecff,stroke:#2f4fbf,color:#0f1d4d
    classDef mock fill:#dff5e6,stroke:#1b7a3f,color:#0b3320
    classDef banco fill:#f3ecff,stroke:#6a4bc4,color:#22124d

    S["Serviço precisa de dados<br/>getProducts, getPartSpecs,<br/>getReferenceBuilds ou getInstallmentTables"]:::passo
    S --> D{"getSupabase devolve<br/>um cliente?"}:::decisao
    D -->|"não, modo de demonstração"| M["Devolve o mock<br/>as telas mostram a faixa Modo de demonstração"]:::mock
    D -->|"sim"| Q["Consulta o Supabase com a chave anon"]:::banco
    Q --> E{"Deu erro ou<br/>a tabela está vazia?"}:::decisao
    E -->|"sim"| E1["Registra no console e devolve vazio<br/>nunca o mock<br/>a tela mostra o aviso daquela parte"]:::passo
    E -->|"não"| R["Valida cada linha e devolve<br/>só as que fazem sentido"]:::banco
```

O que muda sem Supabase, e o que acontece com banco quando falta dado:

| Área | Sem as chaves do Supabase | Com Supabase, mas erro ou tabela vazia |
|---|---|---|
| Catálogo (`getProducts`) | `MOCK_PRODUCTS` e `MOCK_HISTORY` | Lista vazia; `/montar` mostra "Catálogo vazio" |
| Specs (`getPartSpecs`) | `PART_SPECS` | `{}`; `/montar` mostra "Sem especificações cadastradas" e as peças são ignoradas |
| PCs de referência (`getReferenceBuilds`) | Os 12 de `REFERENCE_BUILDS` | `[]`; o painel de desempenho diz que não há referências e não mostra FPS |
| Juros (`getInstallmentTables`) | `INSTALLMENT_TABLES` | `{}`; vale o preço parcelado de cada oferta |
| Mais procuradas (`popularity.ts`) | As 6 primeiras peças do mock; `registerView` não faz nada | Destaques manuais (`featured`) ou as primeiras peças |
| Login (`/entrar`, `/conta`, salvar, alertas) | `getCurrentUser()` devolve `null`; `/entrar` avisa que o login não está configurado; `/conta` redireciona para `/entrar` | — |
| `/api/check-alerts` | Responde 503 sem `CRON_SECRET`, sem a chave de serviço ou, em produção, sem `RESEND_API_KEY` | — |
| Coleta de preços | `collect-prices.mjs` encerra com erro se faltarem as variáveis | — |

---

## 3. Onde cada parte roda: servidor × navegador

O servidor carrega os dados; o Montador faz os cálculos **no navegador**, por isso o resultado
aparece na hora. O código do algoritmo só é baixado quando a pessoa clica em "Montar meu PC".

```mermaid
sequenceDiagram
    autonumber
    actor Pessoa
    participant Proxy as proxy.ts
    participant Pag as montar/page.tsx no servidor
    participant Svc as services
    participant Banco as Supabase ou mock
    participant Form as BuilderForm no navegador
    participant Algo as autoBuild

    Pessoa->>Proxy: Abre /montar
    Proxy->>Proxy: Renova o cookie de sessão, se houver Supabase
    Proxy->>Pag: Segue a requisição
    Pag->>Svc: getProducts, getPartSpecs, getReferenceBuilds e getInstallmentTables
    Svc->>Banco: quatro consultas em paralelo
    Banco-->>Svc: peças, specs, referências e juros
    Svc-->>Pag: dados validados
    Pag-->>Form: HTML com os dados, alvo e teto da URL e o código do link
    Pessoa->>Form: Clica em Montar meu PC
    Form->>Algo: import tardio de auto-build e autoBuild com os dados e as preferências
    Algo-->>Form: BuildResult, sem nenhuma chamada ao servidor
    Form-->>Pessoa: Resultado na hora e foco no resumo
```

Salvar a montagem e criar alertas chamam **ações de servidor** (`saveBuild`, `createBuildAlert`),
que exigem login, conferem no banco que cada oferta é daquela peça e gravam o preço que está no
banco, não o que veio do navegador.

## 4. Robôs: coleta de preços e alertas

| Robô | O que faz | Quando roda | Como protege |
|---|---|---|---|
| `scripts/collect-prices.mjs` | Abre a página de cada oferta com Playwright, lê o preço e grava `offers.price_pix` e um ponto em `price_history`, conferindo se a gravação deu certo. Só tem adaptadores para `kabum`, `pichau` e `terabyte` | Todo dia às 06:00 UTC pelo workflow `.github/workflows/coleta.yml`, ou à mão com `npm run collect` | Uma página por vez, pausa de 4 s entre elas, User-Agent identificado. Se mais de 30% das ofertas de uma loja falham, sai com código 2 e o workflow abre uma issue "Seletor quebrado" |
| `scripts/collect-specs.mjs` | Grava em `part_specs` as specs de peças que ainda não têm, a partir de `scripts/data/specs-catalogo.json` | À mão (`npm run collect:specs`) | Valida os valores antes de gravar; `--dry-run` não grava |
| `GET /api/check-alerts` | Procura alertas ativos ainda não avisados. Alerta de peça: compara o alvo com o melhor preço (`getBestOffer`). Alerta de montagem: compara com o total atual das peças salvas. Manda e-mail pelo Resend | Por um agendador **externo**: o workflow `.github/workflows/alertas.yml` (de hora em hora, segredos `SITE_URL` e `CRON_SECRET`) ou um cron do provedor de hospedagem | `CRON_SECRET` é obrigatório: sem ele a rota responde **503**; com token errado, **401** (comparação em tempo constante). Em produção, sem `RESEND_API_KEY` também responde 503. E-mail simulado não marca o alerta como avisado |
| `.github/workflows/ci.yml` | Confere tipos, lint, testes unitários, build e testes e2e a cada push | Em todo push e pull request | Roda em modo de demonstração, sem Supabase |

O fluxo completo do preço, da loja até o e-mail, está em [`fluxo-dados.md`](fluxo-dados.md).
