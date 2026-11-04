// Testes e2e do Montador de PC (/montar): o caminho feliz, o caso sem solução,
// a ausência de rolagem horizontal no celular, o perfil de uso e a resolução,
// a aba "Misturar" do pagamento, o parcelado (onde o seletor abre e as faixas
// quando as lojas param em prazos diferentes), o filtro de lojas desligado e o
// link de compartilhamento (?b=).
//
// A montagem roda no navegador (BuilderForm), então basta abrir a página,
// clicar em "Montar meu PC" e esperar o resultado aparecer.
//
// Regra destes testes (S-16): nada de `if` conferindo só "quando acontecer". Cada
// teste afirma o que TEM de aparecer (ou não) no cenário do modo de demonstração;
// se o cenário mudar, o teste quebra e alguém olha, em vez de passar por acaso.

import { expect, test, type Locator, type Page } from "@playwright/test";

/** "R$ 6.849,30" -> 6849.3 (o formatBRL pode usar espaço não separável, por isso o regex). */
function lerReais(texto: string): number {
  const limpo = texto.replace(/[^\d,]/g, "").replace(",", ".");
  return Number(limpo);
}

/** Valor em reais, com ou sem espaço (comum ou não separável) depois do "R$". */
const REAIS = String.raw`R\$\s*[\d.]+,\d{2}`;

/** Valor mostrado logo abaixo do rótulo "Total no Pix" do cabeçalho do resultado. */
function totalNoPix(page: Page): Locator {
  // "Total no Pix" aparece também no plano de pagamento; o primeiro é o do cabeçalho.
  return page.getByText("Total no Pix").first().locator("xpath=following-sibling::p[1]");
}

/** Lista de peças do resultado (um <li> por peça). */
function listaDePecas(page: Page): Locator {
  return page.locator("section", { has: page.getByRole("heading", { name: "Peças", exact: true }) });
}

/**
 * Bloco do modo "Parcelado" com a manchete ("10x de R$ 761,52", ou faixas
 * "10x de R$ … + 2x de R$ …") e o "Total parcelado". Lido com `innerText`, como a
 * pessoa vê (cada parágrafo numa linha).
 */
function blocoDoParcelado(page: Page): Locator {
  return page.getByText(/^Total parcelado/).locator("xpath=..");
}

/** Faixas "Nx de R$ X" da manchete, na ordem, e o "Total parcelado". */
async function lerParcelado(page: Page) {
  const texto = await blocoDoParcelado(page).innerText();
  const faixas = [...texto.matchAll(new RegExp(String.raw`(\d+)x de\s+(${REAIS})`, "g"))].map((m) => ({
    count: Number(m[1]),
    monthly: lerReais(m[2]),
  }));
  const total = lerReais(texto.match(new RegExp(String.raw`Total parcelado\s+(${REAIS})`))?.[1] ?? "");
  return { faixas, total };
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
    await expect(blocoDoParcelado(page)).toHaveText(new RegExp(String.raw`^\s*\d+x de\s+${REAIS}`), {
      useInnerText: true,
    });
    await expect(page.getByLabel("Número de parcelas")).toBeVisible();

    // Mudar o número de parcelas atualiza a manchete "Nx de R$ …".
    await page.getByLabel("Número de parcelas").selectOption("1");
    await expect(blocoDoParcelado(page)).toHaveText(new RegExp(String.raw`^\s*1x de\s+${REAIS}`), {
      useInnerText: true,
    });
  });

  test("parcelado abre no maior número sem acréscimo e a manchete fecha com o total (S-03, S-04)", async ({
    page,
  }) => {
    // Filtro "Só lojas confiáveis" ligado (padrão). No demo, 6000/7000 sai com peças da
    // Pichau, da KaBuM! e da Terabyte, e todas essas ofertas anunciam "10x". Então: 1x a
    // 10x pelo preço a prazo anunciado (S-03); 11x e 12x com acréscimo (juros da tabela).
    //
    // Faixas ("10x de … + 2x de …") NÃO aparecem no demo, em nenhum orçamento ou filtro:
    // para a lista de peças e "Como pagar" dizerem a mesma coisa (S-03), a tabela de cada
    // loja vai até o que as ofertas dela anunciam, e cada uma das quatro lojas tem oferta
    // "12x" (src/models/installment-tables.ts). Todas parcelam até 12x, então o plano tem
    // sempre uma faixa só. As faixas ficam com os testes de unidade
    // (src/services/builder/payments.test.ts, "mistura de lojas: faixas decrescentes…").
    // Aqui travamos o outro lado: com prazos iguais, nada de "+ Nx de" inventado.
    await montar(page, 6000, 7000);
    await expect(page.getByText("Total no Pix").first()).toBeVisible();
    // "ou R$ X parcelado" do cabeçalho: o parcelado mais barato (S-09).
    const cabecalhoParcelado = page.getByText(new RegExp(String.raw`^ou ${REAIS} parcelado$`));
    await expect(cabecalhoParcelado).toBeVisible();
    const parceladoDoCabecalho = lerReais((await cabecalhoParcelado.textContent()) ?? "");

    await page.getByRole("button", { name: "Parcelado" }).click();
    const seletor = page.getByLabel("Número de parcelas");
    await expect(seletor).toBeVisible();

    // Opções: "Nx · sem acréscimo" ou "Nx · +R$ X", com value numérico, de 1x ao máximo.
    const opcoes = await seletor
      .locator("option")
      .evaluateAll((os) => os.map((o) => ({ value: (o as HTMLOptionElement).value, texto: o.textContent ?? "" })));
    expect(opcoes.map((o) => o.value)).toEqual(opcoes.map((_, i) => String(i + 1)));
    for (const o of opcoes) {
      expect(o.texto).toMatch(new RegExp(String.raw`^${o.value}x · (sem acréscimo|\+${REAIS})$`));
    }
    const semAcrescimo = opcoes.filter((o) => o.texto.endsWith("sem acréscimo")).map((o) => Number(o.value));
    const maiorSemAcrescimo = Math.max(...semAcrescimo);
    // A oferta diz "10x" e é isso que vale (S-03), não o "até 6x" da tabela da Terabyte.
    expect(maiorSemAcrescimo).toBe(10);
    // O máximo é o da loja que parcela em mais vezes (S-04), não o da que parcela em menos.
    expect(opcoes).toHaveLength(12);

    // Abre no maior número de parcelas sem acréscimo.
    await expect(seletor).toHaveValue(String(maiorSemAcrescimo));
    await expect(seletor.locator("option:checked")).toHaveText(new RegExp(`^${maiorSemAcrescimo}x · sem acréscimo$`));

    // Manchete "10x de R$ …" (uma faixa só) que fecha com o total, e o total é o preço a prazo.
    await expect(blocoDoParcelado(page)).toHaveText(new RegExp(String.raw`^\s*${maiorSemAcrescimo}x de\s+${REAIS}`), {
      useInnerText: true,
    });
    const padrao = await lerParcelado(page);
    expect(padrao.faixas.map((f) => f.count)).toEqual([maiorSemAcrescimo]);
    expect(padrao.total).toBe(parceladoDoCabecalho);
    // O resto dos centavos vai na 1ª parcela: a manchete fica no máximo alguns centavos abaixo.
    const diferencaPadrao = padrao.total - padrao.faixas[0].count * padrao.faixas[0].monthly;
    expect(diferencaPadrao).toBeGreaterThanOrEqual(-0.005);
    expect(diferencaPadrao).toBeLessThan(1);

    // 12x (o máximo): com acréscimo, e todas as lojas vão até 12x, então é uma faixa só.
    await seletor.selectOption("12");
    await expect(seletor.locator("option:checked")).toHaveText(new RegExp(String.raw`^12x · \+${REAIS}$`));
    await expect(blocoDoParcelado(page)).toHaveText(new RegExp(String.raw`^\s*12x de\s+${REAIS}`), { useInnerText: true });
    await expect(blocoDoParcelado(page).getByText(/^\+\s*\d+x de/)).toHaveCount(0);
    const maximo = await lerParcelado(page);
    expect(maximo.faixas.map((f) => f.count)).toEqual([12]);
    expect(maximo.total).toBeGreaterThan(padrao.total);
    const diferencaMaximo = maximo.total - 12 * maximo.faixas[0].monthly;
    expect(diferencaMaximo).toBeGreaterThanOrEqual(-0.005);
    expect(diferencaMaximo).toBeLessThan(1);
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

  test("com o filtro de lojas desligado, não recomenda a oferta 'boa demais' (R-01, S-16)", async ({ page }) => {
    await page.goto("/montar?alvo=6000&teto=7000");
    const filtro = page.getByRole("switch", { name: "Só lojas confiáveis" });
    await filtro.click();
    await expect(filtro).toHaveAttribute("aria-checked", "false");
    await page.getByRole("button", { name: "Montar meu PC" }).click();
    await expect(page.getByText("Total no Pix").first()).toBeVisible();

    const pecas = listaDePecas(page);
    await expect(pecas.locator("ul > li")).toHaveCount(7);
    // A RTX 4060 do marketplace a R$ 1.399,90 (~26% abaixo das lojas confiáveis) é
    // "boa demais": o Montador prefere a oferta não suspeita, então esse preço não entra.
    await expect(pecas.getByText(/1\.399,90/)).toHaveCount(0);
    // Cada peça mostra o selo da loja (nome, nota e por que é ou não confiável, na dica).
    await expect(pecas.getByTitle(/^Loja (confiável|não marcada como confiável):/)).toHaveCount(7);
  });
});
