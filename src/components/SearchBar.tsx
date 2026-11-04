"use client";

// Barra de busca. Ao enviar, leva para /busca?q=... Funciona em qualquer página.

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { INPUT_CLASSES } from "./ui/Field";

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("q") ?? "";

  // Estado derivado da URL: quando "q" muda (ex.: botão voltar), o campo acompanha.
  const [termo, setTermo] = useState(q);
  const [ultimoQ, setUltimoQ] = useState(q);
  if (q !== ultimoQ) {
    setUltimoQ(q);
    setTermo(q);
  }

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const valor = termo.trim();
    router.push(valor ? `/busca?q=${encodeURIComponent(valor)}` : "/busca");
  }

  return (
    <form onSubmit={buscar} className="w-full" role="search">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
          aria-hidden
        />
        <input
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder={compact ? "Buscar peça, marca ou categoria" : "Buscar por peça, marca ou categoria (ex.: RTX, Ryzen, SSD)"}
          aria-label="Buscar peças"
          className={`${INPUT_CLASSES} ${compact ? "h-9 text-sm" : "h-11"} pl-9`}
        />
      </div>
    </form>
  );
}
