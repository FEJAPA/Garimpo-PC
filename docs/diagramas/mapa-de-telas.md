# Mapa de telas

Todas as rotas do GarimpoPC e como a pessoa navega entre elas. As rotas são as pastas de
`src/app/` (Next.js, App Router). Além das 6 páginas, existe 1 rota de API que **não é
navegada por pessoas**: `/api/check-alerts`, chamada por um agendador para mandar os e-mails
de alerta.

> **Legenda**: caixas amarelas = páginas, azul = job de fundo (sem tela), cinza claro = fora
> do GarimpoPC, **cinza tracejado = V2 (ainda não existe)**. O texto sobre cada seta diz qual
> elemento da tela leva até o destino.

## 1. Navegação entre as telas

```mermaid
flowchart LR
    classDef pagina fill:#fff4d6,stroke:#9a6b00,color:#2b2200
    classDef job fill:#e3ecff,stroke:#2f4fbf,color:#0f1d4d
    classDef externo fill:#eceff1,stroke:#607d8b,color:#263238
    classDef erro fill:#ffe3e6,stroke:#b3261e,color:#4a0d12
    classDef global fill:#f3ecff,stroke:#6a4bc4,color:#22124d
    classDef v2 fill:#eeeeee,stroke:#777777,stroke-dasharray:5 5,color:#444444

    subgraph GLOBAL["Em todas as telas - layout.tsx"]
        HDR["Cabeçalho<br/>logo, Peças, Montar PC,<br/>busca, Entrar ou Minha conta"]:::global
        FTR["Rodapé<br/>Peças, Montar PC, Minha conta"]:::global
    end

    subgraph PUBLICAS["Telas públicas - sem login"]
        HOME["/<br/>Home"]:::pagina
        BUSCA["/busca<br/>Resultados da busca"]:::pagina
        PECA["/peca/slug<br/>Detalhe da peça"]:::pagina
        MONTAR["/montar<br/>Montador de PC"]:::pagina
    end

    subgraph CONTA_GRP["Conta - login opcional"]
        ENTRAR["/entrar<br/>Entrar ou criar conta"]:::pagina
        CONTA["/conta<br/>Minha conta e alertas"]:::pagina
    end

    subgraph FUNDO["Fora do navegador"]
        AGENDADOR["Agendador externo<br/>cron"]:::externo
        API["/api/check-alerts<br/>job de alertas"]:::job
        EMAIL["E-mail de alerta<br/>enviado pelo Resend"]:::externo
    end

    LOJA["Site da loja<br/>nova aba"]:::externo
    N404["Página 404<br/>peça não encontrada"]:::erro

    HDR -->|"logo"| HOME
    HDR -->|"Peças ou caixa de busca"| BUSCA
    HDR -->|"Montar PC"| MONTAR
    HDR -->|"Entrar, sem login"| ENTRAR
    HDR -->|"Minha conta, com login"| CONTA
    FTR -->|"links do rodapé"| BUSCA
    FTR --> MONTAR
    FTR --> CONTA

    HOME -->|"Montar meu PC"| MONTAR
    HOME -->|"formulário Quanto você pode gastar<br/>leva alvo e teto na URL"| MONTAR
    HOME -->|"Comparar peças, Ver todas<br/>e chips de categoria"| BUSCA
    HOME -->|"cartão de Mais procuradas"| PECA

    BUSCA -->|"cartão da peça"| PECA
    BUSCA -->|"chips de categoria ou<br/>link todas as peças"| BUSCA

    PECA -->|"Todas as peças"| BUSCA
    PECA -->|"Ver na loja"| LOJA
    PECA -->|"slug que não existe"| N404
    PECA -->|"alerta sem login"| ENTRAR

    MONTAR -->|"nome da peça"| PECA
    MONTAR -->|"Ver na loja"| LOJA

    ENTRAR -->|"Entrar com sucesso"| CONTA
    ENTRAR -->|"erro ou Conta criada<br/>volta com mensagem na URL"| ENTRAR
    ENTRAR -->|"Voltar"| HOME

    CONTA -->|"sem login, redireciona"| ENTRAR
    CONTA -->|"Sair"| HOME
    CONTA -->|"nome do alerta"| PECA
    CONTA -->|"Ver peças, sem alertas"| BUSCA

    AGENDADOR -->|"GET com token secreto"| API
    API -->|"preço atingiu o alvo"| EMAIL
    EMAIL -->|"botão Ver oferta"| PECA

    COMPART["V2 pacote F<br/>/montar com código do link<br/>remonta a tela compartilhada"]:::v2
    SALVAS["V2 pacote G<br/>Minhas montagens salvas<br/>dentro de /conta"]:::v2
    COMPART -.-> MONTAR
    CONTA -.-> SALVAS
```

## 2. O que cada tela mostra

| Rota | Para que serve | O que aparece | De onde vêm os dados | Estados especiais |
|---|---|---|---|---|
| `/` | Convencer a montar ou comparar | Promessa, formulário "Quanto você pode gastar?", 3 passos, "Mais procuradas" (6 peças), diferenciais | `getPopularProducts` em `popularity.ts` | Faixa "Modo de demonstração"; "Nenhuma peça cadastrada ainda" |
| `/busca` | Achar peças por nome, marca ou categoria (`?q=termo`) | Contagem, chips de categoria, grade de cartões com menor preço Pix e selo da loja | `searchProducts` em `products.ts` | Faixa de demonstração; "Nenhuma peça encontrada" com sugestão de termos |
| `/peca/[slug]` | Comparar lojas e ver o histórico | Melhor preço agora, botão de alerta, lojas do menor ao maior preço Pix (com parcelado e "Ver na loja"), gráfico de histórico | `getProductBySlug`, `getPriceHistory`; registra a visita com `registerView` | Slug inexistente vira 404; "Indisponível" por oferta; "Ainda não há histórico de preços" |
| `/montar` | Montar o PC dentro do orçamento (`?alvo=` e `?teto=` opcionais) | Painel de entradas, resultado (total, peças, desempenho, pagamento) | `getProducts`; a montagem roda no navegador (`autoBuild`) | Vazio, Carregando, Erro, Sucesso, "Catálogo vazio"; ver `jornada-usuario.md` |
| `/entrar` | Entrar ou criar conta (opcional) | E-mail, senha, botões Entrar e Criar conta | Ações `login` e `signup` em `src/app/auth/actions.ts` | `?erro=` (caixa vermelha), `?mensagem=` (caixa verde), aviso de login não configurado |
| `/conta` | Ver e remover alertas de preço | E-mail da pessoa, lista de alertas ativos (peça e preço-alvo), botão Sair | Tabela `price_alerts` com a sessão da pessoa | Sem login redireciona para `/entrar`; "Você ainda não tem alertas" |
| `/api/check-alerts` | Avisar por e-mail quando o preço cair | Nenhuma tela: devolve JSON `verificados` e `emails_enviados` | Tabelas `price_alerts`, `products`, `offers` (chave de serviço) | 401 sem o token; 500 sem a chave de serviço |

## 3. Ações de servidor (não são páginas)

São funções que rodam no servidor quando a pessoa envia um formulário. Não têm endereço
próprio e por isso não aparecem no mapa.

| Função | Arquivo | Chamada por | O que faz |
|---|---|---|---|
| `login` | `src/app/auth/actions.ts` | `/entrar` | Autentica; sucesso vai para `/conta`, erro volta a `/entrar?erro=` |
| `signup` | `src/app/auth/actions.ts` | `/entrar` | Cria a conta; volta a `/entrar?mensagem=` |
| `logout` | `src/app/auth/actions.ts` | `/conta` | Encerra a sessão e vai para `/` |
| `createAlert` | `src/app/account/actions.ts` | `PriceAlertButton` em `/peca/[slug]` | Grava em `price_alerts` (exige login) |
| `deleteAlert` | `src/app/account/actions.ts` | `/conta` | Remove um alerta da própria pessoa |

## 4. Peças que atravessam todas as telas

- **`src/app/layout.tsx`** monta o cabeçalho (`SiteHeader`), o rodapé (`SiteFooter`) e as
  fontes. O cabeçalho pergunta quem está logada (`getCurrentUser`) para trocar "Entrar" por
  "Minha conta".
- **`src/proxy.ts`** (o antigo "middleware" do Next.js 16) roda antes de cada requisição, exceto
  arquivos estáticos e imagens, só para renovar o cookie de sessão do Supabase. Sem Supabase
  configurado, ele não faz nada.
- **Modo de demonstração**: sem as chaves do Supabase, `/`, `/busca`, `/peca/[slug]` e `/montar`
  usam o catálogo de exemplo (`src/models/mock-data.ts`) e mostram uma faixa avisando.
