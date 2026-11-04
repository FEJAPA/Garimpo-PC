// Link de compartilhamento do Montador: /montar?b=<código>.
//
// O código é base64url de um JSON compacto com as preferências e as peças
// escolhidas (slug + loja). Ao abrir o link, a tela restaura as preferências e
// monta de novo com os preços de hoje. decodeBuild é tolerante: qualquer código
// estranho vira null (a tela simplesmente ignora).

import type { BuildPart, BuildPreferences, Resolution, UsageProfile } from "@/models/builder-types";
import { categoryLabel } from "@/models/categories";
import { MAX_MONEY } from "./money";

export type SharedPart = { slug: string; storeId: string };
export type SharedBuild = { prefs: BuildPreferences; parts: SharedPart[] };

const VERSION = 1;
/** Limites para não aceitar códigos gigantes (URL) nem listas absurdas. */
const MAX_CODE_LENGTH = 4000;
const MAX_PARTS = 30;
const MAX_ID_LENGTH = 120;

const USAGES: UsageProfile[] = ["jogos", "trabalho", "criacao"];
const RESOLUTIONS: Resolution[] = ["1080p", "1440p"];

type Compact = {
  v: number;
  t: number;
  c: number;
  o: 0 | 1;
  a: number;
  u?: UsageProfile;
  r?: Resolution;
  p: [string, string][];
};

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(code: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(code)) return null;
  try {
    const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function encodeBuild(prefs: BuildPreferences, parts: SharedPart[]): string {
  const compact: Compact = {
    v: VERSION,
    t: prefs.budget.target,
    c: prefs.budget.hardCap,
    o: prefs.trustedOnly ? 1 : 0,
    a: prefs.aesthetics,
    p: parts.map((p) => [p.slug, p.storeId]),
  };
  if (prefs.usage) compact.u = prefs.usage;
  if (prefs.resolution) compact.r = prefs.resolution;
  return toBase64Url(JSON.stringify(compact));
}

function dinheiroOk(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 && n <= MAX_MONEY;
}

function idOk(s: unknown): s is string {
  return typeof s === "string" && s.length > 0 && s.length <= MAX_ID_LENGTH;
}

export function decodeBuild(code: string): SharedBuild | null {
  if (typeof code !== "string" || code.length === 0 || code.length > MAX_CODE_LENGTH) return null;
  const json = fromBase64Url(code);
  if (json === null) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as Record<string, unknown>;

  if (d.v !== VERSION) return null;
  if (!dinheiroOk(d.t) || !dinheiroOk(d.c)) return null;
  if (typeof d.a !== "number" || !Number.isFinite(d.a)) return null;
  if (!Array.isArray(d.p) || d.p.length > MAX_PARTS) return null;

  const parts: SharedPart[] = [];
  for (const item of d.p) {
    if (!Array.isArray(item) || item.length !== 2 || !idOk(item[0]) || !idOk(item[1])) return null;
    parts.push({ slug: item[0], storeId: item[1] });
  }

  const prefs: BuildPreferences = {
    budget: { target: d.t, hardCap: d.c },
    trustedOnly: d.o !== 0,
    aesthetics: Math.min(100, Math.max(0, Math.round(d.a))),
  };
  if (USAGES.includes(d.u as UsageProfile)) prefs.usage = d.u as UsageProfile;
  if (RESOLUTIONS.includes(d.r as Resolution)) prefs.resolution = d.r as Resolution;

  return { prefs, parts };
}

/**
 * URL externa segura (só http e https) ou null (SEG-04). Use antes de qualquer
 * `href` vindo de dados (link de loja). Reexportada por components/ui/Button.
 */
export function safeHref(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (trimmed === "") return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

// --- Lista de compras (CSV) ---

/** Número em reais para planilha brasileira: 1899.9 -> "1899,90". */
function reaisCsv(valor: number): string {
  return (Math.round(valor * 100) / 100).toFixed(2).replace(".", ",");
}

/** Escapa uma célula: aspas quando precisa e neutraliza fórmulas (=, +, -, @). */
function celula(valor: string): string {
  let v = valor;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * Lista de compras em CSV (separador ";" e vírgula decimal, como o Excel em
 * português abre por padrão). Começa com BOM para manter os acentos.
 */
export function shoppingListCsv(parts: BuildPart[]): string {
  const linhas: string[][] = [["Categoria", "Peça", "Loja", "Preço Pix (R$)", "Parcelado (R$)", "Parcelas", "Link"]];
  let totalPix = 0;
  let totalParcelado = 0;
  for (const part of parts) {
    const { offer } = part;
    const temParcelado = Boolean(offer.price_installment && offer.price_installment > 0 && offer.installment_count);
    const parcelado = temParcelado ? (offer.price_installment as number) : offer.price_pix;
    totalPix += offer.price_pix;
    totalParcelado += parcelado;
    linhas.push([
      categoryLabel(part.category),
      part.product.name,
      offer.store.name,
      reaisCsv(offer.price_pix),
      reaisCsv(parcelado),
      String(temParcelado ? offer.installment_count : 1),
      safeHref(offer.url) ?? "",
    ]);
  }
  linhas.push(["Total", "", "", reaisCsv(totalPix), reaisCsv(totalParcelado), "", ""]);
  return "\uFEFF" + linhas.map((l) => l.map(celula).join(";")).join("\r\n") + "\r\n";
}
