"use client";

// Slider com rótulos nas duas pontas (ex.: Desempenho <-> Estética).
// Os rótulos das pontas ficam ligados ao controle por `aria-describedby` (A11Y-12).

export function Slider({
  id,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 5,
  label,
  leftLabel,
  rightLabel,
  valueLabel,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  leftLabel: string;
  rightLabel: string;
  /** Texto que descreve a posição atual (ex.: "Equilibrado"). */
  valueLabel?: string;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {valueLabel && <span className="text-xs text-ink-muted">{valueLabel}</span>}
      </div>
      <input
        id={id}
        type="range"
        className="slider mt-2"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={valueLabel}
        aria-describedby={`${id}-pontas`}
        style={{ ["--fill" as string]: `${fill}%` }}
      />
      <div id={`${id}-pontas`} className="mt-1 flex justify-between text-xs text-ink-faint">
        <span>
          {leftLabel}
          <span className="sr-only"> à esquerda,</span>
        </span>
        <span>
          {rightLabel}
          <span className="sr-only"> à direita</span>
        </span>
      </div>
    </div>
  );
}
