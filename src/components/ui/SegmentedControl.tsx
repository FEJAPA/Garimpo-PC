"use client";

// Controle segmentado (escolha única entre poucas opções), ex.: "Jogos / Trabalho / Criação".
// Semântica de grupo de rádio: role="radiogroup" + role="radio" com aria-checked.
// Teclado: Tab entra na opção marcada; setas mudam a escolha (roving tabindex).

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  /** Texto curto que explica a opção (vai como dica e para leitores de tela). */
  hint?: string;
};

export function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
  description,
  name,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  /** Texto de ajuda abaixo do controle (muda com a opção, por exemplo). */
  description?: ReactNode;
  /** Prefixo dos ids (útil em testes); padrão: id automático. */
  name?: string;
}) {
  const autoId = useId();
  const base = name ?? autoId;
  const labelId = `${base}-rotulo`;
  const descId = `${base}-descricao`;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  function mover(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    else return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div>
      <p id={labelId} className="text-sm font-medium text-ink">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={description ? descId : undefined}
        className="mt-2 grid auto-cols-fr grid-flow-col gap-1 rounded-control border border-line-strong bg-surface-2 p-1"
      >
        {options.map((opt, i) => {
          const checked = i === current;
          return (
            <button
              key={opt.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              title={opt.hint}
              onClick={() => onChange(opt.value)}
              onKeyDown={(e) => mover(e, i)}
              className={`min-h-8 rounded-[4px] px-2 py-1 text-sm font-medium transition-colors duration-150 ease-out ${
                checked ? "bg-brand text-brand-ink" : "text-ink-muted hover:bg-surface-3 hover:text-ink"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {description && (
        <p id={descId} className="mt-1.5 text-xs text-ink-faint">
          {description}
        </p>
      )}
    </div>
  );
}
