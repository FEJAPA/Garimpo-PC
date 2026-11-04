// Coletor de especificações técnicas (V2, pacote A3).
//
// O que faz: lista os produtos do banco que ainda NÃO têm linha em part_specs,
// procura cada slug na tabela curada scripts/data/specs-catalogo.json e grava
// (upsert) o que encontrar. No fim, imprime quais peças continuam sem spec para
// um humano pesquisar e preencher no JSON. Peça sem spec não entra no Montador,
// então essa lista é o "dever de casa" da curadoria.
//
// Por que um JSON curado e não raspagem automática? Specs como socket, DDR, TDP
// e watts vêm de páginas de fabricante com formatos muito diferentes, e o `perf`
// é um índice relativo nosso. Melhor um humano conferir e registrar a fonte do
// que gravar um número errado no banco.
//
// Como rodar (a partir da pasta do projeto):
//   node scripts/collect-specs.mjs            -> grava no banco
//   node scripts/collect-specs.mjs --dry-run  -> só mostra o que faria, sem gravar
//
// Requer no .env.local: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
// (a chave de serviço, porque part_specs só tem política pública de LEITURA).
// Documentação: docs/COLETA-SPECS.md.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// --- Carrega variáveis do .env.local (mesmo jeito do collect-prices.mjs) ---
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
const CATALOGO_URL = new URL("./data/specs-catalogo.json", import.meta.url);

// Valores aceitos (espelham os tipos de src/models/builder-types.ts).
const SOCKETS = ["AM4", "AM5", "LGA1700"];
const RAM_TYPES = ["DDR4", "DDR5"];
const FORM_FACTORS = ["ATX", "mATX", "ITX"];
const UPSCALING = ["DLSS", "FSR", "XeSS"];

/**
 * Confere uma entrada do JSON. Devolve a lista de problemas (vazia = ok).
 * Validamos aqui porque um erro de digitação ("DDR 5") faria a peça sumir das
 * montagens sem aviso nenhum (a compatibilidade compara texto exato).
 */
function validar(slug, e, categoriaDoBanco) {
  const erros = [];
  if (!e.category) erros.push("falta category");
  else if (categoriaDoBanco && e.category !== categoriaDoBanco)
    erros.push(`category "${e.category}" diferente do banco ("${categoriaDoBanco}")`);
  if (typeof e.perf !== "number" || !(e.perf > 0)) erros.push("perf precisa ser número > 0");
  if (typeof e.aesthetics !== "number" || e.aesthetics < 0 || e.aesthetics > 100)
    erros.push("aesthetics precisa ser número de 0 a 100");
  if (!e.source || typeof e.source !== "string") erros.push('falta source (use "ilustrativo" se for estimativa)');
  if (e.socket != null && !SOCKETS.includes(e.socket)) erros.push(`socket inválido: ${e.socket}`);
  if (e.ramType != null && !RAM_TYPES.includes(e.ramType)) erros.push(`ramType inválido: ${e.ramType}`);
  if (e.formFactor != null && !FORM_FACTORS.includes(e.formFactor))
    erros.push(`formFactor inválido: ${e.formFactor}`);
  if (e.caseSupports != null && !(Array.isArray(e.caseSupports) && e.caseSupports.every((f) => FORM_FACTORS.includes(f))))
    erros.push("caseSupports precisa ser lista de ATX/mATX/ITX");
  if (e.upscaling != null && !(Array.isArray(e.upscaling) && e.upscaling.every((u) => UPSCALING.includes(u))))
    erros.push("upscaling precisa ser lista de DLSS/FSR/XeSS");
  for (const campo of ["tdp", "wattage", "capacityGb"]) {
    if (e[campo] != null && !(Number.isInteger(e[campo]) && e[campo] > 0))
      erros.push(`${campo} precisa ser inteiro > 0`);
  }
  if (erros.length) erros.unshift(`${slug}:`);
  return erros;
}

/** camelCase do JSON -> colunas snake_case de part_specs. */
function paraLinha(productId, e) {
  return {
    product_id: productId,
    perf: e.perf,
    aesthetics: e.aesthetics,
    tdp: e.tdp ?? null,
    socket: e.socket ?? null,
    ram_type: e.ramType ?? null,
    form_factor: e.formFactor ?? null,
    case_supports: e.caseSupports ?? null,
    wattage: e.wattage ?? null,
    capacity_gb: e.capacityGb ?? null,
    upscaling: e.upscaling ?? null,
    source: e.source,
    updated_at: new Date().toISOString(),
  };
}

function lerCatalogo() {
  try {
    const json = JSON.parse(readFileSync(CATALOGO_URL, "utf8"));
    return json.pecas ?? {};
  } catch (e) {
    console.error(`❌ Não consegui ler scripts/data/specs-catalogo.json: ${e.message}`);
    process.exit(1);
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("❌ Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  const catalogo = lerCatalogo();

  const { data: produtos, error: erroProdutos } = await db
    .from("products")
    .select("id, slug, name, category")
    .order("category")
    .order("name");
  if (erroProdutos) {
    console.error("❌ Erro lendo products:", erroProdutos.message);
    process.exit(1);
  }

  const { data: specs, error: erroSpecs } = await db.from("part_specs").select("product_id");
  if (erroSpecs) {
    console.error("❌ Erro lendo part_specs (rodou supabase/schema-builder.sql?):", erroSpecs.message);
    process.exit(1);
  }

  const comSpec = new Set((specs ?? []).map((s) => s.product_id));
  const semSpec = (produtos ?? []).filter((p) => !comSpec.has(p.id));
  console.log(
    `🔎 ${produtos?.length ?? 0} produtos, ${semSpec.length} sem spec${DRY_RUN ? " (DRY-RUN: nada será gravado)" : ""}.`
  );

  const linhas = [];
  const faltando = [];
  const invalidos = [];
  for (const p of semSpec) {
    const entrada = catalogo[p.slug];
    if (!entrada) {
      faltando.push(p);
      continue;
    }
    const erros = validar(p.slug, entrada, p.category);
    if (erros.length) {
      invalidos.push(erros.join(" "));
      continue;
    }
    linhas.push(paraLinha(p.id, entrada));
    console.log(`✅ ${p.slug} (${p.category}) — fonte: ${entrada.source}`);
  }

  if (linhas.length && !DRY_RUN) {
    const { error } = await db.from("part_specs").upsert(linhas, { onConflict: "product_id" });
    if (error) {
      console.error("❌ Erro gravando part_specs:", error.message);
      process.exit(1);
    }
  }

  if (invalidos.length) {
    console.log(`\n⚠️  ${invalidos.length} entradas do JSON com problema (não gravadas):`);
    for (const linha of invalidos) console.log(`   - ${linha}`);
  }
  if (faltando.length) {
    console.log(`\n📝 ${faltando.length} peças sem spec no catálogo — preencha em scripts/data/specs-catalogo.json:`);
    for (const p of faltando) console.log(`   - ${p.slug} (${p.category}) — ${p.name}`);
  }

  // TODO(V2-A): opção --atualizar para regravar também quem já tem spec quando
  // o JSON mudar (hoje só preenchemos as lacunas, para não sobrescrever o banco).
  console.log(
    `\nFim. ${DRY_RUN ? "Gravaria" : "Gravadas"}: ${linhas.length} · Inválidas: ${invalidos.length} · Faltando: ${faltando.length}`
  );
}

main();
