// Rodapé: navegação secundária e o aviso de que preços mudam.

import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-display font-semibold text-ink-muted">GarimpoPC</span> · projeto em
          desenvolvimento. Preços mudam; confira sempre na loja antes de comprar.
        </p>
        <nav aria-label="Rodapé" className="flex gap-4">
          <Link href="/busca" className="hover:text-ink">
            Peças
          </Link>
          <Link href="/montar" className="hover:text-ink">
            Montar PC
          </Link>
          <Link href="/conta" className="hover:text-ink">
            Minha conta
          </Link>
        </nav>
      </div>
    </footer>
  );
}
