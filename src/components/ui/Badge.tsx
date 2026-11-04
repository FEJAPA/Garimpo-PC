// Selo pequeno (categoria, estado). Tons semânticos sempre vêm com texto.

import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "good" | "warn" | "bad" | "brand";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-3 text-ink-muted",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  brand: "bg-brand-soft text-brand",
};

export function Badge({
  tone = "neutral",
  className = "",
  children,
  title,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
