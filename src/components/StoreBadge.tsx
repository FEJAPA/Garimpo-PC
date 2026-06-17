// Selo de confiabilidade de uma loja: mostra a nota, nº de avaliações e se é
// uma loja oficial/curada. É um dos diferenciais do produto (anti-golpe).

import type { Store } from "@/models/types";
import { trustLabel } from "@/lib/format";

function corDaNota(rating: number): string {
  if (rating >= 4.5) return "bg-good-soft text-good ring-good/30";
  if (rating >= 4) return "bg-good-soft text-good ring-good/20";
  if (rating >= 3) return "bg-warn-soft text-warn ring-warn/30";
  return "bg-bad-soft text-bad ring-bad/30";
}

export function StoreBadge({ store, showLabel = false }: { store: Store; showLabel?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-sm">
      <span className="font-medium text-ink">{store.name}</span>
      {store.is_official && (
        <span
          className="inline-flex items-center rounded-full bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand-strong ring-1 ring-brand/30"
          title="Loja oficial verificada por nós"
        >
          ✓ Oficial
        </span>
      )}
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${corDaNota(
          store.rating
        )}`}
        title={`${store.rating_count.toLocaleString("pt-BR")} avaliações`}
      >
        ★ {store.rating.toFixed(1)}
        {showLabel && <span className="ml-1 opacity-80">· {trustLabel(store.rating)}</span>}
      </span>
    </span>
  );
}
