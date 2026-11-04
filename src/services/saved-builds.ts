// Montagens salvas e alerta da montagem inteira (V2, pacote G).
//
// Só lógica PURA (sem banco, sem cookies): roda no servidor (server actions e a
// rota /api/check-alerts) e também no navegador (o SaveBuildButton monta a linha
// antes de enviar). Quem fala com o Supabase são as actions e a rota.

import type { BuildPreferences, BuildSuccess, SavedBuild } from "@/models/builder-types";
import type { ProductWithOffers } from "@/models/types";
import { getBestOffer } from "@/lib/format";
import { parseMoney } from "@/lib/money";
import { isTrustedStore } from "@/services/builder/trust";

/** Limite do nome da montagem (o mesmo CHECK de supabase/schema-builder.sql). */
export const SAVED_BUILD_NAME_MAX = 60;
/** Nome usado quando a pessoa não digita nada (igual ao default da coluna). */
export const DEFAULT_BUILD_NAME = "Minha montagem";
/** Uma montagem tem 7 peças; 20 dá folga para o futuro sem aceitar listas absurdas. */
export const SAVED_BUILD_MAX_PARTS = 20;
/** Teto de qualquer preço-alvo de alerta (SEG-10): acima disso é erro de digitação. */
export const MAX_TARGET_PRICE = 1_000_000;

/** Peça como fica gravada no jsonb `saved_builds.parts`. */
export type SavedBuildRowPart = {
  productId: string;
  offerId: string;
  /** Preço Pix da oferta no momento em que a montagem foi salva. */
  price: number;
  /** Slug e loja guardados para montar o link /montar?b= sem consultar o banco. */
  slug?: string;
  storeId?: string;
};

/** Campos que a aplicação grava (id, user_id e created_at vêm do banco/sessão). */
export type SavedBuildInsert = {
  name: string;
  prefs: BuildPreferences;
  parts: SavedBuildRowPart[];
  total_pix: number;
};

/** Linha de `saved_builds` como o Supabase devolve. */
export type SavedBuildRow = SavedBuildInsert & {
  id: string;
  created_at: string;
  user_id?: string;
};

type Resultado<T> = { ok: true; value: T } | { ok: false; message: string };

/** Arredonda para centavos (somas de float como 0,1 + 0,2 não viram 0,30000000000000004). */
function centavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Número finito vindo do banco ou de JSON (numeric do Postgres pode chegar como texto). */
function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() !== "" ? valor : null;
}

/** Valida o nome: apara, junta espaços, vazio vira o padrão, até 60 caracteres. */
export function validateBuildName(
  raw: unknown,
): { ok: true; name: string } | { ok: false; message: string } {
  const nome = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (nome === "") return { ok: true, name: DEFAULT_BUILD_NAME };
  if (nome.length > SAVED_BUILD_NAME_MAX) {
    return { ok: false, message: `O nome pode ter até ${SAVED_BUILD_NAME_MAX} caracteres.` };
  }
  return { ok: true, name: nome };
}

/** BuildSuccess → linha de `saved_builds` (sem id/user_id/created_at). */
export function toSavedBuildRow(prefs: BuildPreferences, result: BuildSuccess, name: string): SavedBuildInsert {
  return {
    name,
    prefs,
    parts: result.parts.map((p) => ({
      productId: p.product.id,
      offerId: p.offer.id,
      price: p.price,
      slug: p.product.slug,
      storeId: p.offer.store_id,
    })),
    total_pix: result.totalPix,
  };
}

/** Lê uma peça do jsonb aceitando camelCase (atual) e snake_case (comentário antigo do schema). */
function lerParte(raw: unknown): SavedBuildRowPart | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const productId = texto(o.productId ?? o.product_id);
  const offerId = texto(o.offerId ?? o.offer_id);
  const price = numero(o.price);
  if (!productId || !offerId || price === null || price < 0) return null;
  const parte: SavedBuildRowPart = { productId, offerId, price };
  const slug = texto(o.slug);
  const storeId = texto(o.storeId ?? o.store_id);
  if (slug) parte.slug = slug;
  if (storeId) parte.storeId = storeId;
  return parte;
}

function lerPartes(raw: unknown): SavedBuildRowPart[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(lerParte).filter((p): p is SavedBuildRowPart => p !== null);
}

/** Linha de `saved_builds` → SavedBuild. Peças malformadas são descartadas em vez de quebrar a tela. */
export function fromSavedBuildRow(row: SavedBuildRow): SavedBuild {
  return {
    id: row.id,
    name: row.name,
    prefs: row.prefs,
    parts: lerPartes(row.parts).map(({ productId, offerId, price }) => ({ productId, offerId, price })),
    totalPix: numero(row.total_pix) ?? 0,
    createdAt: row.created_at,
  };
}

/** Slug + loja de cada peça, no formato que `encodeBuild` (src/lib/share.ts) espera. */
export function sharePartsFromRow(row: Pick<SavedBuildInsert, "parts">): { slug: string; storeId: string }[] {
  return lerPartes(row.parts)
    .filter((p) => p.slug && p.storeId)
    .map((p) => ({ slug: p.slug as string, storeId: p.storeId as string }));
}

const USOS = new Set(["jogos", "trabalho", "criacao"]);
const RESOLUCOES = new Set(["1080p", "1440p"]);

/** Valida as preferências que chegam do navegador (nunca confie no formulário). */
export function parseBuildPreferences(raw: unknown): BuildPreferences | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const budget = o.budget as Record<string, unknown> | undefined;
  const target = numero(budget?.target);
  const hardCap = numero(budget?.hardCap);
  const aesthetics = numero(o.aesthetics);
  if (target === null || hardCap === null || target <= 0 || hardCap < target || hardCap > MAX_TARGET_PRICE) {
    return null;
  }
  if (typeof o.trustedOnly !== "boolean") return null;
  if (aesthetics === null || aesthetics < 0 || aesthetics > 100) return null;
  if (o.usage !== undefined && !USOS.has(String(o.usage))) return null;
  if (o.resolution !== undefined && !RESOLUCOES.has(String(o.resolution))) return null;

  const prefs: BuildPreferences = { budget: { target, hardCap }, trustedOnly: o.trustedOnly, aesthetics };
  if (o.usage !== undefined) prefs.usage = o.usage as BuildPreferences["usage"];
  if (o.resolution !== undefined) prefs.resolution = o.resolution as BuildPreferences["resolution"];
  return prefs;
}

function lerJson(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * Lê o formulário de "Salvar montagem" (campos `name`, `prefs` e `parts` em JSON).
 * Os preços enviados são só uma referência: a action confere as ofertas no banco
 * e grava o preço Pix de lá.
 */
export function parseSavedBuildForm(
  formData: FormData,
): Resultado<{ name: string; prefs: BuildPreferences; parts: { productId: string; offerId: string; price: number }[] }> {
  const nome = validateBuildName(formData.get("name"));
  if (!nome.ok) return nome;

  const prefs = parseBuildPreferences(lerJson(formData.get("prefs")));
  if (!prefs) return { ok: false, message: "Preferências da montagem inválidas. Monte de novo e tente salvar." };

  const brutas = lerJson(formData.get("parts"));
  if (!Array.isArray(brutas) || brutas.length === 0 || brutas.length > SAVED_BUILD_MAX_PARTS) {
    return { ok: false, message: "A montagem não tem peças válidas para salvar." };
  }
  const parts = lerPartes(brutas);
  if (parts.length !== brutas.length) {
    return { ok: false, message: "A montagem não tem peças válidas para salvar." };
  }
  const ids = new Set(parts.map((p) => p.offerId));
  if (ids.size !== parts.length) {
    return { ok: false, message: "A montagem tem peças repetidas." };
  }

  return {
    ok: true,
    value: {
      name: nome.name,
      prefs,
      parts: parts.map(({ productId, offerId, price }) => ({ productId, offerId, price })),
    },
  };
}

/**
 * Preço-alvo de alerta: número positivo até R$ 1.000.000 (SEG-10). Texto é lido
 * com o mesmo parseMoney do Montador ("5.999,90", "5999.90" e "6000" valem).
 */
export function parseTargetPrice(raw: unknown): Resultado<number> {
  const valor = typeof raw === "string" ? numero(parseMoney(raw)) : numero(raw);
  if (valor === null || valor <= 0) return { ok: false, message: "Informe um preço-alvo válido." };
  if (valor > MAX_TARGET_PRICE) {
    return { ok: false, message: "O preço-alvo pode ser de no máximo R$ 1.000.000,00." };
  }
  return { ok: true, value: centavos(valor) };
}

/**
 * Total ATUAL de uma montagem salva: soma o melhor preço honesto de cada peça,
 * hoje (pode ser de outra loja que não a do dia em que foi salva).
 *
 * "Honesto" = o mesmo critério do "Melhor preço" do site (`getBestOffer`: em
 * estoque, sem preço inválido, sem loja bloqueada nem oferta suspeita). Se a
 * montagem foi salva com "só lojas confiáveis", só essas lojas contam.
 *
 * `missing` lista as peças sem oferta hoje; com alguma faltando, o total não
 * representa a montagem e a rota de alertas não avisa.
 */
export function currentBuildTotal(
  parts: SavedBuild["parts"],
  products: ProductWithOffers[],
  opts: { trustedOnly?: boolean } = {},
): { total: number; missing: string[] } {
  const porId = new Map(products.map((p) => [p.id, p]));
  let total = 0;
  const missing: string[] = [];

  for (const parte of parts) {
    const produto = porId.get(parte.productId);
    const candidato =
      produto && opts.trustedOnly
        ? { ...produto, offers: produto.offers.filter((o) => isTrustedStore(o.store)) }
        : produto;
    const melhor = candidato ? getBestOffer(candidato) : null;
    if (!melhor) {
      missing.push(parte.productId);
      continue;
    }
    total += melhor.price_pix;
  }

  return { total: centavos(total), missing };
}
