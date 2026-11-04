// Configuração do Vitest (testes unitários da lógica pura: orçamento, montagem
// automática, desempenho, pagamentos). Rode com `npm test`.
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // Mesmo atalho "@/..." do tsconfig.json.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
