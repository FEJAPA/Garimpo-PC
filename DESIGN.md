# DESIGN.md — Sistema visual do GarimpoPC

Mundo visual escolhido na reformulação de nov/2026: **"Bancada de garimpo"** — escuro,
grafite morno, com um único acento **ouro**. Substitui o tema anterior (azul-marinho com
neon roxo/ciano, texto em gradiente, emojis como ícones), que fica apenas como
anti-referência.

Por que escuro: a cena de uso é alguém na mesa, à noite, comparando preços e montando um
PC; escuro é o padrão do público e dá descanso ao olho. Por que ouro: é a metáfora da
marca (garimpar = achar ouro) e dá um acento quente, distinto do neon genérico "gamer".

## Modo por superfície

- `/` (home): **Persuade** — convencer a montar/comparar.
- `/montar`, `/busca`, `/peca/*`, `/conta`: **Operate** — a pessoa está numa tarefa.
  Familiaridade, densidade controlada, consistência.

## Tokens (Tailwind 4, em `src/app/globals.css`)

Cores (tema escuro único):

| Token | Valor | Uso |
|---|---|---|
| `base` | `#0e0f12` | fundo da página |
| `surface` | `#15171c` | cartões, painéis |
| `surface-2` | `#1c1f26` | superfícies elevadas, campos |
| `surface-3` | `#242832` | hover de superfícies |
| `line` | `#2b2f3a` | bordas (hairline) |
| `line-strong` | `#6b7180` | bordas de controles, trilho do slider e interruptor desligado (≥ 3:1 sobre as superfícies, WCAG 1.4.11) |
| `ink` | `#f2efe6` | texto principal (branco quente) |
| `ink-muted` | `#aeb0b8` | texto secundário (≥ 7:1 em surface) |
| `ink-faint` | `#8b8e99` | legendas (≥ 4.5:1 em surface) |
| `brand` | `#f0b43a` | ouro: ações primárias, seleção, destaque de preço |
| `brand-strong` | `#ffc85c` | hover do ouro |
| `brand-ink` | `#1c1505` | texto sobre ouro |
| `brand-soft` | `rgba(240,180,58,.12)` | fundos de destaque |
| `good` / `good-soft` | `#4fd08a` / `#0f2a1c` | preço bom, em estoque, confiável |
| `warn` / `warn-soft` | `#ff9f5a` / `#2d1d10` | atenção (sempre com ícone + texto) |
| `bad` / `bad-soft` | `#ff6b7a` / `#2d1216` | indisponível, pouco confiável, erro |

Gráficos (dataviz): série única/ênfase = `brand`; contexto (de-ênfase) = `#626877` (≥ 3:1 sobre `surface`);
grade = `line`, hairline sólida; texto de eixos = `ink-faint`. Nunca cor de série em texto.
Terceiro tom, **"relacionado"** (`#8b8e99`): só para "PCs parecidos com o seu" no gráfico de
desempenho; é um passo mais claro que o contexto, e a ênfase continua sendo uma só. Os hexadecimais
vivem num lugar só, `CHART_COLORS` (`src/lib/chart-colors.ts`: `enfase`, `contexto`, `relacionado`,
`grade`, `eixo`…); gráficos novos importam de lá em vez de repetir cores.
Todo gráfico tem `role="img"` com um resumo em texto e a mesma informação em tabela
(visível ou num `<details>` "Ver como tabela").

Tipografia:

- **Display:** Sora (600/700), tracking `-0.02em`, para h1/h2 e o número-herói.
- **UI e corpo:** Inter (400/500/600). Preços em tabela usam `tabular-nums`; o preço em
  destaque (herói) usa figuras proporcionais.
- Escala fixa (rem): 12 · 13 · 14 · 16 · 18 · 22 · 28 · 36 · 48. Medida de prosa 65–75ch.

Forma e profundidade:

- Raio: 6px controles · 10px cartões · 999px pills.
- Sombra (só em elementos flutuantes): `0 1px 2px rgb(0 0 0/.45), 0 12px 28px -14px rgb(0 0 0/.7)`.
- Bordas 1px `line`. Sem borda lateral colorida grossa, sem vidro/blur decorativo, sem
  texto em gradiente.

Ícones: `lucide-react`, traço 1.75, tamanhos 16/18/20. Emojis não são ícones.

Movimento: 160ms ease-out em estados. Um momento autoral: o resultado da montagem surge
com fade + subida de 8px em 240ms (`.reveal`). `prefers-reduced-motion` desliga.

Estados obrigatórios em todo controle: default, hover, focus-visible (anel `brand` 2px),
active, disabled, loading, erro. Listas têm estado vazio que ensina o próximo passo.

Superfícies do navegador: seleção de texto, caret, scrollbar e anel de foco usam a paleta.

Acessibilidade de página: o primeiro item da tabulação é o link "Pular para o conteúdo"
(`href="#conteudo"`, fica fora da tela e aparece como botão `brand` no foco); o conteúdo de cada
página fica em `<main id="conteudo">`. Cada página tem `<title>` próprio (o layout acrescenta
" · GarimpoPC"). A navegação marca a página atual com `aria-current="page"`. O cabeçalho
fixo tem fundo sólido (`base`), sem transparência nem blur.

Confiança de loja (uma régua só, `storeTrust`): o selo e o rótulo da loja são **Confiável** (`good`),
**Não verificada** (`warn`) e **Bloqueada** (`bad`). A nota (estrelas) aparece como número ao
lado, mas não decide o tom. Oferta "boa demais" ganha `Callout` de atenção; loja bloqueada não
tem botão "Ver na loja".

## Componentes base (`src/components/ui/`)

`Button` (primary/secondary/ghost/danger; sm/md/lg), `Card`, `Badge` (neutral/good/warn/
bad/brand), `Field` + `NumberInput` (prefixo "R$"), `Toggle` (switch com rótulo),
`Slider` (com rótulos nas pontas), `Callout` (info/warn/bad, com ícone), `SectionTitle`.

## Voz

Botões nomeiam a ação ("Montar meu PC", "Ver na loja"). Erros dizem o problema e a saída
("Orçamento insuficiente: a montagem mais barata custa R$ 4.699. Suba o teto ou
desative o filtro de lojas."). Nada de "Ops!".
