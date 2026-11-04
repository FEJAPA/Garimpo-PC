// Selo de confiabilidade de uma loja: nome, selo "oficial" e nota com estrelas.
// É um dos diferenciais do produto (anti-golpe).

import { BadgeCheck, Star } from "lucide-react";
import type { Store } from "@/models/types";
import { trustLabel } from "@/lib/format";
import { Badge, type BadgeTone } from "./ui/Badge";

function tomDaNota(rating: number): BadgeTone {
  if (rating >= 4) return "good";
  if (rating >= 3) return "warn";
  return "bad";
}

export function StoreBadge({ store, showLabel = false }: { store: Store; showLabel?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-sm">
      <span className="font-medium text-ink">{store.name}</span>
      {store.is_official && (
        <Badge tone="brand" title="Loja oficial verificada por nós">
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
          Oficial
        </Badge>
      )}
      <Badge tone={tomDaNota(store.rating)} title={`${store.rating_count.toLocaleString("pt-BR")} avaliações`}>
        <Star className="h-3 w-3 fill-current" aria-hidden />
        <span className="tnum">{store.rating.toFixed(1)}</span>
        {showLabel && <span className="opacity-80">· {trustLabel(store.rating)}</span>}
      </Badge>
    </span>
  );
}
