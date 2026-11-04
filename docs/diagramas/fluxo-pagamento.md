# Pix × parcelado: como o site calcula o pagamento

Depois de montar o PC, a pessoa quer saber **quanto vai pagar e como**. O GarimpoPC mostra três
opções: **Pix** (à vista, geralmente mais barato), **Parcelado** (no cartão) e **Misturar** (parte
no Pix, parte no cartão). Há um detalhe importante que a tela repete: **cada loja é um pagamento
separado**. Se o PC tem peças de 3 lojas, são 3 compras, e os totais da tela somam as três.

A regra de dinheiro que manda em tudo: no Brasil, "10x sem juros" vale sobre o **preço a prazo**
que a loja anuncia, e esse preço já é maior que o do Pix (o desconto só existe no Pix). Por isso o
site **nunca** mostra um parcelado mais barato que o preço a prazo anunciado, e nunca mostra o
cartão mais barato que o Pix.

As contas ficam em `src/services/builder/payments.ts` e `mixed-plan.ts`; a tela é
`src/components/builder/PaymentPlanner.tsx`. As tabelas de juros vêm de
`src/services/installments.ts`. A especificação é o §7 de
`docs/superpowers/specs/2026-11-04-montador-de-pc-design.md`.

> **Legenda**: amarelo = passo, azul = decisão, verde = resultado, roxo = regra,
> **cinza tracejado = ainda não existe (pendência pós-V2)**, **cinza-azulado tracejado = código
> pronto, mas sem tela**.

## O que está no ar

| Recurso | Estado | Onde |
|---|---|---|
| Totais Pix e a prazo por loja, seletor de parcelas, economia no Pix | **No ar** | `buildPaymentSummary`, `installmentPlan`, `installmentOptions` |
| Tabela de juros por loja | **No ar.** `/montar` carrega `getInstallmentTables()` e passa pelo `BuildContext` até `buildPaymentSummary(parts, tables)`. Sem Supabase usa o mock; com Supabase, erro ou tabela vazia devolvem `{}` (e vale o preço parcelado da oferta) | `rateFor`, `getInstallmentTables` |
| Preço a prazo como piso e "sem acréscimo até Nx" | **No ar.** Até o número de parcelas que a oferta anuncia vale o preço a prazo; a tabela só decide acima disso, e nunca abaixo do preço a prazo | `storeInstallment`, `storeNoExtraUpTo` |
| Faixas ("10x de R$ X + 2x de R$ Y") | **No ar.** Cada loja limita só as próprias parcelas; os centavos vão na 1ª parcela | `installmentBands`, `formatSchedule` |
| Parcelado mais barato e onde o seletor abre | **No ar** | `bestInstallment`, `defaultInstallmentCount` |
| Aba "Misturar" | **No ar** (visível sempre que há peças) | `mixedPlan`, `Misturar` em `PaymentPlanner.tsx` |
| Parcelado de uma oferta ("ou 10x de R$ X") | **No ar.** A lista de peças, a página da peça e o CSV usam a mesma conta | `offerInstallment` |
| Cupons de desconto | **Código pronto, sem tela.** Não há tabela `coupons` nem campo de cupom | `applyCoupon` em `coupons.ts` |
| Cashback e mistura ótima | **Ainda não existem** (pendências E-2 a E-4) | — |

---

## 1. Como o resumo de pagamento é calculado (`buildPaymentSummary`)

```mermaid
flowchart TD
    classDef passo fill:#fff4d6,stroke:#9a6b00,color:#2b2200
    classDef decisao fill:#e3ecff,stroke:#2f4fbf,color:#0f1d4d
    classDef ok fill:#dff5e6,stroke:#1b7a3f,color:#0b3320
    classDef regra fill:#f3ecff,stroke:#6a4bc4,color:#22124d

    A["autoBuild termina de escolher as peças<br/>e chama buildPaymentSummary com as peças<br/>e as tabelas de juros de ctx"]:::passo
    A --> B["Para cada peça, lê a oferta escolhida<br/>price_pix, price_installment e installment_count"]:::passo
    B --> C{"price_installment é um número<br/>finito maior que zero?"}:::decisao
    C -->|"não"| C1["Preço a prazo da peça: o Pix<br/>parcelas: 1, só à vista<br/>não anuncia parcelas"]:::passo
    C -->|"sim"| C2["Preço a prazo da peça: o maior entre<br/>price_installment e o Pix<br/>parcelas: installment_count, entre 1 e 24"]:::passo
    C1 --> E
    C2 --> E["Agrupa por loja: soma itens, pixTotal e installmentTotal<br/>installmentCount: o menor entre as peças da loja<br/>offersInstallmentCount: o menor número anunciado"]:::passo
    E --> F{"A loja tem tabela de juros válida?<br/>parcelas de 1 a 24 e fator 1 ou mais"}:::decisao
    F -->|"não"| G["A loja parcela até o que as ofertas anunciam<br/>pelo preço a prazo, em qualquer número de parcelas"]:::passo
    F -->|"sim"| H["interestTable guardada na loja<br/>a loja parcela até o maior número da tabela"]:::passo
    G --> I
    H --> I["maxInstallments: o MAIOR máximo entre as lojas<br/>cada loja limita só a si mesma"]:::passo
    I --> J["installmentOptions de 1x até maxInstallments<br/>com o total e o acréscimo de cada uma"]:::passo
    J --> K["bestInstallment: o parcelado mais barato com mais de 1 parcela<br/>empate fica com o maior número de parcelas"]:::passo
    K --> L["pixSavings igual a bestInstallment.total menos pixTotal<br/>nunca negativo"]:::passo
    L --> N["PaymentSummary<br/>pixTotal, installmentTotal, maxInstallments,<br/>bestInstallment, pixSavings e stores"]:::ok
    R["Regra: o preço a prazo é o piso do parcelado<br/>e o Pix é o piso do preço a prazo"]:::regra
    R -.-> C2
```

### 1.1 Total de uma loja em n parcelas

```mermaid
flowchart TD
    classDef passo fill:#fff4d6,stroke:#9a6b00,color:#2b2200
    classDef decisao fill:#e3ecff,stroke:#2f4fbf,color:#0f1d4d
    classDef ok fill:#dff5e6,stroke:#1b7a3f,color:#0b3320

    T0["n parcelas pedidas<br/>limitado ao máximo da loja"]:::passo
    T0 --> T1{"A loja tem tabela de juros?"}:::decisao
    T1 -->|"não"| T2["Total: o preço a prazo das ofertas"]:::ok
    T1 -->|"sim"| T3{"n é menor ou igual ao número<br/>de parcelas que as ofertas anunciam?"}:::decisao
    T3 -->|"sim"| T2
    T3 -->|"não"| T4["Total: o maior entre o preço a prazo<br/>e pixTotal vezes o fator da tabela para n"]:::ok
```

Exemplo: a peça da Terabyte diz "ou 10x de R$ 128,78", e a tabela de exemplo da Terabyte diz
"até 6x pelo preço a prazo; 7x a 10x, Pix + 15%". Como a oferta **anuncia** 10x, a loja cobra o
preço a prazo até 10x, e o seletor mostra "sem acréscimo" até 10x. A tabela só valeria acima de
10x, mas a Terabyte não parcela além disso.

Regras gerais: todos os valores são arredondados em centavos; parcelas fora de 1..24 e fatores
menores que 1 são descartados (no serviço e no banco); o resto da divisão de cada loja vai na 1ª
parcela, para a soma das parcelas fechar exatamente o total.

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
    Tela->>Calc: defaultInstallmentCount
    Note right of Calc: maior n sem acréscimo, ou o parcelado mais barato
    Tela->>Pessoa: Aba Pix com o total e Você economiza R$ X em relação a Nx no cartão
    Pessoa->>Tela: Clica em Parcelado
    Tela->>Calc: installmentPlan e installmentBands no número padrão
    Calc-->>Tela: total e faixas, com os centavos na 1a parcela
    Tela->>Pessoa: Faixas, total parcelado e se há acréscimo sobre o preço a prazo
    Pessoa->>Tela: Escolhe outro número de parcelas no seletor
    Tela->>Calc: installmentPlan e storeInstallment para cada loja
    Calc-->>Tela: novos valores
    Tela->>Pessoa: Atualiza as faixas e a tabela por loja
    Pessoa->>Tela: Clica em Misturar e informa Tenho à vista e Cabe por mês
    Tela->>Mix: mixedPlan com as peças, os dois valores e as tabelas da montagem
    Mix->>Calc: buildPaymentSummary e installmentPlan só com o que vai no cartão
    Calc-->>Mix: plano para cada número de parcelas
    Mix-->>Tela: peças no Pix, peças no cartão, faixas e se cabe
    Tela->>Pessoa: Mostra a divisão e Cabe no seu orçamento ou Ainda não cabe por mês
```

O que a pessoa vê em cada aba:

| Aba | Mostra | Detalhe |
|---|---|---|
| Pix (à vista) | Total no Pix | "Você economiza R$ X em relação a Nx no cartão, o parcelado mais barato." Só aparece se `pixSavings` for maior que zero |
| Parcelado | Faixas (ex.: "10x de R$ 663,48 + 2x de R$ 534,70"), total parcelado, quanto é a mais que o Pix e se há acréscimo sobre o preço a prazo | O seletor vai de 1x até `maxInstallments`, cada opção com "sem acréscimo" ou "+R$ X". Abre no maior número sem acréscimo; se todas têm acréscimo, no parcelado mais barato |
| Misturar | Campos "Tenho à vista (R$)" e "Cabe por mês (R$)", caixas "No Pix" e "No cartão" e o resumo "Cabe no seu orçamento" ou "Ainda não cabe por mês" | O dinheiro à vista vai primeiro para as peças que mais encarecem no cartão |
| Tabela por loja (sempre) | Loja, itens, Pix e a prazo, com "Nx de R$ Y" ou "só à vista" | Com tabela, também "sem acréscimo até Nx" e "+R$ X em Nx" |

---

## 3. Exemplo numérico real (catálogo de exemplo)

Montagem do exemplo de [`fluxo-montador.md`](fluxo-montador.md) (seção 9.1): alvo R$ 6.000, teto
R$ 7.000, slider 0, perfil Jogos, só lojas confiáveis. Valores obtidos executando as funções reais
em 04/11/2026 com as tabelas de juros de exemplo (`src/models/installment-tables.ts`): KaBuM! até
10x pelo preço a prazo e 11x a 12x com Pix + 16%; Pichau até 12x pelo preço a prazo; Terabyte até
6x pelo preço a prazo e 7x a 10x com Pix + 15%.

### 3.1 Por loja

| Loja | Itens | Total Pix | Preço a prazo | Parcelas anunciadas | Máx. parcelas | Sem acréscimo até |
|---|---|---|---|---|---|---|
| Pichau | 2 | R$ 3.419,80 | R$ 3.830,18 | 10 | 12 | 12x |
| KaBuM! | 4 | R$ 2.229,60 | R$ 2.497,16 | 10 | 12 | 10x |
| Terabyte Shop | 1 | R$ 1.149,90 | R$ 1.287,89 | 10 | 10 | 10x |
| **Soma** | 7 | **R$ 6.799,30** | **R$ 7.615,23** | | **12** | |

### 3.2 O seletor de parcelas

| Parcelas | O que a tela mostra | Total | Acréscimo sobre o preço a prazo |
|---|---|---|---|
| 1x | 1x de R$ 7.615,23 | R$ 7.615,23 | sem acréscimo |
| 6x | 6x de R$ 1.269,19 (+ centavos na 1ª) | R$ 7.615,23 | sem acréscimo |
| **10x (abre aqui)** | 10x de R$ 761,50 (+ centavos na 1ª) | R$ 7.615,23 | sem acréscimo |
| 11x | 10x de R$ 712,09 + 1x de R$ 583,31 | R$ 7.704,41 | +R$ 89,18 (só a KaBuM!) |
| 12x | 10x de R$ 663,48 + 2x de R$ 534,70 | R$ 7.704,41 | +R$ 89,18 (só a KaBuM!) |

- O seletor **abre em 10x**: é o maior número de parcelas sem acréscimo.
- Em 11x e 12x a Terabyte fica em 10x (é o máximo dela). Por isso as últimas parcelas são menores.
- O parcelado mais barato com mais de 1 parcela é 10x por R$ 7.615,23, então a aba Pix diz
  "Você economiza **R$ 815,93** em relação a 10x no cartão".
- Sem as tabelas de juros (modo real com `store_installments` vazia), cada loja vai até o que as
  ofertas anunciam (10x aqui), sempre pelo preço a prazo. Uma loja que só aceita Pix fica em 1x e
  **não** derruba o carrinho inteiro para 1x.

### 3.3 Mistura Pix + cartão

Entrada: **R$ 3.000 à vista** e **R$ 400 por mês**.

| Passo | Resultado |
|---|---|
| Pix: as peças que mais encarecem no cartão primeiro, enquanto o dinheiro à vista der | RX 7700 XT (R$ 2.999,90), que sozinha cabe nos R$ 3.000 |
| Cartão: as outras 6 peças, no menor número de parcelas cuja 1ª parcela caiba em R$ 400 | 12x: "10x de R$ 383,49 + 2x de R$ 254,71", total R$ 4.344,52. Em 10x ou 11x, a 1ª parcela passaria de R$ 400 |
| Notas da tela | "Pague R$ 2.999,90 no Pix (1 peça) e parcele o resto em 10x de R$ 383,49 + 2x de R$ 254,71.", "No cartão essas peças custam R$ 545,12 a mais do que no Pix." e "Desse valor, R$ 89,18 é acréscimo da loja acima do preço a prazo anunciado." |

```mermaid
flowchart TD
    classDef passo fill:#fff4d6,stroke:#9a6b00,color:#2b2200
    classDef decisao fill:#e3ecff,stroke:#2f4fbf,color:#0f1d4d
    classDef ok fill:#dff5e6,stroke:#1b7a3f,color:#0b3320
    classDef regra fill:#f3ecff,stroke:#6a4bc4,color:#22124d

    M0["mixedPlan<br/>entrada: peças, cash, monthly e tabelas<br/>valores negativos ou inválidos viram zero"]:::passo
    M0 --> M1["Custo evitado de cada peça<br/>o maior entre o preço a prazo e o Pix vezes o fator<br/>da loja no máximo de parcelas, menos o Pix"]:::passo
    R1["Por quê: uma peça de loja com 15 por cento de juros<br/>encarece mais no cartão do que uma peça mais cara<br/>de loja sem juros"]:::regra
    R1 -.-> M1
    M1 --> M2["Ordena as peças pelo custo evitado, maior primeiro<br/>empate: a mais cara primeiro"]:::passo
    M2 --> M3{"Para cada peça: o Pix dela cabe<br/>no que ainda sobra do dinheiro à vista?"}:::decisao
    M3 -->|"sim"| M4["Vai para o Pix e abate do dinheiro à vista"]:::passo
    M3 -->|"não"| M5["Vai para o cartão<br/>as peças seguintes ainda podem caber no Pix"]:::passo
    M4 --> M6
    M5 --> M6{"Sobrou alguma peça para o cartão?"}:::decisao
    M6 -->|"não"| M7["Tudo cabe no Pix<br/>sem parcelas"]:::ok
    M6 -->|"sim"| M8["buildPaymentSummary só com as peças do cartão"]:::passo
    M8 --> M9["Percorre n de 1 até o máximo de parcelas<br/>e calcula installmentPlan em n parcelas"]:::passo
    M9 --> M10{"Existe um n cuja 1a parcela é menor<br/>ou igual ao que cabe por mês?"}:::decisao
    M10 -->|"sim"| M11["Usa o menor n que cabe<br/>menos meses e menos juros"]:::ok
    M10 -->|"não"| M12["Usa o máximo de parcelas<br/>e avisa quanto falta por mês"]:::passo
```

---

## 4. Regras em uma tabela

| Regra | Como funciona | Função |
|---|---|---|
| Preço a prazo da oferta | `price_installment` válido (número finito maior que zero), nunca abaixo do Pix. Sem ele, a oferta entra pelo Pix e não parcela | `validInstallmentPrice` |
| Parcelas da oferta | `installment_count` entre 1 e 24; sem preço a prazo válido, 1x | `parcelasDaOferta` |
| Até o anunciado, preço a prazo | Até o menor número de parcelas anunciado pelas ofertas da loja, o total é o preço a prazo, mesmo que a tabela diga outra coisa | `totalDaLoja` |
| Acima do anunciado, a tabela | Total em n parcelas = o maior entre o preço a prazo e `pixTotal × fator(n)`. A tabela só encarece | `totalDaLoja`, `rateFor` |
| Fator por parcelas | A menor faixa que cobre n; entre faixas, a de cima (a mais cara); acima da maior faixa, a maior. Tabela vazia = fator 1 | `rateFor` |
| Máximo de parcelas | Por loja: o maior número da tabela, ou o que as ofertas anunciam. Geral: o **maior** entre as lojas, sempre | `maximoDaLoja`, `buildPaymentSummary` |
| Faixas | Soma o plano de cada loja; quem termina antes deixa as últimas parcelas menores | `installmentPlan`, `installmentBands` |
| Sem acréscimo até | Maior número de parcelas em que a loja cobra só o preço a prazo | `storeNoExtraUpTo` |
| Parcelado mais barato | O plano mais barato com mais de 1 parcela (empate: o maior n). É a base de "Você economiza" | `bestInstallment` |
| Onde o seletor abre | No maior número de parcelas sem acréscimo; se todas têm acréscimo, no parcelado mais barato | `defaultInstallmentCount` |
| Limites | Parcelas de 1 a 24 em ofertas, tabelas e banco (`check (count between 1 and 24)`) | `MAX_INSTALLMENTS` |
| Tabelas no banco | `store_installments(store_id, count, factor)`, leitura pública. Sem Supabase usa o mock; com erro ou tabela vazia devolve `{}`, para não esconder juros reais atrás de juros de exemplo | `supabase/schema-payments.sql`, `getInstallmentTables` |
| Cupom (sem tela) | Desconto em % ou valor fixo, na loja ou na montagem toda; confere validade, valor mínimo e nunca desconta mais que o total daquela loja | `applyCoupon` |
