// Testes e2e do Montador de PC (/montar): o caminho feliz, o caso sem solução
// e a ausência de rolagem horizontal no celular.
//
// A montagem roda no navegador (BuilderForm), então basta abrir a página,
// clicar em "Montar meu PC" e esperar o resultado aparecer.

import { expect, test, type Locator, type Page } from "@playwright/test";

/** "R$ 6.849,30" -> 6849.3 (o formatBRL pode usar espaço não separável, por isso o regex). */
function lerReais(texto: string): number {
  const limpo = texto.replace(/[^\d,]/g, "").replace(",", ".");
  return Number(limpo);
}

/** Valor mostrado logo abaixo do rótulo "Total no Pix" do cabeçalho do resultado. */
function totalNoPix(page: Page): Locator {
  // "Total no Pix" aparece também no plano de pagamento; o primeiro é o do cabeçalho.
  return page.getByText("Total no Pix").first().locator("xpath=following-sibling::p[1]");
}

async function montar(page: Page, alvo: number, teto: number) {
  await page.goto(`/montar?alvo=${alvo}&teto=${teto}`);
  await page.getByRole("button", { name: "Montar meu PC" }).click();
}

test.describe("Montador de PC", () => {
  test("monta um PC dentro do teto, com 7 peças, e alterna Pix e parcelado", async ({ page }) => {
    await montar(page, 6000, 7000);

    await expect(page.getByText("Total no Pix").first()).toBeVisible();

    // O total nunca pode passar do teto (invariante do produto).
    const total = lerReais((await totalNoPix(page).textContent()) ?? "");
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(7000);

    // Uma peça de cada categoria: GPU, CPU, placa-mãe, RAM, SSD, fonte e gabinete.
    const pecas = page
      .locator("section", { has: page.getByRole("heading", { name: "Peças", exact: true }) })
      .locator("ul > li");
    await expect(pecas).toHaveCount(7);

    // Plano de pagamento: começa no Pix; ao trocar para "Parcelado" aparecem as parcelas.
    const pix = page.getByRole("button", { name: "Pix (à vista)" });
    const parcelado = page.getByRole("button", { name: "Parcelado" });
    await expect(pix).toHaveAttribute("aria-pressed", "true");

    await parcelado.click();
    await expect(parcelado).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/^\d+x de$/)).toBeVisible();
    await expect(page.getByLabel("Número de parcelas")).toBeVisible();

    // Mudar o número de parcelas atualiza o texto "Nx de".
    await page.getByLabel("Número de parcelas").selectOption("1");
    await expect(page.getByText(/^1x de$/)).toBeVisible();
  });

  test("avisa quando o orçamento é pequeno demais para montar", async ({ page }) => {
    await montar(page, 1000, 1000);

    await expect(page.getByText("Não deu para montar")).toBeVisible();
    await expect(page.getByText("Total no Pix")).toHaveCount(0);
  });

  test("não tem rolagem horizontal no celular", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "celular", "Só faz sentido na tela estreita.");

    const semOverflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

    // Antes de montar (estado vazio) ...
    await page.goto("/montar?alvo=6000&teto=7000");
    expect(await semOverflow()).toBe(true);

    // ... com o resultado na tela (lista de peças, tabela de lojas) ...
    await page.getByRole("button", { name: "Montar meu PC" }).click();
    await expect(page.getByText("Total no Pix").first()).toBeVisible();
    expect(await semOverflow()).toBe(true);

    // ... e no modo parcelado, que tem mais texto.
    await page.getByRole("button", { name: "Parcelado" }).click();
    await expect(page.getByLabel("Número de parcelas")).toBeVisible();
    expect(await semOverflow()).toBe(true);
  });
});
