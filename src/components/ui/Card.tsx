// Cartão: a superfície padrão para agrupar conteúdo. Nunca aninhar cartões.

import type { ComponentPropsWithRef, ReactNode } from "react";

// React 19: `ref` é uma prop comum e vai para o <div> junto com o resto.
type CardProps = ComponentPropsWithRef<"div"> & {
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
