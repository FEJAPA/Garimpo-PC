// Testes e2e de navegação: home -> montador (link e formulário de orçamento), busca,
// página de uma peça, conta e login (sem Supabase não há sessão) e os cabeçalhos de
// segurança. Usam os dados de exemplo do modo de demonstração (sem Supabase).

import { expect, test } from "@playwright/test";

test.describe("Navegação", () => {
  test("da home leva ao Montador de PC", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Montar meu PC" }).click();

    await expect(page).toHaveURL(/\/montar$/);
    await expect(page.getByRole("heading", { level: 1, name: "Montar PC" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Montar meu PC" })).toBeVisible();
  });

  test("a busca por 'gabinete' lista cards de peças", async ({ page }) => {
    await page.goto("/");

    // Há uma barra de busca no cabeçalho para desktop e outra para celular; só a visível entra.
    const busca = page.getByRole("searchbox", { name: "Buscar peças" });
    await busca.fill("gabinete");
    await busca.press("Enter");

    await expect(page).toHaveURL(/\/busca\?q=gabinete/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("gabinete");

    // Cada card de peça é um link para /peca/<slug>.
    const cards = page.locator('a[href^="/peca/"]');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);
    await expect(cards.first()).toContainText(/gabinete/i);
  });

  test("a página da peça mostra a comparação entre lojas", async ({ page }) => {
    await page.goto("/peca/rtx-4060");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("4060");
    await expect(page.getByRole("heading", { name: "Comparação entre lojas" })).toBeVisible();
  });

  test("o formulário da home aceita valor quebrado (6550) e leva ao Montador", async ({ page }) => {
    await page.goto("/");

    // Com `step=100` o navegador barrava 6550 ("valor inválido") e o formulário nem saía.
    await page.getByLabel("Quero gastar").fill("6550");
    await page.getByRole("button", { name: "Montar com esse orçamento" }).click();

    await expect(page).toHaveURL(/\/montar\?alvo=6550(&|$)/);
    await expect(page.getByLabel("Quero gastar")).toHaveValue("6550");
  });
});

test.describe("Conta e login", () => {
  test("/conta sem login manda para /entrar e volta para a conta depois", async ({ page }) => {
    await page.goto("/conta");

    await expect(page).toHaveURL(/\/entrar\?next=%2Fconta$/);
    await expect(page.getByRole("heading", { level: 1, name: "Entrar no GarimpoPC" })).toBeVisible();
  });

  test("/entrar traduz o código de erro da URL", async ({ page }) => {
    await page.goto("/entrar?erro=credenciais");

    await expect(page.getByText(/e-mail ou senha/i)).toBeVisible();
    // O código é só um código: não aparece cru na tela.
    await expect(page.getByText("credenciais", { exact: true })).toHaveCount(0);
  });

  test("/entrar não mostra texto livre vindo da URL (S-15)", async ({ page }) => {
    // Um link "nosso" com um aviso falso numa caixa com cara de oficial seria golpe pronto.
    const golpe = "Sua conta foi bloqueada, ligue para 0800 000 0000";
    await page.goto(`/entrar?erro=${encodeURIComponent(golpe)}&mensagem=${encodeURIComponent(golpe)}`);

    await expect(page.getByRole("heading", { level: 1, name: "Entrar no GarimpoPC" })).toBeVisible();
    await expect(page.getByText(/ligue para 0800/)).toHaveCount(0);
  });
});

test.describe("Segurança", () => {
  test("as páginas saem com HSTS e CSP sem objetos nem iframes de terceiros (F-22)", async ({ request }) => {
    const resposta = await request.get("/");
    expect(resposta.ok()).toBe(true);
    const cabecalhos = resposta.headers();

    // Sem `preload` de propósito (difícil de desfazer); ver next.config.ts.
    expect(cabecalhos["strict-transport-security"]).toBe("max-age=63072000; includeSubDomains");
    const csp = cabecalhos["content-security-policy"] ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(cabecalhos["x-frame-options"]).toBe("DENY");
    expect(cabecalhos["x-content-type-options"]).toBe("nosniff");
  });
});
