# GarimpoPC ⛏️

Comparador de preços de **hardware gamer no Brasil**, com histórico de preços, lojas
confiáveis (anti-golpe) e alertas de queda de preço.

> Projeto em desenvolvimento. Documento de premissas em `../projeto-comparador-hardware.md`.

## O que o site faz

- 🔎 **Busca** por peça, marca ou categoria (placa de vídeo, processador, RAM, SSD, etc.)
- 📈 **Histórico de preços** em gráfico — mostra se a promoção é real
- ⚖️ **Comparação entre lojas** (preço PIX vs. parcelado)
- 🛡️ **Selo de confiança** das lojas (reputação, oficial)
- 🔔 **Alertas de preço** por e-mail (login opcional)
- 🔥 **Mais procuradas** (popularidade real + destaques)
- 🤖 **Coleta automática** de preços (robô que lê as lojas)

## Tecnologias

- **Next.js 16** (React 19) + **TypeScript** + **Tailwind CSS** — site
- **Supabase** (PostgreSQL + Auth) — banco de dados e login
- **Recharts** — gráficos · **Resend** — e-mails · **Playwright** — coleta

## Organização do código (estilo MVC)

- `src/models/` — dados: tipos, conexão com o banco (Supabase), categorias
- `src/services/` — lógica: produtos/busca, popularidade, e-mail
- `src/app/` + `src/components/` — telas e componentes (a "View")
- `src/app/auth/`, `src/app/account/` — ações de login e de conta
- `src/lib/` — utilidades (formatação)
- `scripts/` — coleta de preços (`npm run collect`)
- `supabase/` — scripts SQL do banco

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # e preencha com suas chaves do Supabase
npm run dev                  # abre em http://localhost:3000
```

## Banco de dados

Rode os scripts da pasta `supabase/` no SQL Editor do Supabase, nesta ordem:
`schema.sql` → `seed.sql` → `schema-auth.sql` → `schema-popularity.sql` → `seed-extras.sql`.

## Coleta de preços

```bash
npm run collect:dry   # testa sem gravar
npm run collect       # coleta de verdade (requer SUPABASE_SERVICE_ROLE_KEY)
```
