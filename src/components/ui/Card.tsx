// Cartão: a superfície padrão para agrupar conteúdo. Nunca aninhar cartões.

import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padding?: "none" | "sm" | "md" | "lg";
  children: ReactNode;
};

const PADDING = { none: "", sm: "p-4", md: "p-5", lg: "p-6 sm:p-7" };

export function Card({ padding = "md", className = "", children, ...rest }: CardProps) {
  return (
    <div className={`rounded-card border border-line bg-surface ${PADDING[padding]} ${className}`} {...rest}>
      {children}
    </div>
  );
}
