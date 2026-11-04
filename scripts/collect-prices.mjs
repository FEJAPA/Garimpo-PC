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
// Código 1 = erro geral (variáveis faltando, banco fora do ar) OU falha ao GRAVAR
// no banco (o preço foi lido, mas o Supabase recusou o update/insert: sem aviso, o
// histórico pararia de crescer e o workflow ficaria verde). Falha de gravação não é
// culpa do seletor, então não conta para o "seletor quebrado"; 0 = tudo certo.
//
// IMPORTANTE (ética/legal): respeitamos os sites — uma requisição por vez, com
// pausa entre elas, e identificando um User-Agent. Lojas mudam o HTML com
// frequência, então cada adaptador isola os "seletores" daquela loja. Se um
// quebrar, os outros continuam funcionando.

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

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
const TIMEOUT_PRECO_MS = 5000; // quanto esperamos o preço aparecer na página (PERF-05)
const ESPERA_CURTA_MS = 500; // folga extra se o preço não apareceu a tempo; o leitor tenta mesmo assim
const TAMANHO_PAGINA = 1000; // o PostgREST devolve no máximo 1000 linhas por consulta (DAD-02)
const LIMITE_FALHA = 0.3; // acima disso (30%) numa loja, consideramos o seletor quebrado
const ARQUIVO_RESULTADO = new URL("../coleta-resultado.json", import.meta.url);
const MAX_FALHAS_DETALHADAS = 10; // por loja, para o arquivo e a issue não ficarem enormes

// Navegador: normalmente o Playwright usa o Chromium que ele mesmo baixa
// (`npx playwright install chromium`, como faz o workflow). Só quando esse não existe
// (ex.: ambiente com um Chromium pré-instalado em outra versão) caímos num caminho
// alternativo, o mesmo fallback de playwright.config.ts. Dá para apontar outro com
// PW_CHROMIUM_PATH. Devolve undefined para o Playwright usar o padrão.
function caminhoDoChromium() {
  if (existsSync(chromium.executablePath())) return undefined;
  const alternativo = process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
  return existsSync(alternativo) ? alternativo : undefined;
}

// --- Adaptadores por loja: cada um sabe ler o preço da SUA página ---
// Para adicionar uma loja nova, crie uma função que recebe a página (Playwright)
// e devolve o preço PIX em número (ou null se não conseguir).
const adapters = {
  // KaBuM! costuma expor o preço à vista/PIX num elemento com data-testid.
  // KaBuM!: o preço PIX em destaque fica num <h4> grande (text-4xl) com a cor
  // de marca (text-secondary-500). Verificado no HTML real em jun/2026.
  async kabum(page) {
    // A Kabum monta o preço via JavaScript: lerPrimeiroPreco espera ele aparecer.
    return lerPrimeiroPreco(page, [
      "h4.text-4xl.text-secondary-500",
      "h4.text-secondary-500",
      '[data-testid="price-value"]',
    ]);
  },
  async pichau(page) {
    return lerPrimeiroPreco(page, ['[data-cy="product-price"]', ".price_vista", ".jss"]);
  },
  async terabyte(page) {
    return lerPrimeiroPreco(page, ["#valVista", ".valVista", ".product-yourprice"]);
  },
};

// Espera o preço aparecer na página em vez de dormir um tempo fixo (PERF-05): sai
// assim que algum dos seletores tem um texto com cara de preço ("1.899,90") e
// desiste em TIMEOUT_PRECO_MS. Usamos waitForFunction, e não só waitForSelector,
// porque alguns seletores são genéricos (ex.: ".jss" da Pichau existe antes do preço
// carregar) e um waitForSelector liberaria cedo demais. O critério é o mesmo do
// leitor abaixo (textContent do elemento). Se estourar o tempo, só damos uma folga
// curta: o leitor tenta mesmo assim e, não achando, a oferta vira falha.
async function esperarPreco(page, seletores) {
  try {
    await page.waitForFunction(
      (sels) => sels.some((s) => /\d[\d.]*,\d{2}/.test(document.querySelector(s)?.textContent ?? "")),
      seletores,
      { timeout: TIMEOUT_PRECO_MS, polling: 250 }
    );
  } catch {
    await page.waitForTimeout(ESPERA_CURTA_MS);
  }
}

// Tenta cada seletor e extrai o primeiro número que parecer um preço em reais.
async function lerPrimeiroPreco(page, seletores) {
  await esperarPreco(page, seletores);
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
// `porLoja` tem o formato
//   { kabum: { ofertas, sucessos, falhas, falhasGravacao, detalhes: [{ produto, motivo }] } }.
// `falhas` são as de LEITURA (seletor não achou o preço, página não abriu): só elas
// entram na taxa que define "seletor quebrado". `falhasGravacao` são as ofertas cujo
// preço foi lido mas o banco recusou a gravação (PERF-06); contam como falha na
// coleta, mas não acusam o seletor.
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
      falhasGravacao: d.falhasGravacao,
      taxaFalha: Number(taxaFalha.toFixed(4)),
      detalhesDasFalhas: d.detalhes.slice(0, MAX_FALHAS_DETALHADAS),
    };
    if (taxaFalha > limite) lojasQuebradas.push(loja);
  }
  return { lojas, lojasQuebradas };
}

// Lê TODAS as ofertas, página a página (DAD-02). Sem isso, o PostgREST corta a
// resposta em 1000 linhas sem avisar e as ofertas além disso nunca seriam coletadas.
// A ordenação por id mantém as páginas estáveis (sem repetir nem pular linhas).
async function lerOfertas(db) {
  const todas = [];
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data, error } = await db
      .from("offers")
      .select("id, url, price_pix, store_id, product:products(name)")
      .order("id")
      .range(de, de + TAMANHO_PAGINA - 1);
    if (error) return { error };
    todas.push(...(data ?? []));
    if ((data ?? []).length < TAMANHO_PAGINA) return { data: todas };
  }
}

// Grava o preço novo (oferta + histórico). Devolve a mensagem do erro, ou null se
// deu certo. O supabase-js NÃO lança em erro de banco (RLS, chave errada, coluna
// inexistente): ele devolve { error }, que antes ninguém lia (PERF-06).
// Se o update falha, não gravamos o histórico: o gráfico mostraria um preço que a
// oferta não tem.
async function gravarPreco(db, oferta, preco) {
  try {
    const up = await db.from("offers").update({ price_pix: preco }).eq("id", oferta.id);
    if (up.error) return `offers: ${up.error.message}`;
    const ins = await db.from("price_history").insert({ offer_id: oferta.id, price_pix: preco });
    if (ins.error) return `price_history: ${ins.error.message}`;
    return null;
  } catch (e) {
    return String(e.message ?? e).split("\n")[0];
  }
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
  const { data: ofertas, error } = await lerOfertas(db);
  if (error) {
    console.error("❌ Erro lendo ofertas:", error.message);
    process.exit(1);
  }

  const alvos = (ofertas ?? []).filter((o) => o.url && adapters[o.store_id]);
  console.log(`🔎 ${alvos.length} ofertas para coletar${DRY_RUN ? " (DRY-RUN)" : ""}.`);

  const browser = await chromium.launch({ executablePath: caminhoDoChromium() });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (compatible; GarimpoPC/0.1; +https://garimpopc.exemplo) coletor-de-precos",
  });

  let ok = 0;
  let falhas = 0; // todas as falhas (leitura + gravação)
  let falhasGravacao = 0;
  const porLoja = {};
  // Anota o resultado de uma oferta no balanço da loja dela.
  // `tipo` = "leitura" (não achou o preço) ou "gravacao" (achou, mas o banco recusou).
  const registrar = (loja, produto, motivo, tipo = "leitura") => {
    const d = (porLoja[loja] ??= { ofertas: 0, sucessos: 0, falhas: 0, falhasGravacao: 0, detalhes: [] });
    d.ofertas++;
    if (!motivo) {
      d.sucessos++;
      return;
    }
    if (tipo === "gravacao") d.falhasGravacao++;
    else d.falhas++;
    d.detalhes.push({ produto, motivo });
  };
  for (const [i, oferta] of alvos.entries()) {
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
        const erroGravacao = DRY_RUN ? null : await gravarPreco(db, oferta, preco);
        if (erroGravacao) {
          console.warn(
            `⚠️  ${nome} @ ${oferta.store_id}: preço lido (R$ ${preco.toFixed(2)}), mas NÃO gravado — ${erroGravacao}`
          );
          registrar(oferta.store_id, nome, `erro ao gravar no banco (${erroGravacao})`, "gravacao");
          falhas++;
          falhasGravacao++;
        } else {
          console.log(
            `✅ ${nome} @ ${oferta.store_id}: R$ ${preco.toFixed(2)} (antes: R$ ${Number(
              oferta.price_pix
            ).toFixed(2)})`
          );
          registrar(oferta.store_id, nome, null);
          ok++;
        }
      }
    } catch (e) {
      console.warn(`⚠️  ${nome} @ ${oferta.store_id}: erro — ${e.message}`);
      registrar(oferta.store_id, nome, `erro: ${String(e.message).split("\n")[0]}`);
      falhas++;
    } finally {
      await page.close();
      // Pausa educada entre uma página e a próxima (não precisa depois da última).
      // TODO(V2-H): concorrência limitada por loja (PERF-05): intercalar as lojas e
      // pausar por domínio, para uma pausa não atrasar a outra loja; e interromper
      // uma loja cujas primeiras ofertas falharam todas (seletor quebrado), para não
      // gastar o tempo do job esperando o timeout de cada oferta.
      if (i < alvos.length - 1) await new Promise((r) => setTimeout(r, PAUSA_MS));
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
    total: { ofertas: alvos.length, sucessos: ok, falhas, falhasGravacao },
    lojas,
    lojasQuebradas,
  };
  writeFileSync(ARQUIVO_RESULTADO, JSON.stringify(resultado, null, 2) + "\n");
  for (const [loja, d] of Object.entries(lojas)) {
    // Com falha de gravação, deixa claro que a % é só da leitura (a que acusa seletor).
    const gravacao = d.falhasGravacao > 0 ? ` na leitura · ${d.falhasGravacao} sem gravar` : "";
    console.log(`   ${loja}: ${d.sucessos}/${d.ofertas} ok · ${(d.taxaFalha * 100).toFixed(0)}% de falha${gravacao}`);
  }
  if (falhasGravacao > 0) {
    console.error(
      `❌ ${falhasGravacao} preço(s) lido(s) mas NÃO gravado(s) no banco (veja "erro ao gravar" em coleta-resultado.json). ` +
        "Confira a SUPABASE_SERVICE_ROLE_KEY e as tabelas offers/price_history."
    );
  }
  // exitCode (e não exit) deixa o Node terminar de escrever tudo antes de sair.
  // 2 (seletor quebrado) tem prioridade: é ele que faz o workflow abrir a issue.
  if (lojasQuebradas.length > 0) {
    console.error(
      `❌ Seletor provavelmente quebrado (mais de ${Math.round(LIMITE_FALHA * 100)}% de falhas): ${lojasQuebradas.join(", ")}`
    );
    process.exitCode = 2;
  } else if (falhasGravacao > 0) {
    process.exitCode = 1;
  }
}

main();
