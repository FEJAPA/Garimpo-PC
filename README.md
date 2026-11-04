# GarimpoPC ⛏️

[![CI](https://github.com/FEJAPA/Garimpo-PC/actions/workflows/ci.yml/badge.svg)](https://github.com/FEJAPA/Garimpo-PC/actions/workflows/ci.yml)

Comparador de preços de **hardware gamer no Brasil** com **Montador de PC automático**:
você diz quanto pode gastar e o site monta um computador completo com peças compatíveis,
de lojas confiáveis, mostra o desempenho esperado e como pagar (Pix, parcelado ou os dois).

> Projeto em desenvolvimento. A V2 do Montador está no ar (dados de exemplo quando o banco não
> está configurado). O plano está em `docs/superpowers/plans/2026-11-04-montador-de-pc-v2.md` e o
> que ficou para depois está em [`docs/PENDENCIAS-POS-V2.md`](docs/PENDENCIAS-POS-V2.md).

## O que o site faz

- 🔎 **Busca** por peça, marca ou categoria (placa de vídeo, processador, memória, SSD etc.)
- 📈 **Histórico de preços** em gráfico, para ver se a promoção é real
- ⚖️ **Comparação entre lojas** (Pix e parcelado) com **selo de confiança** e o motivo dele
- 🚩 **Aviso de "preço bom demais"**: oferta muito abaixo das lojas confiáveis costuma ser golpe,
  e o site nunca a recomenda sem avisar
- 🛠️ **Montar PC** (`/montar`): quanto você quer gastar e o máximo (com folga), para que vai usar
  (jogos, trabalho ou criação), resolução do monitor, "só lojas confiáveis" e o balanço
  Desempenho ↔ Estética. Mostra o desempenho esperado comparado com 12 PCs de referência e o plano
  de pagamento: Pix, parcelado ou misturar
- 🔗 **Compartilhar e guardar**: link da montagem, lista de compras em CSV e, com login, montagens
  salvas na sua conta
- 🔔 **Alertas por e-mail** quando o preço de uma peça, ou o total de uma montagem salva, cair
  até o valor que você escolher (login opcional)
- 📐 **Metodologia** (`/metodologia`): de onde vêm o Índice GarimpoPC e os FPS estimados
- 🤖 **Coleta automática** de preços (um robô lê as lojas todo dia)

## Como o Montador funciona (resumo)

1. Você informa **quanto quer gastar** (alvo, ex.: R$ 6.000) e **o máximo** (teto, ex.:
   R$ 7.000). A diferença é a **folga**, usada só se destravar uma peça bem melhor.
   O total **nunca** passa do teto.
2. Escolhe **para que vai usar** (jogos, trabalho ou criação), **só lojas confiáveis** e o
   balanço **Desempenho ↔ Estética**. Loja confiável é a oficial, com nota 4,5 ou mais, sem nota
   baixa no Reclame Aqui (abaixo de 6) e nunca bloqueada por denúncias.
3. O site descobre a montagem compatível mais barata possível. Se nem ela cabe no teto, ele diz
   quanto ela custa.
4. Depois divide o valor que você quer gastar em fatias por peça e escolhe, em cada uma, a melhor
   que cabe. Processador e placa-mãe são escolhidos juntos, e tudo precisa combinar (socket, tipo de
   memória, tamanho do gabinete e potência da fonte).
5. Se passou do teto, troca a peça mais cara pela melhor opção mais barata que faz caber. Se sobrou
   dinheiro ou folga, melhora uma peça, mas só quando o ganho é de 10% ou mais: em jogos, primeiro a
   placa de vídeo; em criação, primeiro o processador; em trabalho, só o processador.
6. Mostra o **Índice GarimpoPC** da montagem, o PC de referência equivalente, "PCs parecidos com o
   seu", um gráfico, FPS estimado por tipo de jogo e quanto custa no Pix ou no cartão, loja por loja.
   No parcelado, vale o preço a prazo que a loja anuncia, e juros só aparecem acima disso.

Especificação completa: `docs/superpowers/specs/2026-11-04-montador-de-pc-design.md`.
Diagramas (jornada, mapa de telas, algoritmo do Montador, pagamento, arquitetura e fluxo de dados):
[docs/diagramas/README.md](docs/diagramas/README.md).
Os índices de desempenho e os PCs de referência são **estimativas** (nada foi medido pela
GarimpoPC): ver `docs/METODOLOGIA-DESEMPENHO.md` e a página `/metodologia`.

## Telas e rotas

| Endereço | O que é |
|---|---|
| `/` | Página inicial: "Quanto você pode gastar?", peças mais procuradas |
| `/busca` | Busca e lista de peças (`?q=termo`) |
| `/peca/[slug]` | Uma peça: lojas lado a lado, motivos de confiança, histórico e alerta de preço |
| `/montar` | Montador de PC (aceita `?alvo=`, `?teto=` e o link `?b=`) |
| `/metodologia` | Como estimamos o desempenho |
| `/entrar` | Entrar ou criar conta (depois de entrar, você volta para a página de onde veio) |
| `/conta` | Minhas montagens e meus alertas de preço |
| `/api/check-alerts` | Job de alertas (não é uma tela; ver "Alertas por e-mail") |

## Tecnologias

- **Next.js 16** (React 19) + **TypeScript** + **Tailwind CSS 4**: o site
- **Supabase** (PostgreSQL + login): banco de dados e contas, com modo de demonstração sem banco
- **Recharts**: gráficos · **lucide-react**: ícones · **Resend**: e-mails · **Playwright**: coleta
- **Vitest**: testes da lógica · **Playwright Test**: testes ponta a ponta (`tests/e2e/`)

## Organização do código

- `src/models/` — tipos, conexão com o banco, categorias e dados de exemplo (peças, specs, PCs de
  referência e juros)
- `src/services/` — produtos e busca, popularidade, e-mail, specs, referências, juros, montagens
  salvas e **`builder/`** (orçamento, lojas confiáveis, preço suspeito, pontuação, compatibilidade,
  montagem automática, desempenho, pagamentos, mistura Pix + cartão e cupons), todos com testes
- `src/app/` — as telas da tabela acima, as ações de servidor (`auth/`, `account/`) e o job
  `/api/check-alerts`
- `src/components/ui/` — design system (Button, Card, Badge, Callout, Field, Toggle, Slider,
  SegmentedControl, Skeleton…)
- `src/components/builder/` — componentes do Montador (formulário, resultado, peças, desempenho,
  pagamento e salvar)
- `src/lib/` — dinheiro (`parseMoney`), formatação, link de compartilhamento e CSV, cores dos gráficos
- `scripts/` — coleta de preços, coleta de specs e diagnóstico de seletores · `supabase/` — SQL
- `docs/` — spec, plano, pendências, metodologia, coleta de specs e **diagramas** (`docs/diagramas/`)
- `tests/e2e/` — testes ponta a ponta · `.github/workflows/` — CI, coleta agendada e alertas
- `PRODUCT.md` e `DESIGN.md` — verdade do produto e sistema visual · `AGENTS.md` — regras para agentes

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # opcional: chaves do Supabase (sem elas, modo de demonstração)
npm run dev                  # abre em http://localhost:3000
```

Sem as chaves do Supabase, o site mostra uma faixa "Modo de demonstração": peças, preços, lojas,
reputação, juros e índices são de exemplo, e salvar montagens e alertas ficam desligados.

Checagens:

```bash
npm run typecheck   # gera tipos de rota + tsc
npm run lint
npm test            # testes da lógica (Vitest)
npm run test:e2e    # ponta a ponta (Playwright; sobe o site na porta 3100)
npm run build
```

## Banco de dados

Rode os scripts da pasta `supabase/` no SQL Editor do Supabase, **nesta ordem**:

1. `schema.sql` → 2. `seed.sql` → 3. `schema-auth.sql` → 4. `schema-popularity.sql` →
5. `seed-extras.sql` → 6. `schema-stores.sql` → 7. `seed-stores.sql` → 8. `schema-builder.sql` →
9. `schema-alerts.sql` → 10. `seed-builder.sql` → 11. `seed-references.sql` →
12. `schema-payments.sql` → 13. `seed-payments.sql`

Os scripts de schema podem ser rodados de novo sem estragar o que já existe. Os seeds `seed-stores.sql`,
`seed-payments.sql`, `seed-builder.sql` e `seed-references.sql` têm valores **só para demonstração**
(Reclame Aqui, juros, specs e índices): não rode em um banco com dados reais. Com banco
configurado, o site **nunca** usa os dados de exemplo do código: se uma tabela estiver vazia, a tela
avisa (por exemplo, "Sem especificações cadastradas").

## Coleta de preços

```bash
npm run collect:dry   # testa sem gravar
npm run collect       # coleta de verdade (requer SUPABASE_SERVICE_ROLE_KEY)
npm run collect:specs # preenche especificações faltantes (ver docs/COLETA-SPECS.md)
node scripts/inspect-store.mjs "URL_DO_PRODUTO"   # ajuda a achar o preço no HTML de uma loja
```

A coleta roda todo dia às 06:00 UTC no GitHub Actions (`.github/workflows/coleta.yml`). Quando
mais de 30% das ofertas de uma loja falham, o robô abre uma issue "Seletor quebrado". Cadastre os
segredos `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no GitHub (Settings → Secrets →
Actions) para ela funcionar.

## Alertas por e-mail

O job `/api/check-alerts` confere os alertas e manda os e-mails. **Nada dentro do site chama esse
job sozinho**: ele precisa de um agendamento externo. Há duas formas:

- o workflow **`.github/workflows/alertas.yml`** do GitHub Actions, que chama o job de hora em hora
  com `GET $SITE_URL/api/check-alerts` e o cabeçalho `Authorization: Bearer $CRON_SECRET`. Cadastre
  no GitHub (Settings → Secrets → Actions) os segredos **`SITE_URL`** (o endereço público do site,
  ex.: `https://garimpopc.com.br`) e **`CRON_SECRET`** (o mesmo valor configurado no servidor);
- ou um cron do seu provedor de hospedagem, chamando o mesmo endereço com o mesmo cabeçalho.

No servidor (produção), configure estas variáveis de ambiente:

| Variável | Para quê |
|---|---|
| `CRON_SECRET` | Senha do job. **Sem ela, a rota responde 503**; com token errado, 401 |
| `RESEND_API_KEY` e `EMAIL_FROM` | Envio dos e-mails pelo Resend. Em produção, **sem `RESEND_API_KEY` a rota responde 503**, de propósito: o agendamento fica vermelho em vez de "avisar" sem mandar e-mail |
| `NEXT_PUBLIC_SITE_URL` | Endereço do site usado nos links dos e-mails |
| `SUPABASE_SERVICE_ROLE_KEY` | Leitura dos alertas e das montagens (sem ela, 503) |

Fora de produção, sem `RESEND_API_KEY` o envio é só simulado no console e o alerta **não** é marcado
como avisado. Quando o e-mail sai de verdade, o alerta é desligado e a página `/conta` mostra
"avisado em DD/MM" com o botão "Reativar". Para testar à mão:

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" http://localhost:3000/api/check-alerts
```

## Documentação

- [`docs/superpowers/specs/2026-11-04-montador-de-pc-design.md`](docs/superpowers/specs/2026-11-04-montador-de-pc-design.md) — como o Montador funciona
- [`docs/diagramas/README.md`](docs/diagramas/README.md) — desenhos do produto e do código
- [`docs/PENDENCIAS-POS-V2.md`](docs/PENDENCIAS-POS-V2.md) — o que ficou para depois da V2
- [`docs/METODOLOGIA-DESEMPENHO.md`](docs/METODOLOGIA-DESEMPENHO.md) — como estimamos o desempenho
- [`docs/COLETA-SPECS.md`](docs/COLETA-SPECS.md) — como preencher as especificações das peças
- [`docs/superpowers/plans/2026-11-04-montador-de-pc-v2.md`](docs/superpowers/plans/2026-11-04-montador-de-pc-v2.md) — plano da V2
