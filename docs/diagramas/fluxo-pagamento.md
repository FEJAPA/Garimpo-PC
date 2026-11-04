# Pix × parcelado: como o site calcula o pagamento

Depois de montar o PC, a pessoa quer saber **quanto vai pagar e como**. O GarimpoPC mostra duas
opções: **Pix** (à vista, geralmente mais barato) e **parcelado** (no cartão, normalmente com
valor total maior). Há um detalhe importante que a tela repete: **cada loja é um pagamento
separado**. Se o PC tem peças de 3 lojas, são 3 compras, e os totais da tela somam as três.

As contas ficam em `src/services/builder/payments.ts` (e `mixed-plan.ts`, `coupons.ts`); a tela é
`src/components/builder/PaymentPlanner.tsx`. A especificação é o §7 de
`docs/superpowers/specs/2026-11-04-montador-de-pc-design.md`.

> **Legenda**: amarelo = passo que roda hoje, azul = decisão, verde = resultado, roxo = regra,
> **cinza tracejado = V2 que ainda não existe**, **cinza-azulado tracejado = V2 com código pronto
> (pacote E), mas ainda não ligado à tela**.

## O que roda hoje e o que é V2

| Recurso | Estado | Onde |
|---|---|---|
| Totais Pix e parcelado por loja, economia no Pix, seletor de parcelas | **Funciona hoje** (premissa V1: o preço parcelado da loja vale para qualquer número de parcelas até o máximo dela) | `buildPaymentSummary`, `installmentPlan` |
| Tabela de juros por loja (`InstallmentRate`), plano por loja, "sem juros até Nx" | **V2 pacote E: código pronto, não ligado.** `autoBuild` chama `buildPaymentSummary(buildParts)` sem tabelas, e nada na pasta `src/app` chama `getInstallmentTables()` | `rateFor`, `interestFreeUpTo`, `storeInstallment`, `src/services/installments.ts` |
| Aba "Misturar" (parte no Pix, parte no cartão) | **V2 pacote E: código pronto, escondida.** A aba só aparece se `PaymentPlanner` receber `parts`, e `BuildResultView` ainda não as passa (depende do pacote F) | `mixedPlan`, `Misturar` |
| Cupons de desconto | **V2 pacote E: só a lógica.** Não há tabela `coupons`, serviço nem campo de cupom na tela | `applyCoupon` em `coupons.ts` |
| Cashback | **V2: ainda não existe** | — |

---

## 1. Como o resumo de pagamento é calculado

```mermaid
flowchart TD
    classDef passo fill:#fff4d6,stroke:#9a6b00,color:#2b2200
    classDef decisao fill:#e3ecff,stroke:#2f4fbf,color:#0f1d4d
    classDef ok fill:#dff5e6,stroke:#1b7a3f,color:#0b3320
    classDef regra fill:#f3ecff,stroke:#6a4bc4,color:#22124d
    classDef v2pronto fill:#eef3f7,stroke:#4f7390,stroke-dasharray:5 5,color:#1f3547

    A["autoBuild termina de escolher as peças<br/>e chama buildPaymentSummary com as peças"]:::passo
    A --> B["Para cada peça, lê a oferta escolhida<br/>price_pix, price_installment e installment_count"]:::passo
    B --> C["parcelado da peça: price_installment<br/>ou, se for nulo, o próprio price_pix"]:::passo
    C --> D{"A oferta tem preço parcelado<br/>e número de parcelas maior que zero?"}:::decisao
    D -->|"sim"| D1["parcelas da peça: installment_count"]:::passo
    D -->|"não"| D2["parcelas da peça: 1, só à vista"]:::passo
    D1 --> E
    D2 --> E["Agrupa por loja, usando store.id<br/>soma itens, pixTotal e installmentTotal<br/>installmentCount da loja: o menor entre as peças dela"]:::passo
    E --> F{"A loja tem tabela de juros<br/>no argumento tables?"}:::decisao
    F -->|"não, caso de hoje"| G["Mantém o parcelado das ofertas<br/>premissa V1"]:::passo
    F -->|"sim"| H["interestTable da loja e total parcelado<br/>igual a pixTotal x fator do máximo de parcelas<br/>o máximo vira o maior count da tabela"]:::v2pronto
    G --> I
    H --> I["Ordena as lojas da maior para a menor<br/>e soma os totais de todas"]:::passo
    I --> J{"Alguma loja usou tabela de juros?"}:::decisao
    J -->|"não"| K["maxInstallments: o MENOR installmentCount<br/>entre as lojas, o carrinho segue a loja<br/>que parcela em menos vezes"]:::passo
    J -->|"sim"| L["maxInstallments: o MAIOR máximo entre as lojas<br/>cada loja limita só a si mesma"]:::v2pronto
    K --> M
    L --> M["pixSavings igual a installmentTotal menos pixTotal"]:::passo
    M --> N["PaymentSummary<br/>pixTotal, installmentTotal, maxInstallments,<br/>pixSavings e stores"]:::ok
```

Regras gerais: todos os valores são arredondados em centavos (`round2`); preço parcelado nulo conta
como à vista; contagem de parcelas 0 ou nula conta como 1.

---

## 2. O que acontece na tela "Como pagar"

```mermaid
sequenceDiagram
    autonumber
    actor Pessoa
    participant Tela as PaymentPlanner
    participant Calc as payments.ts
    participant Mix as mixed-plan.ts

    Note over Tela: Recebe o PaymentSummary calculado por autoBuild
    Tela->>Pessoa: Aba Pix, com o total no Pix e Você economiza R$ X
    Pessoa->>Tela: Clica em Parcelado
    Tela->>Calc: installmentPlan com o resumo e o número de parcelas
    Note right of Calc: parcelas limitadas de 1 até maxInstallments
    Calc-->>Tela: count, monthly e total
    Tela->>Pessoa: Nx de R$ valor, total parcelado e tabela por loja
    Pessoa->>Tela: Escolhe outro número de parcelas
    Tela->>Calc: installmentPlan e storeInstallment para cada loja
    Calc-->>Tela: novos valores
    Tela->>Pessoa: Atualiza o valor da parcela e a tabela
    opt V2 pacote E - aba Misturar, código pronto mas escondida
        Pessoa->>Tela: Informa quanto tem à vista e quanto cabe por mês
        Tela->>Mix: mixedPlan com as peças, os dois valores e as tabelas
        Mix->>Calc: buildPaymentSummary e installmentPlan com o que vai no cartão
        Calc-->>Mix: plano para cada número de parcelas
        Mix-->>Tela: peças no Pix, peças no cartão, meses e parcela
        Tela->>Pessoa: Mostra a divisão e se a parcela cabe no mês
    end
```

O que a pessoa vê em cada aba:

| Aba | Mostra | Detalhe |
|---|---|---|
| Pix (à vista) | Total no Pix | "Você economiza R$ X em relação ao parcelado" só aparece se `pixSavings` for maior que zero |
| Parcelado | "Nx de R$ valor", total parcelado e seletor de 1x até `maxInstallments` | Sem tabela de juros: "Limitado pela loja que parcela em menos vezes". O texto "Acréscimo de R$ X (N%) em relação ao Pix" ou "Sem juros: mesmo preço do Pix" aparece em qualquer caso |
| Misturar (V2, escondida) | Duas caixas, "No Pix" e "No cartão", e uma caixa de resumo "Cabe no seu orçamento" ou "Ainda não cabe por mês" | Campos "Tenho à vista" e "Cabe por mês" |
| Tabela por loja (sempre) | Loja, itens, total Pix e parcelado | "só à vista" se a loja não parcela; com tabela, mostra também "sem juros até Nx" e o acréscimo |

---

## 3. Exemplo numérico real (catálogo de exemplo)

Montagem do exemplo de [`fluxo-montador.md`](fluxo-montador.md): alvo R$ 6.000, teto R$ 7.000,
slider 0, só lojas confiáveis. Valores obtidos executando as funções reais em 04/11/2026.

### 3.1 O que a tela mostra hoje (V1, sem tabela de juros)

| Loja | Itens | Total Pix | Total parcelado | Máx. parcelas |
|---|---|---|---|---|
| Pichau | 3 | R$ 4.119,70 | R$ 4.614,07 | 10 |
| KaBuM! | 4 | R$ 2.879,60 | R$ 3.225,16 | 10 |
| **Soma** | 7 | **R$ 6.999,30** | **R$ 7.839,23** | **10** |

Você economiza no Pix: R$ 7.839,23 − R$ 6.999,30 = **R$ 839,93**.

| Parcelas escolhidas | Parcela | Total |
|---|---|---|
| 1x | R$ 7.839,23 | R$ 7.839,23 |
| 5x | R$ 1.567,85 | R$ 7.839,23 |
| 10x | R$ 783,92 | R$ 7.839,23 |
| 12x | limitado a 10x: R$ 783,92 | R$ 7.839,23 |

Repare na premissa V1: parcelar em 1x ou em 10x custa o mesmo total, o que na vida real
raramente acontece. É por isso que a V2 traz a tabela de juros.

### 3.2 Como ficaria com as tabelas de juros (V2 pacote E, valores ilustrativos)

Usando `INSTALLMENT_TABLES` de `src/models/installment-tables.ts` (KaBuM!: até 10x sem juros e
11x a 12x com 6% a mais; Pichau: até 12x sem juros; Terabyte: 5% a mais em qualquer parcelamento
até 10x; Promo Center: 15% a mais até 12x):

| Parcelas | Pichau (Pix R$ 4.119,70) | KaBuM! (Pix R$ 2.879,60) | Parcela somada | Total |
|---|---|---|---|---|
| 6x | R$ 686,62 | R$ 479,93 | R$ 1.166,55 | R$ 6.999,30 (sem juros) |
| 10x | R$ 411,97 | R$ 287,96 | R$ 699,93 | R$ 6.999,30 (sem juros) |
| 11x | R$ 374,52 | R$ 277,49 | R$ 652,01 | R$ 7.172,08 |
| 12x | R$ 343,31 | R$ 254,37 | R$ 597,68 | R$ 7.172,08 (+ R$ 172,78, só na KaBuM!) |

Com tabela, o máximo geral sobe para 12x (o **maior** entre as lojas) e a economia no Pix cai
de R$ 839,93 para R$ 172,78, porque o parcelado deixa de ser um preço inventado pela oferta e
passa a seguir a regra de cada loja.

### 3.3 Mistura Pix + cartão (V2 pacote E, aba escondida)

Entrada: **R$ 3.000 à vista** e **R$ 400 por mês**.

| Passo | Resultado |
|---|---|
| Pix: peças mais caras primeiro, enquanto o dinheiro à vista der | RX 7700 XT (R$ 2.999,90), que sozinha cabe nos R$ 3.000 |
| Cartão: as outras 6 peças, no menor número de parcelas cuja parcela caiba em R$ 400 | 10x de R$ 399,94, total R$ 3.999,40 |
| Com tabelas de juros | "O parcelamento sai sem juros: mesmo preço do Pix." Cabe no orçamento |
| Sem tabelas (dados V1 das ofertas) | 10x de R$ 447,93: não cabe ("Falta R$ 47,93 por mês") |

```mermaid
flowchart TD
    classDef v2pronto fill:#eef3f7,stroke:#4f7390,stroke-dasharray:5 5,color:#1f3547
    classDef decisao fill:#e3ecff,stroke:#2f4fbf,color:#0f1d4d
    classDef ok fill:#dff5e6,stroke:#1b7a3f,color:#0b3320

    M0["V2 pacote E - mixedPlan<br/>entrada: peças, cash, monthly e tabelas<br/>valores negativos ou inválidos viram zero"]:::v2pronto
    M0 --> M1["Ordena as peças da mais cara para a mais barata<br/>pelo preço Pix"]:::v2pronto
    M1 --> M2{"Para cada peça: o Pix dela cabe<br/>no que ainda sobra do dinheiro à vista?"}:::decisao
    M2 -->|"sim"| M3["Vai para o Pix e abate do dinheiro à vista"]:::v2pronto
    M2 -->|"não"| M4["Vai para o cartão<br/>as peças mais baratas seguintes ainda podem caber no Pix"]:::v2pronto
    M3 --> M5
    M4 --> M5{"Sobrou alguma peça para o cartão?"}:::decisao
    M5 -->|"não"| M6["Tudo cabe no Pix<br/>sem parcelas"]:::ok
    M5 -->|"sim"| M7["buildPaymentSummary só com as peças do cartão"]:::v2pronto
    M7 --> M8["Percorre n de 1 até o máximo de parcelas<br/>e calcula installmentPlan em n parcelas"]:::v2pronto
    M8 --> M9{"Existe um n cuja parcela é menor<br/>ou igual ao valor que cabe por mês?"}:::decisao
    M9 -->|"sim"| M10["Usa o menor n que cabe<br/>menos meses e menos juros"]:::ok
    M9 -->|"não"| M11["Usa o máximo de parcelas<br/>e avisa quanto falta por mês"]:::v2pronto
```

---

## 4. Regras da V2 pacote E (código pronto)

| Regra | Como funciona | Função |
|---|---|---|
| Fator por parcelas | Usa a **menor faixa que cobre** o número de parcelas pedido. Entre faixas usa a de cima (a mais cara). Acima da maior faixa usa a maior. Tabela vazia = fator 1 | `rateFor` |
| Total em n parcelas | `pixTotal da loja × fator`. O fator nunca é menor que 1 (o banco e o serviço descartam linhas com fator menor) | `storeInstallment` |
| Sem juros até | Maior número de parcelas com fator 1 | `interestFreeUpTo` |
| Parcela somada | Soma o plano de cada loja. Se uma loja termina antes, as últimas parcelas ficam menores | `installmentPlan` |
| Tabelas no banco | `store_installments(store_id, count, factor)`, leitura pública. Sem Supabase usa o mock; com erro no banco devolve vazio, para não esconder juros reais atrás de juros de exemplo | `supabase/schema-payments.sql`, `getInstallmentTables` |
| Cupom | Desconto em % ou valor fixo, na loja ou na montagem toda; confere validade, valor mínimo e nunca desconta mais que o total daquela loja | `applyCoupon` |
