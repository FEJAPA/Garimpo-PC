// Aviso em linha (informação, atenção, erro, sucesso). Sempre com ícone + texto.

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

export type CalloutTone = "info" | "warn" | "bad" | "good";

const STYLES: Record<CalloutTone, { box: string; icon: typeof Info }> = {
  info: { box: "border-line bg-surface-2 text-ink-muted", icon: Info },
  warn: { box: "border-warn/30 bg-warn-soft text-warn", icon: AlertTriangle },
  bad: { box: "border-bad/30 bg-bad-soft text-bad", icon: XCircle },
  good: { box: "border-good/30 bg-good-soft text-good", icon: CheckCircle2 },
};

export function Callout({
  tone = "info",
  title,
  children,
  className = "",
}: {
  tone?: CalloutTone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = STYLES[tone];
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={`flex gap-3 rounded-card border px-4 py-3 text-sm ${box} ${className}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? "mt-0.5" : ""}>{children}</div>
      </div>
    </div>
  );
}
