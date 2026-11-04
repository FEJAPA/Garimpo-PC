# Como estimamos o desempenho

O Montador mostra um **Índice GarimpoPC** e uma **estimativa de FPS** para a sua montagem.
Isto é uma estimativa, não um teste: **a GarimpoPC não mediu nenhum FPS**. O resultado real
muda com o jogo, os drivers, a temperatura e as configurações gráficas.

## 1. O índice

`índice = 0,7 × placa de vídeo + 0,3 × processador` (arredondado).

Cada peça tem um índice relativo dentro da categoria (RTX 4060 = 100 entre as placas de vídeo;
Ryzen 5 7600 = 100 entre os processadores). A placa pesa mais porque, nos jogos, ela costuma
mandar no resultado. Em jogos leves o processador pesa mais; por isso avisamos quando ele
pode limitar a placa (processador abaixo de metade do índice da placa).

## 2. Os computadores de referência

Comparamos a sua montagem com 12 computadores de referência, do "equivalente a console" ao
"topo de linha". Cada um tem peças, preço aproximado, índice e FPS estimados por tipo de jogo
(leves, AAA médios e AAA pesados) e por resolução (Full HD e Quad HD).

De onde vêm os números:

- Parte dos índices das peças vem do catálogo de exemplo do app, que se declara **ilustrativo
  (V1)**. Eles serão trocados por dados de verdade (ver `docs/COLETA-SPECS.md`).
- O resto foi derivado de agregados públicos: **checkfps.io** e as hierarquias de desempenho
  do **Tom's Hardware**. O próprio checkfps.io diz que *estima* os FPS com um modelo próprio e
  que a margem de erro típica é de ±10–15% frente a testes reais.
- **Mês de referência das fontes: maio/2026.** É o mês que o checkfps.io informa para a última
  atualização do banco de dados dele (30/05/2026). Consultamos as fontes em **novembro/2026**.
  O campo `measuredAt` no código guarda esse mês de referência; apesar do nome, não é data de
  medição.
- Os preços dos computadores de referência são uma ordem de grandeza do preço no Brasil, não
  uma cotação.

## 3. Do índice ao FPS (interpolação)

1. Achamos as duas referências que "cercam" o seu índice e fazemos uma média ponderada pela
   distância (interpolação linear). Exemplo: índice 116, entre o PC de 110 e o de 122, usa
   metade de cada um.
2. Abaixo da menor referência ou acima da maior, escalamos de forma proporcional ao índice
   (`FPS × índice ÷ índice da referência`).
3. Mostramos o computador de índice mais próximo ("equivale a um…") e os três mais parecidos.

## 4. Memória (RAM)

Os FPS de cada referência **já incluem a memória dela**. Por isso só descontamos o que falta:

- Se a montagem tem **16 GB ou menos** e a referência tem **mais**, tiramos **8%** do FPS dos
  jogos AAA pesados (o ganho de 32 GB aparece sobretudo neles).
- Se a montagem tem a mesma memória que a referência, não descontamos nada: o resultado é o
  da referência.
- Entre uma referência de 16 GB e outra de 32 GB, o desconto é proporcional (metade do peso em
  32 GB, 4%).
- Se não sabemos a memória da peça ou da referência, não descontamos.

Não aumentamos o FPS de quem tem mais memória que a referência.

## 5. DLSS, FSR e XeSS

Essas tecnologias (upscaling) podem aumentar bastante os FPS, principalmente em 1440p. Os
números **não contam esse ganho**. A nota na tela lista só o que a placa escolhida suporta
(placas AMD: FSR; placas NVIDIA: DLSS ou FSR).

## 6. Limites

- Não consideramos jogo por jogo, só três perfis médios.
- Não consideramos temperatura, ventilação, velocidade da memória, SSD, versão do driver
  nem otimização de cada título.
- Não estimamos 4K nem ray tracing.
- Se não houver computadores de referência disponíveis, a tela avisa e não mostra FPS.

## 7. Onde isso está no código

- Conta: `src/services/builder/performance.ts` (com testes ao lado).
- Referências: `src/models/reference-builds.ts` e `supabase/seed-references.sql` (o mesmo
  conteúdo; um teste confere que não divergem).
- Telas: `src/components/builder/PerformancePanel.tsx` e `PerformanceChart.tsx`.
