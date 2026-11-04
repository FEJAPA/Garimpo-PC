// Configuração dos testes ponta a ponta (e2e) com Playwright Test.
// Rode com `npm run test:e2e`. Os testes abrem o site de verdade num navegador,
// clicam e conferem o que aparece na tela, como uma pessoa faria.
//
// O servidor sobe sozinho na porta 3100 (a 3000 fica livre para quem estiver
// desenvolvendo):
//   - localmente: `next dev` (não exige build). Se já houver um servidor nessa
//     porta, ele é reaproveitado (reuseExistingServer);
//   - no CI (variável CI definida): `next start`, ou seja, o site CONSTRUÍDO no
//     passo anterior (`npm run build`), que é o que vai para produção. Assim o
//     e2e testa o artefato de verdade e não depende da compilação sob demanda do
//     dev. Aqui o servidor nunca é reaproveitado: sempre sobe um limpo.
//     Para repetir isso localmente: `npm run build && CI=1 npm run test:e2e`.
//
// Os dados vêm do modo de demonstração (sem Supabase): peças e preços de
// exemplo, estáveis para os testes.

import { existsSync } from "node:fs";
import { chromium, defineConfig, devices } from "@playwright/test";

const PORTA = 3100;
const URL_BASE = `http://localhost:${PORTA}`;

// Navegador: normalmente o Playwright usa o Chromium que ele mesmo baixa
// (`npx playwright install chromium`, como faz o CI). Só quando esse não existe
// (ex.: ambiente com um Chromium pré-instalado em outra versão) caímos num
// caminho alternativo. Dá para apontar outro com PW_CHROMIUM_PATH.
const CHROMIUM_ALTERNATIVO = process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const navegadorPadraoExiste = existsSync(chromium.executablePath());
const executablePath =
  !navegadorPadraoExiste && existsSync(CHROMIUM_ALTERNATIVO) ? CHROMIUM_ALTERNATIVO : undefined;

export default defineConfig({
  testDir: "tests/e2e",
  // O `next dev` compila cada página na primeira visita, então o 1º acesso é lento
  // (o `next start` do CI não tem esse custo, mas o limite folgado não atrapalha).
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // No CI repetimos uma vez para absorver oscilação do ambiente; local, não.
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  // O relatório HTML fica em playwright-report/ (ignorado pelo git; o CI o publica se falhar).
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: URL_BASE,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
    {
      // Celular emulado (Pixel com tela de 390x844): toque, user-agent e viewport móveis.
      name: "celular",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    // No CI: `next start` serve o build já feito. Local: `next dev`.
    command: process.env.CI ? `npx next start -p ${PORTA}` : `npx next dev -p ${PORTA}`,
    url: URL_BASE,
    // No CI nunca reaproveitamos um servidor já aberto (podia ser de outro build).
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
