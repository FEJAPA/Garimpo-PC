// Script de diagnóstico: abre uma URL de produto e tenta descobrir ONDE o preço
// está no HTML. Ajuda a ajustar os "seletores" do coletor.
// Uso: node scripts/inspect-store.mjs "URL_DO_PRODUTO"

import { chromium } from "playwright";

const url = process.argv[2];
if (!url) {
  console.error('Uso: node scripts/inspect-store.mjs "URL_DO_PRODUTO"');
  process.exit(1);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
});
const page = await ctx.newPage();

try {
  console.log("Abrindo:", url);
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  console.log("Status HTTP:", resp?.status());
  console.log("Título da página:", await page.title());

  // Espera um pouco para o preço carregar via JavaScript.
  await page.waitForTimeout(3000);

  // Procura no texto da página por padrões de preço "R$ x.xxx,xx".
  const texto = await page.evaluate(() => document.body.innerText);
  const precos = [...texto.matchAll(/R\$\s?[\d.]+,\d{2}/g)].map((m) => m[0]);
  console.log("\nPreços encontrados no texto da página (primeiros 10):");
  console.log(precos.slice(0, 10));

  // Lista alguns elementos que parecem conter preço (para achar o seletor).
  const candidatos = await page.evaluate(() => {
    const out = [];
    const els = document.querySelectorAll("*");
    for (const el of els) {
      const t = (el.textContent || "").trim();
      if (/^R\$\s?[\d.]+,\d{2}$/.test(t) && el.children.length === 0) {
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: el.className?.toString().slice(0, 60),
          id: el.id,
          testid: el.getAttribute("data-testid") || el.getAttribute("data-cy"),
          text: t,
        });
      }
    }
    return out.slice(0, 12);
  });
  console.log("\nElementos que contêm SÓ um preço (candidatos a seletor):");
  for (const c of candidatos) console.log(" ", JSON.stringify(c));
} catch (e) {
  console.error("Erro:", e.message);
} finally {
  await browser.close();
}
