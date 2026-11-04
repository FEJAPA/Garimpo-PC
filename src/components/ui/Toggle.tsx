"use client";

// Interruptor (switch) com rótulo e descrição. Acessível via teclado (é um botão).

export function Toggle({
  id,
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-ink-faint">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors duration-150 disabled:opacity-50 ${
          checked ? "border-brand bg-brand" : "border-line-strong bg-surface-3"
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-0.5 left-0.5 h-[18px] w-[18px] rounded-full shadow-float transition-transform duration-150 ease-out ${
            checked ? "translate-x-5 bg-brand-ink" : "translate-x-0 bg-ink"
          }`}
        />
      </button>
    </div>
  );
}
