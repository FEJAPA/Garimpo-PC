// Serviço de especificações técnicas das peças (V2, pacote A1).
//
// O Montador precisa de uma spec (perf, socket, DDR, watts...) para cada peça.
// Quando o Supabase está configurado e a tabela part_specs tem linhas, lemos de
// lá; em qualquer outro caso (sem banco, erro de rede, tabela ainda vazia)
// devolvemos PART_SPECS (mock da V1). Assim o modo de demonstração continua
// funcionando e um banco recém-criado não "zera" o Montador.

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
  product: { slug: string; category: string } | null;
};

/**
 * Converte uma linha do banco (snake_case) em PartSpec (camelCase).
 * Colunas nulas viram campos AUSENTES (não `undefined` explícito), para a spec
 * do banco ser idêntica à do mock e o algoritmo tratar as duas igual.
 * Devolve null se a linha não tiver produto associado (não há slug para chavear).
 */
export function rowToPartSpec(row: PartSpecRow): PartSpec | null {
  if (!row.product?.slug) return null;

  const spec: PartSpec = {
    slug: row.product.slug,
    // TODO(V2-A): validar a categoria contra CATEGORIES; hoje confiamos no banco.
    category: row.product.category as Category,
    perf: Number(row.perf),
    aesthetics: row.aesthetics,
  };
  if (row.tdp != null) spec.tdp = row.tdp;
  if (row.socket != null) spec.socket = row.socket as Socket;
  if (row.ram_type != null) spec.ramType = row.ram_type as RamType;
  if (row.form_factor != null) spec.formFactor = row.form_factor as FormFactor;
  if (row.case_supports != null) spec.caseSupports = row.case_supports as FormFactor[];
  if (row.wattage != null) spec.wattage = row.wattage;
  if (row.capacity_gb != null) spec.capacityGb = row.capacity_gb;
  if (row.upscaling != null) spec.upscaling = row.upscaling as PartSpec["upscaling"];
  if (row.source != null) spec.source = row.source;
  return spec;
}

/** Specs de todas as peças, chaveadas pelo slug do produto. */
export async function getPartSpecs(): Promise<Record<string, PartSpec>> {
  const supabase = getSupabase();
  if (!supabase) return PART_SPECS;

  const { data, error } = await supabase
    .from("part_specs")
    .select("*, product:products(slug, category)");

  if (error) {
    console.error("Erro ao buscar specs no Supabase (usando o mock):", error.message);
    return PART_SPECS;
  }

  const specs: Record<string, PartSpec> = {};
  for (const row of (data ?? []) as PartSpecRow[]) {
    const spec = rowToPartSpec(row);
    if (spec) specs[spec.slug] = spec;
  }

  // Tabela vazia = banco criado mas seed-builder.sql ainda não rodou.
  if (Object.keys(specs).length === 0) return PART_SPECS;
  return specs;
}
