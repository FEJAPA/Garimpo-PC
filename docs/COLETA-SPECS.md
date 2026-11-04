# Coleta de specs (V2, pacote A)

O Montador de PC só usa peças que têm **especificação técnica** (spec): índice de
desempenho, socket, tipo de memória, watts etc. Uma peça sem spec é ignorada na
montagem. Este guia explica de onde as specs vêm e como completar o catálogo.

## De onde o app lê as specs

`src/services/specs.ts` → `getPartSpecs()`:

1. Supabase configurado **e** tabela `part_specs` com linhas → lê do banco
   (join com `products` para pegar `slug` e `category`).
2. Sem Supabase, erro na consulta ou tabela vazia → usa `PART_SPECS`
   (`src/models/part-specs.ts`), os dados de demonstração da V1.

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
node scripts/collect-specs.mjs --dry-run   # mostra o que faria, sem gravar
node scripts/collect-specs.mjs             # grava no banco
```

<!-- TODO(V2-A): quando o script entrar no package.json, trocar por `npm run collect:specs`. -->

O que ele faz:

1. Lista os produtos de `products` que **não** têm linha em `part_specs`.
2. Procura cada `slug` em `scripts/data/specs-catalogo.json`.
3. Valida a entrada (categoria igual à do banco, `perf > 0`, `aesthetics` de 0 a
   100, `socket`/`ramType`/`formFactor`/`upscaling` com valores conhecidos,
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
| `tdp` | não | gpu, cpu | watts, inteiro |
| `socket` | não | cpu, motherboard | `AM4`, `AM5`, `LGA1700` |
| `ramType` | não | motherboard, ram | `DDR4`, `DDR5` |
| `formFactor` | não | motherboard | `ATX`, `mATX`, `ITX` |
| `caseSupports` | não | case | lista de form factors aceitos |
| `wattage` | não | psu | potência nominal em watts |
| `capacityGb` | não | ram, ssd | GB, inteiro (SSD de 1 TB = `1000`) |
| `upscaling` | não | gpu | lista com `DLSS`, `FSR`, `XeSS` |

## Adicionar uma peça

1. Confirme o `slug` e a `category` do produto no banco (tabela `products`).
2. Pesquise os dados do fabricante (socket, DDR, TDP, watts, capacidade).
3. Estime `perf` comparando com a peça de referência da categoria, usando
   benchmarks agregados de reviews públicos.
4. Adicione a entrada em `pecas`, com `source` **honesto**, por exemplo
   `"fabricante (AMD.com, nov/2026) + perf ilustrativo"`. Nunca marque como
   medido um número que foi estimado.
5. Rode `node scripts/collect-specs.mjs --dry-run`, confira, e rode sem `--dry-run`.
6. Se a peça também deve existir no modo de demonstração, copie-a para
   `src/models/part-specs.ts`.
