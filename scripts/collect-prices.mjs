// Coletor automático de preços (Marco 2).
//
// O que faz: para cada oferta cadastrada no banco que tenha uma URL, abre a
// página da loja, lê o preço atual e grava um novo ponto em price_history (e
// atualiza o preço da oferta). Assim o gráfico de histórico cresce sozinho.
//
// Como rodar (a partir da pasta do projeto):
//   node scripts/collect-prices.mjs            -> coleta de verdade
//   node scripts/collect-prices.mjs --dry-run  -> só mostra o que faria, sem gravar
//
// Requer no .env.local: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
//
// Ao final grava `coleta-resultado.json` (sucessos e falhas por loja) na raiz do
// projeto. Se mais de 30% das ofertas de UMA loja falharem, o seletor dela
// provavelmente quebrou: o script sai com código 2 e o workflow
// .github/workflows/coleta.yml abre (ou atualiza) uma issue "Seletor quebrado: <loja>".
// Código 1 = erro geral (variáveis faltando, banco fora do ar); 0 = tudo certo.
//
// IMPORTANTE (ética/legal): respeitamos os sites — uma requisição por vez, com
// pausa entre elas, e identificando um User-Agent. Lojas mudam o HTML com
// frequência, então cada adaptador isola os "seletores" daquela loja. Se um
// quebrar, os outros continuam funcionando.

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

// --- Carrega variáveis do .env.local (sem dependência externa) ---
function loadEnv() {
  try {
    const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* sem .env.local — segue com o ambiente */
  }
}
loadEnv();

const DRY_RUN = process.argv.includes("--dry-run");
const PAUSA_MS = 4000; // pausa entre páginas, para não sobrecarregar a loja
const LIMITE_FALHA = 0.3; // acima disso (30%) numa loja, consideramos o seletor quebrado
const ARQUIVO_RESULTADO = new URL("../coleta-resultado.json", import.meta.url);
const MAX_FALHAS_DETALHADAS = 10; // por loja, para o arquivo e a issue não ficarem enormes

// --- Adaptadores por loja: cada um sabe ler o preço da SUA página ---
// Para adicionar uma loja nova, crie uma função que recebe a página (Playwright)
// e devolve o preço PIX em número (ou null se não conseguir).
const adapters = {
  // KaBuM! costuma expor o preço à vista/PIX num elemento com data-testid.
  // KaBuM!: o preço PIX em destaque fica num <h4> grande (text-4xl) com a cor
  // de marca (text-secondary-500). Verificado no HTML real em jun/2026.
  async kabum(page) {
    // Espera o preço carregar (a Kabum monta via JavaScript).
    await page.waitForTimeout(3500);
    return lerPrimeiroPreco(page, [
      "h4.text-4xl.text-secondary-500",
      "h4.text-secondary-500",
      '[data-testid="price-value"]',
    ]);
  },
  async pichau(page) {
    await page.waitForTimeout(3500);
    return lerPrimeiroPreco(page, ['[data-cy="product-price"]', ".price_vista", ".jss"]);
  },
  async terabyte(page) {
    await page.waitForTimeout(3500);
    return lerPrimeiroPreco(page, ["#valVista", ".valVista", ".product-yourprice"]);
  },
};

// Tenta cada seletor e extrai o primeiro número que parecer um preço em reais.
async function lerPrimeiroPreco(page, seletores) {
  for (const sel of seletores) {
    const el = await page.$(sel);
    if (!el) continue;
    const txt = (await el.textContent())?.trim() ?? "";
    const preco = parseBRL(txt);
    if (preco) return preco;
  }
  return null;
}

// "R$ 1.899,90" -> 1899.90
function parseBRL(txt) {
  const m = txt.replace(/\s/g, "").match(/R?\$?([\d.]+,\d{2})/);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Resume o que aconteceu em cada loja e aponta as "quebradas" (falhas > limite).
// `porLoja` tem o formato { kabum: { ofertas, sucessos, falhas, detalhes: [{ produto, motivo }] } }.
// TODO(V2-H): ignorar lojas com poucas ofertas (1 falha em 2 ofertas já passa de 30%)
// e distinguir falha de rede (temporária) de seletor quebrado.
function resumirColeta(porLoja, limite = LIMITE_FALHA) {
  const lojas = {};
  const lojasQuebradas = [];
  for (const [loja, d] of Object.entries(porLoja)) {
    const taxaFalha = d.ofertas > 0 ? d.falhas / d.ofertas : 0;
    lojas[loja] = {
      ofertas: d.ofertas,
      sucessos: d.sucessos,
      falhas: d.falhas,
      taxaFalha: Number(taxaFalha.toFixed(4)),
      detalhesDasFalhas: d.detalhes.slice(0, MAX_FALHAS_DETALHADAS),
    };
    if (taxaFalha > limite) lojasQuebradas.push(loja);
  }
  return { lojas, lojasQuebradas };
}

async function main() {
  const inicio = new Date();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("❌ Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  // Busca ofertas que têm URL e loja conhecida.
  const { data: ofertas, error } = await db
    .from("offers")
    .select("id, url, price_pix, store_id, product:products(name)");
  if (error) {
    console.error("❌ Erro lendo ofertas:", error.message);
    process.exit(1);
  }

  const alvos = (ofertas ?? []).filter((o) => o.url && adapters[o.store_id]);
  console.log(`🔎 ${alvos.length} ofertas para coletar${DRY_RUN ? " (DRY-RUN)" : ""}.`);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (compatible; GarimpoPC/0.1; +https://garimpopc.exemplo) coletor-de-precos",
  });

  let ok = 0;
  let falhas = 0;
  const porLoja = {};
  // Anota o resultado de uma oferta no balanço da loja dela.
  const registrar = (loja, produto, motivo) => {
    const d = (porLoja[loja] ??= { ofertas: 0, sucessos: 0, falhas: 0, detalhes: [] });
    d.ofertas++;
    if (motivo) {
      d.falhas++;
      d.detalhes.push({ produto, motivo });
    } else {
      d.sucessos++;
    }
  };
  for (const oferta of alvos) {
    const nome = oferta.product?.name ?? oferta.id;
    const page = await ctx.newPage();
    try {
      await page.goto(oferta.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      const preco = await adapters[oferta.store_id](page);

      if (!preco) {
        console.warn(`⚠️  ${nome} @ ${oferta.store_id}: não consegui ler o preço.`);
        registrar(oferta.store_id, nome, "não consegui ler o preço (seletor não encontrou nada)");
        falhas++;
      } else {
        console.log(
          `✅ ${nome} @ ${oferta.store_id}: R$ ${preco.toFixed(2)} (antes: R$ ${Number(
            oferta.price_pix
          ).toFixed(2)})`
        );
        if (!DRY_RUN) {
          await db.from("offers").update({ price_pix: preco }).eq("id", oferta.id);
          await db.from("price_history").insert({ offer_id: oferta.id, price_pix: preco });
        }
        registrar(oferta.store_id, nome, null);
        ok++;
      }
    } catch (e) {
      console.warn(`⚠️  ${nome} @ ${oferta.store_id}: erro — ${e.message}`);
      registrar(oferta.store_id, nome, `erro: ${String(e.message).split("\n")[0]}`);
      falhas++;
    } finally {
      await page.close();
      await new Promise((r) => setTimeout(r, PAUSA_MS)); // pausa educada
    }
  }

  await browser.close();
  console.log(`\nFim. Sucesso: ${ok} · Falhas: ${falhas}`);

  // Balanço por loja + arquivo para o workflow (e para quem for investigar).
  const { lojas, lojasQuebradas } = resumirColeta(porLoja);
  const resultado = {
    iniciadoEm: inicio.toISOString(),
    finalizadoEm: new Date().toISOString(),
    simulacao: DRY_RUN,
    limiteDeFalha: LIMITE_FALHA,
    total: { ofertas: alvos.length, sucessos: ok, falhas },
    lojas,
    lojasQuebradas,
  };
  writeFileSync(ARQUIVO_RESULTADO, JSON.stringify(resultado, null, 2) + "\n");
  for (const [loja, d] of Object.entries(lojas)) {
    console.log(`   ${loja}: ${d.sucessos}/${d.ofertas} ok · ${(d.taxaFalha * 100).toFixed(0)}% de falha`);
  }
  if (lojasQuebradas.length > 0) {
    console.error(
      `❌ Seletor provavelmente quebrado (mais de ${Math.round(LIMITE_FALHA * 100)}% de falhas): ${lojasQuebradas.join(", ")}`
    );
    // exitCode (e não exit) deixa o Node terminar de escrever tudo antes de sair.
    process.exitCode = 2;
  }
}

main();
