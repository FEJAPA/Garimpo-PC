"use client";

// Barra de busca do cabeçalho. Ao enviar, leva para /busca?q=...
// Funciona em qualquer página.

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [termo, setTermo] = useState(params.get("q") ?? "");

  // Mantém o campo em sincronia se a URL mudar (ex.: voltar do navegador).
  useEffect(() => {
    setTermo(params.get("q") ?? "");
  }, [params]);

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const q = termo.trim();
    router.push(q ? `/busca?q=${encodeURIComponent(q)}` : "/busca");
  }

  return (
    <form onSubmit={buscar} className={compact ? "w-full max-w-xs" : "w-full max-w-xl"} role="search">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
        <span className="text-ink-faint" aria-hidden>
          🔍
        </span>
        <input
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Busque por peça, marca ou categoria (ex.: RTX, Ryzen, SSD)"
          aria-label="Buscar peças"
          className="w-full bg-transparent text-ink outline-none placeholder:text-ink-faint"
        />
        {!compact && (
          <button
            type="submit"
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-strong"
          >
            Buscar
          </button>
        )}
      </div>
    </form>
  );
}
