# Playbook: como o agent army foi usado neste projeto (e como reaproveitar)

Registro do que funcionou de verdade em 04/11/2026, para copiar em outros projetos. Os
prompts no fim são os mesmos usados aqui, com os nomes trocados por marcadores `<…>`.

## 1. Quem fez o quê (papéis por modelo)

| Papel | Modelo / esforço | O que faz | O que NÃO faz |
|---|---|---|---|
| **Comandante** | o modelo da sessão (Fable aqui) | reconhece o repositório, decide arquitetura, escreve a fundação (tipos compartilhados), compõe as ondas com posse de arquivos, integra, verifica (tipos, lint, testes, build, e2e, capturas), commita | não delega o pensamento; não deixa agente commitar nem rodar build |
| **Pacotes-chave** | Opus / high | features com regra de negócio (algoritmo, tela principal, conta, pagamentos) | não edita arquivo de outro |
| **Pacotes pequenos** | Sonnet / xhigh | CI/e2e, diagramas, correções de área, avaliação de usabilidade | idem |
| **Porcos-trufeiros** | Haiku / max | inspeção SÓ-LEITURA do código inteiro por área (segurança, a11y, consistência, lógica, desempenho); relatório com arquivo:linha e severidade | nunca editam código |
| **Gerentes (2)** | Opus / high | depois de cada onda: um **tranquilo** (só o que afeta a pessoa e a estabilidade; triagem econômica) e um **rigoroso** (tudo, com build e e2e); checam conclusão-fantasma pelo diff | não corrigem; só avaliam |
| **Revisor independente** | o modelo mais forte / xhigh | revisa sem ler os vereditos dos gerentes; prova cada achado com cenário ou sonda | não corrige |
| **Rodada final** | Opus / xhigh | corrige os itens por ID, um grupo por conjunto de arquivos | não abre escopo novo |
| **Revisão final** | modelo mais forte / xhigh | veredito "pronto para mostrar? pronto para continuar?", triagem do que sobrou, lista pré-deploy | — |

Por que essa divisão: o Haiku é barato e lê muito, então serve para varrer; o Sonnet em
xhigh resolve bem tarefas com interface clara; o Opus fica onde há regra de dinheiro ou
algoritmo; o modelo mais forte revisa porque revisão é o gargalo de qualidade, não execução.

## 2. O ciclo

1. **Reconhecimento + fundação (Comandante).** Ler tudo, decidir, escrever os tipos/contratos
   que vários pacotes vão usar, commitar. Isso evita serializar a onda num "agente de fundação".
2. **Onda de execução.** Vários agentes em paralelo, cada um com posse EXCLUSIVA de arquivos e
   com as assinaturas que consome congeladas no brief. Quem precisa de algo de outro registra em
   "Flags for Commander" em vez de editar.
3. **Portão.** Dois gerentes com estilos opostos. O Comandante lê os dois, decide (não repassa
   a lista cegamente) e compõe a próxima onda com a tabela de conflitos de arquivo.
4. **Revisão independente + inspeção nova** em paralelo (são só-leitura, não conflitam).
5. **Rodada final** por dono de arquivo, com os itens por ID das três fontes. Mensagens no meio
   do voo ajustam interfaces entre grupos (ex.: "G1 adiciona a prop X; G2 passa X").
6. **Revisão final** e encerramento das pontas pequenas pelo próprio Comandante.

Verificação entre ondas, sempre pelo Comandante: `typecheck`, `lint`, testes, `build`, e2e
contra a build, capturas desktop e celular, e `git diff --stat` cruzado com os relatórios
(uma conclusão "COMPLETE" sem diff é fantasma).

## 3. Regras que foram para dentro de todo brief (e por quê)

- "Edite SOMENTE estes arquivos; outros agentes editam o resto AGORA, na mesma árvore." → zero
  conflitos de merge em 28 agentes.
- "NUNCA git que mude estado; nunca build/dev/start/install." → o Comandante é o único ponto de
  integração; a pasta `.next` não aguenta dois builds.
- "Teste ANTES do código, veja falhar." → os relatórios passaram a citar o teste que falhou.
- "Relatório final exatamente neste formato" (Files Modified / Itens / Flags / Issues /
  Verification / Status). → dá para cruzar com o diff em um minuto.
- "Se a suíte falhar em arquivo de outro pacote em edição, reporte e siga." → TDD de um grupo
  deixa o tsc vermelho por minutos; não é problema seu.
- Interfaces escritas no brief com assinatura exata (`autoBuild(products, specs, prefs, ctx?)`).

## 4. O que não funcionou e como contornei

- **Sub-agentes sem ferramenta Agent.** Neste ambiente a Camada 2 do skill não existe; todo
  agente de Camada 1 trabalhou sozinho e disse isso. Compensação: mais agentes diretos com posse
  de arquivos mais fina. Regra: nunca encolher o exército em silêncio; dizer o desvio.
- **Vitest em paralelo gera timeouts falsos.** Testes de tempo usam mediana de várias
  execuções com aquecimento; cada agente usa um subdiretório próprio no scratchpad.
- **Hook de parada pedindo commit** enquanto agentes editam: commits `wip(...)` de instantâneo
  e um commit limpo de integração ao fim de cada onda.
- **Servidor órfão** (`pkill` matou o wrapper e não o `next-server`): matar os dois nomes e
  conferir a porta antes de capturar telas.
- **Inspeção durante a edição** envelhece: a segunda inspeção precisou de triagem na revisão
  final. Melhor rodar inspeções entre ondas, não durante.

## 5. Prompt mestre (cole e preencha)

```
Use o skill agent-army neste repositório. Objetivo: <uma frase>. Fonte da verdade:
<spec/plano>. Sequência: Onda 1 → Portão (2 gerentes Opus, um tranquilo e um rigoroso)
→ Onda 2 → Portão → Revisor <modelo mais forte> em xhigh + nova inspeção → Rodada final
Opus xhigh por dono de arquivo → Revisão final → relatório.

Modelos: features-chave Opus high; features pequenas Sonnet xhigh; inspeções só-leitura
("porcos-trufeiros") Haiku max; gerentes Opus high; revisor e revisão final <modelo mais
forte> xhigh; rodada final Opus xhigh. Passe model e effort explícitos em toda chamada.

Regras para TODO agente: posse exclusiva de arquivos listada no brief; interfaces
consumidas congeladas com assinatura; nunca git que mude estado; nunca build/dev/install
(só o Comandante); teste antes do código; relatório no formato fixo com "Flags for
Commander"; se a ferramenta de sub-agentes não existir, fazer o trabalho sozinho e dizer.

Comandante: fundação de tipos antes de cada onda; verificação completa entre ondas
(typecheck, lint, testes, build, e2e contra a build, capturas desktop/celular, diff ×
relatórios); commit de integração por onda; mensagens no meio do voo para ajustar
interfaces; nunca encolher o exército em silêncio.

Entregáveis finais: código verificado, docs alinhadas (spec, README, pendências), página
de gráficos de usabilidade + diagramas de fluxo, e relatório de como foi.
```

## 6. Esqueletos de brief

### Agente de pacote (Opus/Sonnet)
```
Você é "<Nome>", especialista em <domínio>, agente da onda <N>. pt-BR. Sem sub-agentes
neste ambiente: faça você mesmo.
Contexto: leia <AGENTS.md, spec §x, pareceres com os ids>. Seus arquivos (posse
exclusiva): <lista>. Interfaces de outros (não edite; programe contra): <assinaturas>.
Itens: <1..n, cada um com arquivo, comportamento esperado e teste>.
Regras: só seus arquivos; nunca git que mude estado; nunca build/dev/start/install;
pode tsc/eslint/vitest; teste antes do código; pendências com TODO(<pacote>).
Relatório final (formato fixo): Files Modified / Itens / Flags for Commander / Issues /
Verification (tsc, eslint, vitest, git status --short) / Status.
```

### Porcos-trufeiros (Haiku max, só-leitura)
```
Inspeção SÓ-LEITURA de todo o código por áreas: segurança, acessibilidade, consistência,
lógica (casos-limite, invariantes, fallbacks), desempenho. Cada achado: arquivo:linha,
severidade (bloqueador/alto/médio/baixo), problema, por que importa, correção em uma
frase, dono sugerido. Marque (regressão)/(reincidente) e liste ids antigos RESOLVIDOS.
Um único arquivo de saída. Nada vago: tudo verificável lendo o arquivo citado.
```

### Gerente (Opus high) — dois estilos
```
Tranquilo: o que REALMENTE afeta a pessoa ou a estabilidade; triagem econômica
(corrigir / adiar / descartar, uma frase cada); ponto de vista do leigo nas telas.
Rigoroso: tudo; checagem de conclusão-fantasma pelo diff; roda build e e2e (único que
pode); tabela de problemas com arquivo:linha, severidade, correção concreta, tamanho
P/M/G e dono; tabela de conflitos de arquivo para a próxima onda.
Os dois: veredito APROVADA / APROVADA COM CORREÇÕES / REPROVADA; nenhum edita código.
```

### Revisor independente (modelo mais forte, xhigh)
```
Não leia os vereditos dos gerentes. Prove cada achado com cenário concreto (entrada →
saída errada) ou sonda descartável. Cubra lógica, segurança, qualidade dos testes
(passam por acaso?), UI/a11y, honestidade dos dados, docs × código, dívida. Tabela
F-xx com arquivo:linha, severidade, cenário, correção, tamanho.
```
