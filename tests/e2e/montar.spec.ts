// Testes e2e do Montador de PC (/montar): o caminho feliz, o caso sem solução,
// a ausência de rolagem horizontal no celular, o perfil de uso e a resolução,
// a aba "Misturar" do pagamento e o link de compartilhamento (?b=).
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

  test("mostra a aba Misturar no pagamento", async ({ page }) => {
    await montar(page, 6000, 7000);
    await expect(page.getByText("Total no Pix").first()).toBeVisible();

    const misturar = page.getByRole("button", { name: "Misturar" });
    await expect(misturar).toBeVisible();
    await misturar.click();
    await expect(misturar).toHaveAttribute("aria-pressed", "true");
  });

  test("tem perfil de uso e resolução como grupos de opção", async ({ page }) => {
    await page.goto("/montar?alvo=6000&teto=7000");

    const uso = page.getByRole("radiogroup", { name: "Para que você vai usar?" });
    await expect(uso.getByRole("radio")).toHaveCount(3);
    await expect(uso.getByRole("radio", { name: "Jogos" })).toHaveAttribute("aria-checked", "true");
    await uso.getByRole("radio", { name: "Trabalho" }).click();
    await expect(uso.getByRole("radio", { name: "Trabalho" })).toHaveAttribute("aria-checked", "true");
    await expect(uso.getByRole("radio", { name: "Jogos" })).toHaveAttribute("aria-checked", "false");

    const resolucao = page.getByRole("radiogroup", { name: "Resolução do monitor" });
    await expect(resolucao.getByRole("radio", { name: "Full HD" })).toHaveAttribute("aria-checked", "true");
    // Teclado: seta para a direita muda a escolha.
    await resolucao.getByRole("radio", { name: "Full HD" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(resolucao.getByRole("radio", { name: "Quad HD" })).toHaveAttribute("aria-checked", "true");
  });

  test("valor em dinheiro inválido mostra erro ligado ao campo", async ({ page }) => {
    await page.goto("/montar");
    const alvo = page.getByLabel("Quero gastar");
    await alvo.fill("abc");
    await expect(alvo).toHaveAttribute("aria-invalid", "true");
    await expect(alvo).toHaveAccessibleDescription("Informe um valor maior que zero.");
    await expect(page.getByRole("button", { name: "Montar meu PC" })).toBeDisabled();

    await alvo.fill("2000000");
    await expect(alvo).toHaveAccessibleDescription("Valor acima do permitido (R$ 1.000.000).");
  });

  test("o link compartilhado (?b=) restaura as escolhas e monta sozinho", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/montar?alvo=5500&teto=6500");
    await page.getByRole("radiogroup", { name: "Resolução do monitor" }).getByRole("radio", { name: "Quad HD" }).click();
    await page.getByRole("button", { name: "Montar meu PC" }).click();
    await expect(page.getByText("Total no Pix").first()).toBeVisible();
    const totalOriginal = await totalNoPix(page).textContent();

    await page.getByRole("button", { name: "Copiar link" }).click();
    await expect(page.getByRole("button", { name: "Link copiado" })).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/\/montar\?b=[A-Za-z0-9_-]+$/);

    // Abre o link: monta sem clicar, com as mesmas escolhas e o mesmo total.
    await page.goto(link);
    await expect(page.getByText("Total no Pix").first()).toBeVisible();
    await expect(totalNoPix(page)).toHaveText(totalOriginal ?? "");
    await expect(page.getByLabel("Quero gastar")).toHaveValue("5500");
    await expect(
      page.getByRole("radiogroup", { name: "Resolução do monitor" }).getByRole("radio", { name: "Quad HD" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  test("link compartilhado inválido avisa e não monta", async ({ page }) => {
    await page.goto("/montar?b=isso-nao-e-um-codigo");
    await expect(page.getByText("Não conseguimos abrir este link")).toBeVisible();
    await expect(page.getByText("Total no Pix")).toHaveCount(0);
  });

  test("com o filtro de lojas desligado, não recomenda em silêncio a oferta 'boa demais' (R-01)", async ({ page }) => {
    await page.goto("/montar?alvo=6000&teto=7000");
    const filtro = page.getByRole("switch", { name: "Só lojas confiáveis" });
    await filtro.click();
    await expect(filtro).toHaveAttribute("aria-checked", "false");
    await page.getByRole("button", { name: "Montar meu PC" }).click();
    await expect(page.getByText("Total no Pix").first()).toBeVisible();

    // A oferta do marketplace a R$ 1.399,90 (27% abaixo das confiáveis) ou fica de fora
    // ou aparece com o aviso "Preço bom demais?" na própria peça.
    const pecas = page.locator("section", { has: page.getByRole("heading", { name: "Peças", exact: true }) });
    const temOfertaSuspeita = (await pecas.getByText(/1\.399,90/).count()) > 0;
    if (temOfertaSuspeita) await expect(pecas.getByText("Preço bom demais?")).toBeVisible();
    // Cada peça explica por que a loja é (ou não) confiável.
    await expect(pecas.getByText(/^Por que (não marcamos como )?confiável:/)).toHaveCount(7);
  });
});
