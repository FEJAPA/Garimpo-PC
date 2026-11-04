# GarimpoPC ⛏️

[![CI](https://github.com/FEJAPA/Garimpo-PC/actions/workflows/ci.yml/badge.svg)](https://github.com/FEJAPA/Garimpo-PC/actions/workflows/ci.yml)

Comparador de preços de **hardware gamer no Brasil** com **Montador de PC automático**:
você diz quanto pode gastar e o site monta um computador completo com peças compatíveis,
de lojas confiáveis, mostra o desempenho esperado e como pagar (Pix ou parcelado).

> Projeto em desenvolvimento. V1 = scaffold funcional com dados de exemplo.
> O plano da V2 (para o *agent army*) está em `docs/superpowers/plans/2026-11-04-montador-de-pc-v2.md`.

## O que o site faz

- 🔎 **Busca** por peça, marca ou categoria (placa de vídeo, processador, RAM, SSD, etc.)
- 📈 **Histórico de preços** em gráfico — mostra se a promoção é real
- ⚖️ **Comparação entre lojas** (preço Pix vs. parcelado) com **selo de confiança**
- 🔔 **Alertas de preço** por e-mail (login opcional)
- 🛠️ **Montar PC** (`/montar`): orçamento alvo + teto (com folga), toggle “só lojas
  confiáveis”, slider Desempenho ↔ Estética, estimativa de desempenho com gráfico de
  computadores comparáveis e plano de pagamento Pix × parcelado
- 🤖 **Coleta automática** de preços (robô que lê as lojas)

## Como o Montador funciona (resumo)

1. Você informa **quanto quer gastar** (alvo, ex.: R$ 6.000) e **o máximo** (teto, ex.:
   R$ 7.000). A diferença é a **folga**, usada só se destravar uma peça bem melhor.
   O total **nunca** passa do teto.
2. Escolhe **só lojas confiáveis** (oficial + nota ≥ 4,5) e o balanço
   **Desempenho ↔ Estética**.
3. O algoritmo divide o alvo em fatias por categoria, escolhe a melhor peça que cabe e
   combina com as outras (socket, DDR, fonte, gabinete), e depois tenta subir a placa de
   vídeo/processador com sobras e folga quando o ganho é ≥ 10%.
4. Mostra o **Índice GarimpoPC** da montagem, o PC de referência equivalente, um gráfico
   de comparáveis, FPS estimado por tipo de jogo e o plano de pagamento por loja.

Especificação completa: `docs/superpowers/specs/2026-11-04-montador-de-pc-design.md`.
Os índices de desempenho e os PCs de referência da V1 são **ilustrativos** (ver `TODO(V2-…)` no código).

## Tecnologias

- **Next.js 16** (React 19) + **TypeScript** + **Tailwind CSS 4** — site
- **Supabase** (PostgreSQL + Auth) — banco de dados e login (com modo de demonstração sem banco)
- **Recharts** — gráficos · **lucide-react** — ícones · **Resend** — e-mails · **Playwright** — coleta
- **Vitest** — testes da lógica do Montador · **Playwright Test** — testes ponta a ponta (`tests/e2e/`)

## Organização do código

- `src/models/` — tipos, conexão com o banco, categorias, **specs das peças**, **PCs de referência**, dados mock
- `src/services/` — produtos/busca, popularidade, e-mail, **`builder/`** (orçamento, lojas confiáveis,
  pontuação, compatibilidade, montagem automática, desempenho, pagamentos — todos com testes)
- `src/app/` — telas (`/`, `/busca`, `/peca/[slug]`, **`/montar`**, `/entrar`, `/conta`)
- `src/components/ui/` — design system (Button, Card, Badge, Callout, Field, Toggle, Slider…)
- `src/components/builder/` — componentes do Montador
- `scripts/` — coleta de preços e de specs · `supabase/` — SQL · `docs/` — spec, planos e **diagramas** (`docs/diagramas/`)
- `tests/e2e/` — testes ponta a ponta · `.github/workflows/` — CI e coleta agendada
- `PRODUCT.md` e `DESIGN.md` — verdade do produto e sistema visual

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # opcional: chaves do Supabase (sem elas, modo de demonstração)
npm run dev                  # abre em http://localhost:3000
```

Checagens:

```bash
npm run typecheck   # gera tipos de rota + tsc
npm run lint
npm test            # testes do Montador (Vitest)
npm run test:e2e    # ponta a ponta (Playwright; sobe o site na porta 3100)
npm run build
```

## Banco de dados

Rode os scripts da pasta `supabase/` no SQL Editor do Supabase, nesta ordem:
`schema.sql` → `seed.sql` → `schema-auth.sql` → `schema-popularity.sql` → `seed-extras.sql`
→ `schema-stores.sql` → `seed-stores.sql` → `schema-builder.sql` → `seed-builder.sql`
→ `seed-references.sql` → `schema-payments.sql` → `seed-payments.sql`.

No GitHub, cadastre os segredos `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
(Settings → Secrets → Actions) para a coleta agendada funcionar.

## Coleta de preços

```bash
npm run collect:dry   # testa sem gravar
npm run collect       # coleta de verdade (requer SUPABASE_SERVICE_ROLE_KEY)
npm run collect:specs # preenche especificações faltantes (ver docs/COLETA-SPECS.md)
```

A coleta roda todo dia no GitHub Actions (`.github/workflows/coleta.yml`); quando mais de
30% das ofertas de uma loja falham, o robô abre uma issue "Seletor quebrado".
