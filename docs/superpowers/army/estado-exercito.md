# Estado do agent army — GarimpoPC V2

Arquivo de retomada (escrito pelo Comandante após cada onda). Se a sessão cair, a
próxima invocação lê este arquivo e continua da última onda limpa.

- Branch de trabalho: `claude/exciting-faraday-afn7pd`
- Checkpoint de rollback: `agent-army/checkpoint-20261104-1605` (HEAD = e709af0, tipos de fundação)
- Poder: Comandante Fable · features-chave L1 Opus/high · pequenas L1 Sonnet/xhigh · sub-agentes Sonnet/xhigh · porcos-trufeiros Haiku/max · gerentes 2× Opus/high (um tranquilo, um rigoroso) · revisor Fable/xhigh · correções finais Opus/xhigh
- Sequência pedida pelo usuário: Onda 1 (A, C, D, E, H, Diagramas, Trufas) → Portão 1 (gerentes) → Onda 2 (B, F, G + correções) → Portão 2 → Revisor Fable → Correções Opus → gráficos de usabilidade + diagramas → revisão final → relatório.

## Onda 1 — Executar (CONCLUÍDA 2026-11-04 ~16:40 UTC)

| Agente | Modelo | Status | Diff confirmado |
|---|---|---|---|
| Pacote-A Specs | opus/high | COMPLETE | sim (2ab7376) |
| Pacote-C Confiança | opus/high | COMPLETE | sim (42bb925) |
| Pacote-D Benchmarks | opus/high | COMPLETE | sim (commits wip + chore) |
| Pacote-E Pagamentos | opus/high | PARTIAL (sem sub-agentes) | sim (ca6066d) |
| Pacote-H Qualidade | sonnet/xhigh | COMPLETE | sim (64cb9f0) |
| Documentação-Diagramas | sonnet/xhigh | PARTIAL (sem sub-agentes) | sim (f6499ea) |
| Porcos-Trufeiros | haiku/max | PARTIAL (sem sub-agentes) | onda1-trufas.md, 68 achados |

Desvio registrado: a ferramenta Agent não existe dentro dos sub-agentes deste ambiente, então a
Camada 2 não pôde ser criada; todos os L1 fizeram o trabalho sozinhos. Compensação: nas ondas
seguintes o Comandante lança mais agentes diretos, com posse de arquivos mais fina.

## Portão 1 (CONCLUÍDO)
- Gerente Tranquilo: APROVADA COM CORREÇÕES (portao1-tranquilo.md) — 27 corrigir / 35 adiar / 6 descartar.
- Gerente Rigoroso: APROVADA COM CORREÇÕES (portao1-rigoroso.md) — build PASS, e2e PASS (11+1), R-01..R-19.
- Fantasmas: nenhum. Lacunas declaradas: C3 (Candidate.suspicious não preenchido), A (nota de peças ignoradas; ligação na página).

## Onda 2 — Executar (B, F, G + correções) — CONCLUÍDA 2026-11-04 ~17:30 UTC

| Agente | Modelo | Status | Entregas |
|---|---|---|---|
| Pacote-B Algoritmo | opus/high | COMPLETE | ctx, oferta suspeita, specs inválidas, folga, perfis de uso, planejador exato (24 ms/150 peças) |
| Pacote-F Tela | opus/high | COMPLETE | ligação de specs/refs/juros, parseMoney, perfil/resolução, link ?b=, CSV, salvar, a11y; e2e 23 passam |
| Pacote-G Conta/Alertas | opus/high | COMPLETE | montagens salvas, alerta da montagem, rota fechada, e-mail honesto, recorded_at |
| Correções-Pagamentos | opus/high | COMPLETE | preço a prazo como piso, faixas, economia honesta, plano misto por custo evitado |
| Correções-Desempenho | sonnet/xhigh | COMPLETE | RAM sem dupla contagem, fontes honestas, guardas, metodologia |
| Correções-Confiança-A11y | sonnet/xhigh | COMPLETE | régua única, melhor preço honesto, bloqueio, skip link, títulos, gráfico acessível |
| Correções-Dados-Scripts | sonnet/xhigh | COMPLETE | specs validadas, coletor com gravação verificada, e2e no CI contra next start |

Integração do Comandante: rota /metodologia, headers de segurança, aviso de specs vazias, "lido em" no resumo,
safeHref na peça, spec §5/§7, diagrama de pagamento, README, .env.example, AGENTS.md.

(iniciada 2026-11-04 ~16:50 UTC)
Agentes diretos: Pacote-B (opus/high), Pacote-F (opus/high), Pacote-G (opus/high), Correções-Pagamentos (opus/high),
Correções-Desempenho (sonnet/xhigh), Correções-Confiança-A11y (sonnet/xhigh), Correções-Dados-Scripts (sonnet/xhigh).
Fundação feita pelo Comandante: BuildContext, SavedBuild, InstallmentPlan.schedule, PaymentSummary.bestInstallment,
BuildSuccess.upgrades/ignored em builder-types.ts; src/lib/chart-colors.ts; regra de dados ilustrativos no AGENTS.md.

## Flags abertas
- R-14 (e2e para filtro desligado, preço suspeito, faixas do parcelado): depois de F e B.
- A4 (categoria cooler): fora da V2 desta sessão.
- DAD-01 (constraints no banco), SEG-07 (headers), PERF-02/03/04: adiados (pós-V2).

## Decisões
- Fundação de tipos feita pelo Comandante (campos opcionais) para não serializar a onda 1.
- A2 (validação de preço) movida do Pacote A para o C (trust.ts tem dono único).
- E-Tela deixa a prop `parts` opcional até o Pacote F ligar BuildResultView na onda 2.
