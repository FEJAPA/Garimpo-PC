// Selo de confiabilidade de uma loja: nome, selo "oficial" e nota com estrelas.
// É um dos diferenciais do produto (anti-golpe).
//
// Uma régua só (V2, LOG-17): cor e rótulo ("Confiável", "Não verificada",
// "Bloqueada") vêm de storeTrust, a mesma regra do filtro do Montador. A nota
// continua visível como número, mas não decide mais o tom sozinha.
//
// Os motivos da confiança aparecem no `title` (dica ao passar o mouse, que não
// funciona no toque) e num texto só para leitores de tela; o rótulo é texto
// visível quando `showLabel` está ligado.

import { BadgeCheck, ShieldAlert, Star } from "lucide-react";
import type { Store } from "@/models/types";
import { trustLabel } from "@/lib/format";
import { storeTrust, trustLevel, type TrustLevel } from "@/services/builder/trust";
import { Badge, type BadgeTone } from "./ui/Badge";

const TOM_POR_NIVEL: Record<TrustLevel, BadgeTone> = {
  trusted: "good",
  unverified: "warn",
  blocked: "bad",
};

/** Nota com uma casa e vírgula ("4,8"), igual aos motivos ao lado ("Nota 4,8"). S-21. */
function notaBR(nota: number): string {
  return nota.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function StoreBadge({
  store,
  showLabel = false,
  announceReasons = true,
}: {
  store: Store;
  /** Mostra o rótulo de confiança ("Confiável", "Não verificada") ao lado da nota. */
  showLabel?: boolean;
  /** Lê os motivos para leitores de tela. Desligue quando a página já mostra a lista visível. */
  announceReasons?: boolean;
}) {
  const trust = storeTrust(store);
  const nivel = trustLevel(store);
  const resumo = `${trust.trusted ? "Loja confiável" : "Loja não marcada como confiável"}: ${trust.reasons.join("; ")}`;
  // A nota pode chegar como texto do banco; Number() evita quebrar a formatação.
  const nota = Number(store.rating);
  const avaliacoes = Number(store.rating_count);

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-sm" title={resumo}>
      <span className="font-medium text-ink">{store.name}</span>
      {store.blocked && (
        <Badge tone="bad">
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
          Bloqueada
        </Badge>
      )}
      {store.is_official && !store.blocked && (
        <Badge tone="brand" title="Loja oficial verificada por nós">
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
          Oficial
        </Badge>
      )}
      <Badge
        tone={TOM_POR_NIVEL[nivel]}
        title={Number.isFinite(avaliacoes) ? `${avaliacoes.toLocaleString("pt-BR")} avaliações` : undefined}
      >
        <Star className="h-3 w-3 fill-current" aria-hidden />
        <span className="tnum">{Number.isFinite(nota) ? notaBR(nota) : "–"}</span>
        {showLabel && !store.blocked && <span className="opacity-80">· {trustLabel(store)}</span>}
      </Badge>
      {announceReasons && <span className="sr-only">{resumo}</span>}
    </span>
  );
}
