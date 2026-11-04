// Serviço de especificações técnicas das peças (V2, pacote A1).
//
// O Montador precisa de uma spec (perf, socket, DDR, watts...) para cada peça.
// Regra do AGENTS.md ("dado ilustrativo nunca vira fato no modo real"):
//   - SEM Supabase configurado (modo de demonstração) -> PART_SPECS, o mock da V1;
//   - COM Supabase, erro de consulta ou tabela vazia -> {} (a tela avisa que faltam
//     specs). Nunca devolvemos o mock por cima de produtos reais: isso mostraria
//     socket, watts e desempenho inventados como se fossem fatos.
//
// Linhas do banco inválidas ou incompletas são descartadas e contadas no log
// (ver rowToPartSpec): uma spec ruim faria o Montador juntar peças incompatíveis
// (LOG-02) ou mostrar um FPS falso (LOG-16).

import { getSupabase } from "@/models/supabase";
import { PART_SPECS } from "@/models/part-specs";
import type { Category } from "@/models/types";
import type { FormFactor, PartSpec, RamType, Socket } from "@/models/builder-types";

/** Uma linha de part_specs como vem do Supabase, já com o join em products. */
export type PartSpecRow = {
  product_id: string;
  // numeric(6,1) chega como string pelo PostgREST; aceitamos os dois.
  perf: number | string;
  aesthetics: number;
  tdp: number | null;
  socket: string | null;
  ram_type: string | null;
  form_factor: string | null;
  case_supports: string[] | null;
  wattage: number | null;
  capacity_gb: number | null;
  upscaling: string[] | null;
  source: string | null;
  /**
   * Categoria gravada na própria part_specs, se a tabela vier a ter essa coluna
   * (hoje não tem: a categoria vem do produto). Se existir e for diferente da do
   * produto, a linha é descartada: spec de uma categoria colada em outra peça.
   * TODO(V2-A): decidir se part_specs ganha a coluna `category` (com CHECK).
   */
  category?: string | null;
  product: { slug: string; category: string } | null;
};

/** As sete categorias válidas. Typed como Record para o TS exigir todas se uma nova entrar em Category. */
const CATEGORIAS_VALIDAS: Record<Category, true> = {
  gpu: true,
  cpu: true,
  ram: true,
  ssd: true,
  motherboard: true,
  psu: true,
  case: true,
};

function ehCategoria(valor: unknown): valor is Category {
  return typeof valor === "string" && Object.hasOwn(CATEGORIAS_VALIDAS, valor);
}

/** Converte para número sem aceitar null/""/booleano (Number(null) seria 0, e passaria por "número"). */
function paraNumero(valor: unknown): number {
  if (typeof valor === "number") return valor;
  if (typeof valor === "string" && valor.trim() !== "") return Number(valor);
  return NaN;
}

const ehPositivo = (n: number | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

/**
 * Campos obrigatórios por categoria. É a MESMA lista de `hasRequiredSpec` em
 * src/services/builder/compatibility.ts (duplicada aqui de propósito, para este
 * serviço não depender daquele arquivo). Se mudar lá, mude aqui e em
 * `validar` de scripts/collect-specs.mjs:
 *   gpu          -> tdp
 *   cpu          -> tdp, socket
 *   motherboard  -> socket, ramType, formFactor
 *   ram          -> ramType
 *   case         -> caseSupports (não vazio)
 *   psu          -> wattage (> 0)
 *   ssd          -> nada além do básico (perf > 0, aesthetics 0..100)
 * Devolve os nomes dos campos que faltam (lista vazia = completa).
 */
function camposFaltando(spec: PartSpec): string[] {
  const falta: string[] = [];
  switch (spec.category) {
    case "gpu":
      if (!ehPositivo(spec.tdp)) falta.push("tdp");
      break;
    case "cpu":
      if (!ehPositivo(spec.tdp)) falta.push("tdp");
      if (!spec.socket) falta.push("socket");
      break;
    case "motherboard":
      if (!spec.socket) falta.push("socket");
      if (!spec.ramType) falta.push("ramType");
      if (!spec.formFactor) falta.push("formFactor");
      break;
    case "ram":
      if (!spec.ramType) falta.push("ramType");
      break;
    case "case":
      if (!spec.caseSupports?.length) falta.push("caseSupports");
      break;
    case "psu":
      if (!ehPositivo(spec.wattage)) falta.push("wattage");
      break;
    case "ssd":
      break;
  }
  return falta;
}

/** Resultado da conversão: a spec, ou o motivo de a linha ter sido descartada. */
type Conversao = { spec: PartSpec } | { motivo: string };

/** Faz a conversão e a validação; `rowToPartSpec` e `getPartSpecs` usam esta função. */
function converterLinha(row: PartSpecRow): Conversao {
  const slug = row.product?.slug;
  if (!slug) return { motivo: "sem produto associado" };

  const categoria = row.product?.category;
  if (!ehCategoria(categoria)) return { motivo: `categoria desconhecida ("${String(categoria)}")` };
  if (row.category != null && row.category !== categoria)
    return { motivo: `categoria da spec ("${row.category}") diferente da do produto ("${categoria}")` };

  const perf = paraNumero(row.perf);
  if (!ehPositivo(perf)) return { motivo: `perf inválido (${String(row.perf)})` };

  const aesthetics = paraNumero(row.aesthetics);
  if (!Number.isFinite(aesthetics) || aesthetics < 0 || aesthetics > 100)
    return { motivo: `aesthetics fora de 0 a 100 (${String(row.aesthetics)})` };

  // Colunas nulas viram campos AUSENTES (não `undefined` explícito), para a spec
  // do banco ser idêntica à do mock e o algoritmo tratar as duas igual.
  const spec: PartSpec = { slug, category: categoria, perf, aesthetics };
  const tdp = paraNumero(row.tdp);
  if (ehPositivo(tdp)) spec.tdp = tdp;
  if (row.socket != null) spec.socket = row.socket as Socket;
  if (row.ram_type != null) spec.ramType = row.ram_type as RamType;
  if (row.form_factor != null) spec.formFactor = row.form_factor as FormFactor;
  if (row.case_supports != null) spec.caseSupports = row.case_supports as FormFactor[];
  const wattage = paraNumero(row.wattage);
  if (ehPositivo(wattage)) spec.wattage = wattage;
  const capacidade = paraNumero(row.capacity_gb);
  if (ehPositivo(capacidade)) spec.capacityGb = capacidade;
  if (row.upscaling != null) spec.upscaling = row.upscaling as PartSpec["upscaling"];
  if (row.source != null) spec.source = row.source;

  const falta = camposFaltando(spec);
  if (falta.length > 0) return { motivo: `faltam campos obrigatórios de ${categoria}: ${falta.join(", ")}` };
  return { spec };
}

/**
 * Converte uma linha do banco (snake_case) em PartSpec (camelCase).
 * Devolve null (a linha deve ser ignorada) quando:
 *   - não há produto associado (não há slug para chavear);
 *   - a categoria é desconhecida ou diferente da do produto (LOG-03);
 *   - `perf` não é finito ou é <= 0 (LOG-16: NaN viraria FPS falso);
 *   - `aesthetics` está fora de 0 a 100;
 *   - faltam os campos obrigatórios da categoria (LOG-02).
 */
export function rowToPartSpec(row: PartSpecRow): PartSpec | null {
  const conversao = converterLinha(row);
  return "spec" in conversao ? conversao.spec : null;
}

/** Quantos descartes detalhamos no log (o resto vira "e mais N"), para ele não ficar enorme. */
const MAX_DESCARTES_NO_LOG = 5;

/** Specs de todas as peças, chaveadas pelo slug do produto. */
export async function getPartSpecs(): Promise<Record<string, PartSpec>> {
  const supabase = getSupabase();
  if (!supabase) return PART_SPECS; // modo de demonstração

  const { data, error } = await supabase
    .from("part_specs")
    .select("*, product:products(slug, category)");

  if (error) {
    console.error("Erro ao buscar specs no Supabase (devolvendo vazio, sem mock):", error.message);
    return {};
  }

  const linhas = (data ?? []) as PartSpecRow[];
  if (linhas.length === 0) {
    // Banco criado, mas ainda sem specs: rode supabase/seed-builder.sql ou `npm run collect:specs`.
    console.warn("Tabela part_specs vazia: o Montador fica sem peças até as specs serem cadastradas.");
    return {};
  }

  const specs: Record<string, PartSpec> = {};
  const descartes: string[] = [];
  for (const row of linhas) {
    const conversao = converterLinha(row);
    if ("spec" in conversao) specs[conversao.spec.slug] = conversao.spec;
    else descartes.push(`${row.product?.slug ?? row.product_id} (${conversao.motivo})`);
  }

  if (descartes.length > 0) {
    const mostrados = descartes.slice(0, MAX_DESCARTES_NO_LOG).join("; ");
    const resto = descartes.length - MAX_DESCARTES_NO_LOG;
    console.warn(
      `${descartes.length} spec(s) de part_specs ignorada(s) por dados inválidos ou incompletos: ${mostrados}${
        resto > 0 ? `; e mais ${resto}` : ""
      }`
    );
  }
  return specs;
}
