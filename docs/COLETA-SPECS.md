# Coleta de specs (V2, pacote A)

O Montador de PC só usa peças que têm **especificação técnica** (spec): índice de
desempenho, socket, tipo de memória, watts etc. Uma peça sem spec é ignorada na
montagem. Este guia explica de onde as specs vêm e como completar o catálogo.

## De onde o app lê as specs

`src/services/specs.ts` → `getPartSpecs()`:

1. **Sem Supabase** (modo de demonstração) → usa `PART_SPECS`
   (`src/models/part-specs.ts`), os dados de demonstração da V1.
2. **Com Supabase** → lê da tabela `part_specs` (join com `products` para pegar
   `slug` e `category`). Erro na consulta ou tabela vazia devolve **`{}`** (e um
   aviso no log do servidor), nunca o mock: dado ilustrativo não pode virar fato
   sobre produtos reais (regra do `AGENTS.md`).
3. Linha do banco **inválida ou incompleta é ignorada** e contada no log
   (`N spec(s) de part_specs ignorada(s)…`, com o slug e o motivo das primeiras).
   Valem as mesmas regras do coletor (veja a tabela abaixo): categoria
   desconhecida, `perf` que não é número > 0, `aesthetics` fora de 0 a 100 ou
   campo obrigatório da categoria ausente.

## Preparar o banco

No SQL Editor do Supabase, nesta ordem:

1. `supabase/schema-builder.sql` — cria `part_specs` (e, em bancos antigos,
   acrescenta `capacity_gb`, `upscaling` e `source` com `add column if not exists`).
2. `supabase/seed-builder.sql` — grava as 20 peças de exemplo, todas marcadas
   como `source = 'ilustrativo (V1)'`. Atenção: rodar de novo **sobrescreve**
   essas 20 linhas.

## Rodar o coletor

Requer no `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
(chave de serviço, porque `part_specs` só tem política pública de leitura).

```bash
npm run collect:specs -- --dry-run   # mostra o que faria, sem gravar
npm run collect:specs                # grava no banco
```

(`npm run collect:specs` é o atalho de `node scripts/collect-specs.mjs`.)
Para testar outro JSON sem mexer no catálogo de verdade, use
`npm run collect:specs -- --dry-run --catalogo=/caminho/outro.json`.

O que ele faz:

1. Lista os produtos de `products` que **não** têm linha em `part_specs`.
2. Procura cada `slug` em `scripts/data/specs-catalogo.json`.
3. Valida a entrada (categoria conhecida e igual à do banco, `perf > 0`,
   `aesthetics` de 0 a 100, **os campos obrigatórios da categoria**,
   `socket`/`ramType`/`formFactor`/`upscaling` com valores conhecidos,
   `source` preenchido) e faz upsert das válidas.
4. Imprime as entradas inválidas e a lista de peças **sem spec no catálogo** —
   é essa lista que um humano precisa pesquisar e preencher.

Ele **não sobrescreve** peças que já têm spec no banco; só preenche lacunas.
Para corrigir uma spec existente, edite a linha no Supabase (ou apague-a e rode
o coletor de novo).

## Formato do JSON

`scripts/data/specs-catalogo.json`:

```json
{
  "_leia-me": "texto explicativo (ignorado pelo script)",
  "pecas": {
    "rtx-4060": {
      "category": "gpu",
      "perf": 100,
      "aesthetics": 50,
      "tdp": 115,
      "upscaling": ["DLSS", "FSR"],
      "source": "ilustrativo (V1)"
    }
  }
}
```

A chave é o `slug` do produto (o mesmo da URL, ex.: `/peca/rtx-4060`). Os
campos usam os nomes de `PartSpec` (`src/models/builder-types.ts`):

| Campo | Obrigatório | Categorias | Valores / observação |
|---|---|---|---|
| `category` | sim | todas | `gpu`, `cpu`, `motherboard`, `ram`, `ssd`, `psu`, `case` — tem que bater com o banco |
| `perf` | sim | todas | índice relativo **na categoria** (GPU: RTX 4060 = 100; CPU: Ryzen 5 7600 = 100; placa-mãe: B650M = 100; RAM: 16 GB 5600 = 100; SSD: 1 TB Gen3 = 100; fonte: 650 W Bronze = 100) |
| `aesthetics` | sim | todas | 0 a 100 (vidro, ARGB, branco…) |
| `source` | sim | todas | de onde veio o número; `"ilustrativo"` quando for estimativa |
| `tdp` | **sim** em gpu e cpu | gpu, cpu | watts, inteiro > 0 |
| `socket` | **sim** em cpu e motherboard | cpu, motherboard | `AM4`, `AM5`, `LGA1700` |
| `ramType` | **sim** em motherboard e ram | motherboard, ram | `DDR4`, `DDR5` |
| `formFactor` | **sim** em motherboard | motherboard | `ATX`, `mATX`, `ITX` |
| `caseSupports` | **sim** em case | case | lista (não vazia) de form factors aceitos |
| `wattage` | **sim** em psu | psu | potência nominal em watts, inteiro > 0 |
| `capacityGb` | não | ram, ssd | GB, inteiro (SSD de 1 TB = `1000`) |
| `upscaling` | não | gpu | lista com `DLSS`, `FSR`, `XeSS` |

Resumo dos campos obrigatórios por categoria (além de `category`, `perf`,
`aesthetics` e `source`): gpu → `tdp`; cpu → `tdp` e `socket`; motherboard →
`socket`, `ramType` e `formFactor`; ram → `ramType`; case → `caseSupports`;
psu → `wattage`; ssd → nenhum. Sem eles a checagem de compatibilidade pularia a
regra em silêncio e o Montador poderia juntar peças que não encaixam. A mesma
lista vive em três lugares (mude os três juntos): `validar` em
`scripts/collect-specs.mjs`, `camposFaltando` em `src/services/specs.ts` e
`hasRequiredSpec` em `src/services/builder/compatibility.ts`.

## Adicionar uma peça

1. Confirme o `slug` e a `category` do produto no banco (tabela `products`).
2. Pesquise os dados do fabricante (socket, DDR, TDP, watts, capacidade).
3. Estime `perf` comparando com a peça de referência da categoria, usando
   benchmarks agregados de reviews públicos.
4. Adicione a entrada em `pecas`, com `source` **honesto**, por exemplo
   `"fabricante (AMD.com, nov/2026) + perf ilustrativo"`. Nunca marque como
   medido um número que foi estimado.
5. Rode `npm run collect:specs -- --dry-run`, confira, e rode sem `--dry-run`.
6. Se a peça também deve existir no modo de demonstração, copie-a para
   `src/models/part-specs.ts`.
