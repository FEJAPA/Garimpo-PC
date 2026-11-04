# PRODUCT.md — GarimpoPC

Verdade durável sobre o produto. Serve de contexto para qualquer pessoa ou agente que
for desenhar ou construir telas. (Fonte: README, código existente e o brief do
Montador de PC. Onde o brief não dizia, está marcado como *premissa*.)

## O que é

GarimpoPC é um **comparador de preços de hardware gamer no Brasil** que agora ganha um
**Montador de PC automático**: a pessoa diz quanto pode gastar e o site monta um
computador completo com peças compatíveis, de lojas confiáveis, e mostra o que esperar
dele em jogos.

"Garimpar" = procurar ouro. A marca promete achar o preço de ouro sem cair em golpe.

## Para quem

- **Principal:** pessoa leiga ou semi-leiga que quer um PC gamer, tem um valor em mente
  (ex.: "posso gastar 6 mil, no máximo 7") e tem medo de comprar peça errada ou cair
  em golpe. Compra parcelado ou no Pix.
- **Secundário:** entusiasta que já sabe o que quer e usa o site para comparar preço e
  histórico.

Linguagem: **português do Brasil**, acessível, sem jargão não explicado.

## Diferenciais (o que o produto promete)

1. **Lojas confiáveis (anti-golpe):** reputação visível; opção de só considerar lojas
   oficiais/curadas.
2. **Histórico de preço real:** mostra se a promoção é real.
3. **Montagem automática honesta:** respeita o orçamento, usa uma folga só quando vale a
   pena, nunca passa do teto.
4. **Expectativa realista:** estimativa de desempenho comparada com computadores de
   referência, em vez de promessa vaga.
5. **Pagamento à brasileira:** Pix (à vista) × parcelado, por loja.

## Jornadas

- Buscar uma peça → comparar lojas → ver histórico → criar alerta.
- **Montar um PC** (`/montar`): orçamento alvo + teto → preferências (só lojas
  confiáveis; desempenho ↔ estética) → ver a montagem, o desempenho esperado e o plano
  de pagamento → ir para as lojas.

## Restrições e fatos técnicos

- Next.js 16 (App Router, React 19), TypeScript, Tailwind CSS 4, Recharts, Supabase
  (com modo de demonstração via dados mock quando não configurado).
- Moeda: BRL. Preços têm duas faces: `price_pix` e `price_installment` (+ `installment_count`).
- Sem imagens de produto por enquanto (`image_url` nulo nos dados de exemplo).
- *Premissa:* os índices de desempenho e os computadores de referência da V1 são
  ilustrativos e serão substituídos por benchmarks reais na V2.

## Plataforma

web (desktop e celular; o celular é relevante porque a compra muitas vezes acontece nele).

## Marca

Nome: **GarimpoPC**. Metáfora: garimpo/ouro. Tom: direto, confiável, levemente
descontraído ("a galera", "garimpar"), nunca infantil.
