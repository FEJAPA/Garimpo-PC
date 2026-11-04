"use client";

// Campos de formulário: rótulo + ajuda + erro, e o campo de dinheiro (R$).
//
// Acessibilidade (A11Y-03): a dica e o erro ganham um id, e o campo dentro do
// Field recebe `aria-describedby` apontando para eles (via contexto), então o
// leitor de tela lê a causa do erro ao focar o campo.

import { createContext, useContext, type InputHTMLAttributes, type ReactNode } from "react";

type FieldContextValue = { describedBy?: string; invalid: boolean };
const FieldContext = createContext<FieldContextValue>({ invalid: false });

/** Ids da dica e do erro de um Field, para quem precisar ligar outro controle a eles. */
export function fieldMessageIds(htmlFor: string) {
  return { hint: `${htmlFor}-dica`, error: `${htmlFor}-erro` };
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  const ids = fieldMessageIds(htmlFor);
  const describedBy = error ? ids.error : hint ? ids.hint : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      <FieldContext.Provider value={{ describedBy, invalid: Boolean(error) }}>{children}</FieldContext.Provider>
      {error ? (
        <p id={ids.error} className="text-xs text-bad" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={ids.hint} className="text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Classes do campo de texto. Foco visível: anel `brand` sólido de 2px (DESIGN.md, CON-08). */
export const INPUT_CLASSES =
  "h-10 w-full rounded-control border border-line-strong bg-surface-2 px-3 text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ink-faint hover:border-ink-faint focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 aria-invalid:border-bad aria-invalid:focus-visible:ring-bad";

type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> & {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
};

/** Campo numérico com prefixo "R$". O valor é texto para a pessoa digitar livremente. */
export function MoneyInput({ value, onChange, invalid, className = "", ...rest }: MoneyInputProps) {
  const field = useContext(FieldContext);
  const isInvalid = invalid ?? field.invalid;
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-faint">
        R$
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={isInvalid || undefined}
        aria-describedby={field.describedBy}
        className={`${INPUT_CLASSES} tnum pl-10 ${className}`}
        {...rest}
      />
    </div>
  );
}
