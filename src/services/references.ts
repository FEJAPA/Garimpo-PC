// Computadores de referência para a estimativa de desempenho (V2, pacote D).
// Se o Supabase estiver configurado e a tabela reference_builds tiver dados,
// usa o banco; senão (ou em erro), usa a lista local REFERENCE_BUILDS. Mesmo
// padrão de src/services/products.ts.

import { getSupabase } from "@/models/supabase";
import { REFERENCE_BUILDS } from "@/models/reference-builds";
import type { GameProfile, ReferenceBuild, Resolution } from "@/models/builder-types";

const PERFIS: GameProfile[] = ["esports", "aaa-medio", "aaa-pesado"];
const RESOLUCOES: Resolution[] = ["1080p", "1440p"];

/** Linha da tabela reference_builds como o Supabase devolve (numeric pode vir como texto). */
export type ReferenceBuildRow = {
  id: string;
  name: string;
  description: string | null;
  parts: string | null;
  approx_price: number | string | null;
  score: number | string;
  fps: unknown;
  /** Coluna nova (ver supabase/seed-references.sql); pode não existir ainda. */
  ram_gb?: number | string | null;
  source: string | null;
  /** Coluna `date`: "AAAA-MM-DD". */
  measured_at: string | null;
};

type FpsTable = ReferenceBuild["fps"];

/** Confere se o jsonb tem todos os perfis × resoluções com números. */
function fpsValido(fps: unknown): fps is FpsTable {
  if (!fps || typeof fps !== "object") return false;
  const tabela = fps as Record<string, Record<string, unknown> | undefined>;
  return PERFIS.every((p) => RESOLUCOES.every((r) => typeof tabela[p]?.[r] === "number"));
}

function lerFps(fps: unknown): unknown {
  if (typeof fps !== "string") return fps;
  try {
    return JSON.parse(fps);
  } catch {
    return null;
  }
}

/**
 * Converte uma linha do banco para ReferenceBuild: snake_case → camelCase,
 * numeric → number e measured_at "AAAA-MM-DD" → "AAAA-MM". Lança erro se o
 * `fps` não estiver completo (quem chama descarta a linha).
 */
export function mapReferenceRow(row: ReferenceBuildRow): ReferenceBuild {
  const fps = lerFps(row.fps);
  if (!fpsValido(fps)) throw new Error(`fps inválido na referência "${row.id}"`);

  const ref: ReferenceBuild = {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    parts: row.parts ?? "",
    approxPrice: Number(row.approx_price ?? 0),
    score: Number(row.score),
    fps,
  };
  if (row.ram_gb !== null && row.ram_gb !== undefined) ref.ramGb = Number(row.ram_gb);
  if (row.source) ref.source = row.source;
  if (row.measured_at) ref.measuredAt = row.measured_at.slice(0, 7);
  return ref;
}

/** Referências ordenadas por score (crescente). Nunca devolve lista vazia. */
export async function getReferenceBuilds(): Promise<ReferenceBuild[]> {
  const supabase = getSupabase();
  if (!supabase) return REFERENCE_BUILDS;

  const { data, error } = await supabase
    .from("reference_builds")
    .select("*")
    .order("score", { ascending: true });

  if (error) {
    console.error("Erro ao buscar referências no Supabase:", error.message);
    return REFERENCE_BUILDS;
  }

  const refs: ReferenceBuild[] = [];
  for (const row of (data ?? []) as ReferenceBuildRow[]) {
    try {
      refs.push(mapReferenceRow(row));
    } catch (e) {
      console.error("Referência ignorada:", (e as Error).message);
    }
  }
  if (refs.length === 0) return REFERENCE_BUILDS;
  return refs.sort((a, b) => a.score - b.score);
}
