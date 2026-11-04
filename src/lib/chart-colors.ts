// Cores dos gráficos (DESIGN.md, seção "Gráficos"). Um lugar só, para os dois
// gráficos (histórico de preço e comparáveis) não duplicarem hexadecimais.
//
// - enfase: a série que importa ("Sua montagem", a linha de preço).
// - contexto: as demais séries (de-ênfase), >= 3:1 sobre a superfície.
// - relacionado: tom intermediário para "parecidos com o seu" (um passo mais claro
//   que o contexto; a ênfase continua única).
export const CHART_COLORS = {
  enfase: "#f0b43a",
  contexto: "#626877",
  relacionado: "#8b8e99",
  grade: "#2b2f3a",
  eixo: "#8b8e99",
  texto: "#f2efe6",
  textoMuted: "#aeb0b8",
  superficie: "#15171c",
  superficie2: "#1c1f26",
} as const;
