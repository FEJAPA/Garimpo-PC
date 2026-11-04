# Estado do agent army — GarimpoPC V2

Arquivo de retomada (escrito pelo Comandante após cada onda). Se a sessão cair, a
próxima invocação lê este arquivo e continua da última onda limpa.

- Branch de trabalho: `claude/exciting-faraday-afn7pd`
- Checkpoint de rollback: `agent-army/checkpoint-20261104-1605` (HEAD = e709af0, tipos de fundação)
- Poder: Comandante Fable · features-chave L1 Opus/high · pequenas L1 Sonnet/xhigh · sub-agentes Sonnet/xhigh · porcos-trufeiros Haiku/max · gerentes 2× Opus/high (um tranquilo, um rigoroso) · revisor Fable/xhigh · correções finais Opus/xhigh
- Sequência pedida pelo usuário: Onda 1 (A, C, D, E, H, Diagramas, Trufas) → Portão 1 (gerentes) → Onda 2 (B, F, G + correções) → Portão 2 → Revisor Fable → Correções Opus → gráficos de usabilidade + diagramas → revisão final → relatório.

## Onda 1 — Executar (em andamento, iniciada 2026-11-04 16:10 UTC)

| Agente | Modelo | Status | Diff confirmado |
|---|---|---|---|
| Pacote-A Specs | opus/high | rodando | — |
| Pacote-C Confiança | opus/high | rodando | — |
| Pacote-D Benchmarks | opus/high | rodando | — |
| Pacote-E Pagamentos | opus/high | rodando | — |
| Pacote-H Qualidade | sonnet/xhigh | rodando | — |
| Documentação-Diagramas | sonnet/xhigh | rodando | — |
| Porcos-Trufeiros | haiku/max | rodando | — |

Arquivos reservados ao Comandante nesta onda: src/models/builder-types.ts, src/models/types.ts,
README.md, src/app/montar/page.tsx, src/components/builder/BuilderForm.tsx, BuildResultView.tsx,
BuildSummary.tsx (vão para o Pacote F na onda 2).

## Flags abertas
(nenhuma ainda)

## Decisões
- Fundação de tipos feita pelo Comandante (campos opcionais) para não serializar a onda 1.
- A2 (validação de preço) movida do Pacote A para o C (trust.ts tem dono único).
- E-Tela deixa a prop `parts` opcional até o Pacote F ligar BuildResultView na onda 2.
