// Testes e2e de navegação: home -> montador, busca e página de uma peça.
// Usam os dados de exemplo do modo de demonstração (sem Supabase).

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
});
