// Cabeçalho do site, exibido em todas as páginas. Mostra o estado de login.

import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/models/supabase-server";
import { SearchBar } from "./SearchBar";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-base/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
        <Link href="/" className="group flex shrink-0 items-center gap-2">
          <span
            className="grid h-8 w-8 place-items-center rounded-lg bg-surface-2 text-lg ring-1 ring-line transition group-hover:ring-brand"
            aria-hidden
          >
            ⛏️
          </span>
          <span className="text-lg font-extrabold tracking-tight">
            Garimpo<span className="text-gradient">PC</span>
          </span>
        </Link>

        {/* Barra de busca: ocupa o espaço do meio. */}
        <div className="order-3 w-full sm:order-2 sm:flex-1">
          <Suspense fallback={null}>
            <SearchBar />
          </Suspense>
        </div>

        <nav className="order-2 ml-auto flex shrink-0 items-center gap-3 sm:order-3 sm:ml-0">
          {user ? (
            <Link
              href="/conta"
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink transition hover:border-brand"
            >
              Minha conta
            </Link>
          ) : (
            <Link
              href="/entrar"
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-strong"
            >
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
