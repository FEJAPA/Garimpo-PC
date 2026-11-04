"use client";

// Campos de formulário: rótulo + ajuda + erro, e o campo de dinheiro (R$).

import type { InputHTMLAttributes, ReactNode } from "react";

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
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-bad" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export const INPUT_CLASSES =
  "h-10 w-full rounded-control border border-line-strong bg-surface-2 px-3 text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ink-faint hover:border-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:opacity-50 aria-invalid:border-bad aria-invalid:focus:ring-bad/30";

type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> & {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
};

/** Campo numérico com prefixo "R$". O valor é texto para a pessoa digitar livremente. */
export function MoneyInput({ value, onChange, invalid = false, className = "", ...rest }: MoneyInputProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-faint">
        R$
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        className={`${INPUT_CLASSES} tnum pl-10 ${className}`}
        {...rest}
      />
    </div>
  );
}
