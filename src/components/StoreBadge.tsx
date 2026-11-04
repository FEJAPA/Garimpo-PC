// Selo de confiabilidade de uma loja: nome, selo "oficial" e nota com estrelas.
// É um dos diferenciais do produto (anti-golpe).
//
// V2 (pacote C): os motivos da confiança (storeTrust) aparecem no `title`
// (dica ao passar o mouse) e num texto só para leitores de tela.

import { BadgeCheck, ShieldAlert, Star } from "lucide-react";
import type { Store } from "@/models/types";
import { trustLabel } from "@/lib/format";
import { storeTrust } from "@/services/builder/trust";
import { Badge, type BadgeTone } from "./ui/Badge";

function tomDaNota(rating: number): BadgeTone {
  if (rating >= 4) return "good";
  if (rating >= 3) return "warn";
  return "bad";
}

export function StoreBadge({
  store,
  showLabel = false,
  announceReasons = true,
}: {
  store: Store;
  showLabel?: boolean;
  /** Lê os motivos para leitores de tela. Desligue quando a página já mostra a lista visível. */
  announceReasons?: boolean;
}) {
  const trust = storeTrust(store);
  const resumo = `${trust.trusted ? "Loja confiável" : "Loja não marcada como confiável"}: ${trust.reasons.join("; ")}`;

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
      <Badge tone={tomDaNota(store.rating)} title={`${store.rating_count.toLocaleString("pt-BR")} avaliações`}>
        <Star className="h-3 w-3 fill-current" aria-hidden />
        <span className="tnum">{store.rating.toFixed(1)}</span>
        {showLabel && !store.blocked && <span className="opacity-80">· {trustLabel(store.rating)}</span>}
      </Badge>
      {announceReasons && <span className="sr-only">{resumo}</span>}
    </span>
  );
}
