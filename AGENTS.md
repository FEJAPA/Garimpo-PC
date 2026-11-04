# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Guia para agentes (GarimpoPC)

Leia antes de mexer no código. Vale para humanos e para o *agent army* da V2.

## Comandos

```bash
npm install
npm run typecheck   # next typegen + tsc --noEmit (gera PageProps etc.)
npm run lint        # eslint (0 erros é o padrão)
npm test            # vitest (src/**/*.test.ts)
npm run build       # build de produção
npm run dev         # servidor local
```

## Onde as coisas estão

- Verdade do produto: `PRODUCT.md`. Sistema visual e tokens: `DESIGN.md` (tokens em `src/app/globals.css`).
- Spec do Montador: `docs/superpowers/specs/2026-11-04-montador-de-pc-design.md`.
- Plano V2 (pacotes A–H): `docs/superpowers/plans/2026-11-04-montador-de-pc-v2.md`.
- Lógica pura do Montador: `src/services/builder/*.ts` (cada arquivo tem um `*.test.ts`).
- Dados ilustrativos a substituir: `src/models/part-specs.ts`, `src/models/reference-builds.ts`.
- Marcadores `TODO(V2-<letra>)` no código apontam para o pacote do plano.

## Convenções

- Código, comentários, textos de tela e mensagens de commit em **português do Brasil**.
  Comentários explicam *por que*, em linguagem simples (o projeto é também didático).
- Camadas: `models/` (dados e tipos) → `services/` (lógica) → `app/` + `components/` (telas).
  Lógica de negócio **não** vai em componentes.
- UI: use os componentes de `src/components/ui/` e os tokens do `DESIGN.md`. Ícones só do
  `lucide-react` (sem emoji como ícone). Nada de texto em gradiente, borda lateral grossa ou vidro decorativo.
- Serviços novos ou alterados: teste primeiro (Vitest), depois implemente. O teste deve falhar antes.
- Invariantes do Montador que nenhum pacote pode quebrar: `total ≤ teto` sempre; com
  “só lojas confiáveis” nenhuma peça vem de loja não confiável; peças sempre compatíveis entre si.
- Moeda em reais com `formatBRL`. Datas ISO no banco.
- **Dado ilustrativo nunca vira fato no modo real.** Com Supabase configurado, um serviço com
  fallback devolve o mock SÓ quando o banco não está configurado; em erro ou tabela vazia devolve
  vazio/`null` e a tela avisa. Seeds com valores inventados (`seed-stores.sql`, `seed-payments.sql`,
  `seed-builder.sql`, `seed-references.sql`) são só para demonstração e dizem isso no cabeçalho.
- Oferta suspeita (≥ 25% abaixo da mediana das lojas confiáveis) ou de loja bloqueada nunca é
  recomendada em silêncio: o Montador prefere a não suspeita e, se usar, avisa; "melhor preço" e
  alertas seguem a mesma regra (`src/lib/format.ts`, `src/services/builder/trust.ts`).
- Identificadores que seguem convenção de framework ou de domínio técnico podem ficar em inglês
  (`login`, `signup`, `createAlert`, nomes de tabelas e colunas); textos de tela, comentários,
  mensagens e documentação ficam em pt-BR.
- Não editar arquivos gerados (`.next/`, `next-env.d.ts`).
- Branch de trabalho: nunca commitar direto na `main`.

## Antes de dar a tarefa por concluída

`npm run typecheck && npm run lint && npm test && npm run build` passando, e a tela
afetada aberta e conferida (desktop e largura de celular).
