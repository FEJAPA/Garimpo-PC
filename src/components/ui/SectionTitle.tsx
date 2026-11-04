// Título de seção com descrição opcional e uma ação à direita.

import type { ReactNode } from "react";

export function SectionTitle({
  title,
  description,
  action,
  as: Tag = "h2",
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  const size = Tag === "h1" ? "text-3xl sm:text-4xl" : Tag === "h2" ? "text-xl sm:text-2xl" : "text-base";
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-2 ${className}`}>
      <div className="min-w-0">
        <Tag className={`font-display font-semibold tracking-tight text-ink ${size}`}>{title}</Tag>
        {description && <p className="mt-1 max-w-[65ch] text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
