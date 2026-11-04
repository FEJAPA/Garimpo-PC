// Testes e2e da página de uma peça (/peca/<slug>): o herói "Melhor preço agora" e o
// aviso de oferta "boa demais" na comparação entre lojas.
//
// Cenário do modo de demonstração (src/models/mock-data.ts), RTX 4060:
//   - KaBuM!  R$ 1.899,90 (loja confiável)
//   - Pichau  R$ 1.929,90 (loja confiável)
//   - Promo Center (marketplace) R$ 1.399,90: ~26% abaixo das confiáveis, então é
//     "suspeita" (regra de ≥ 25% abaixo da mediana).
// O herói nunca pode anunciar a suspeita como "melhor preço" (R-01, S-16); ela continua
// na lista, com o aviso "Preço bom demais?".

import { expect, test } from "@playwright/test";

test.describe("Página da peça", () => {
  test("o herói mostra a melhor oferta NÃO suspeita e a lista avisa da 'boa demais'", async ({ page }) => {
    await page.goto("/peca/rtx-4060");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("4060");

    // Herói: o bloco com o rótulo "Melhor preço agora", o preço e a loja.
    const heroi = page.getByText(/^Melhor preço agora/).locator("xpath=..");
    await expect(heroi).toBeVisible();
    await expect(heroi).toContainText(/R\$\s*1\.899,90/);
    await expect(heroi).toContainText("KaBuM!");
    await expect(heroi).not.toContainText("1.399,90");
    await expect(heroi).not.toContainText("Promo Center");

    // Lista de lojas: a oferta do marketplace aparece, com o aviso na própria linha.
    const lista = page.locator("section", { has: page.getByRole("heading", { name: "Comparação entre lojas" }) });
    await expect(lista.getByText("Preço bom demais?")).toHaveCount(1);
    const linhaSuspeita = lista.locator("li", { hasText: "Promo Center" });
    await expect(linhaSuspeita).toHaveCount(1);
    await expect(linhaSuspeita).toContainText(/R\$\s*1\.399,90/);
    await expect(linhaSuspeita.getByText("Preço bom demais?")).toBeVisible();
  });
});
