// Cabeçalho do site: marca, navegação, busca e estado de login.
// No celular vira duas linhas: marca + conta em cima; navegação + busca embaixo.

import Link from "next/link";
import { Suspense } from "react";
import { Pickaxe } from "lucide-react";
import { getCurrentUser } from "@/models/supabase-server";
import { SearchBar } from "./SearchBar";
import { ButtonLink } from "./ui/Button";

const NAV = [
  { href: "/busca", label: "Peças" },
  { href: "/montar", label: "Montar PC" },
];

function NavLinks() {
  return (
    <>
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-control px-2.5 py-1.5 text-sm font-medium text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}

export async function SiteHeader() {
  const user = await getCurrentUser();
  const conta = user ? (
    <ButtonLink href="/conta" variant="secondary" size="sm">
      Minha conta
    </ButtonLink>
  ) : (
    <ButtonLink href="/entrar" variant="secondary" size="sm">
      Entrar
    </ButtonLink>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-base/90 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center gap-5">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="GarimpoPC — início">
            <span className="grid h-9 w-9 place-items-center rounded-control bg-brand-soft text-brand ring-1 ring-brand/30 transition-colors duration-150 group-hover:bg-brand group-hover:text-brand-ink">
              <Pickaxe className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-ink">GarimpoPC</span>
          </Link>

          <nav aria-label="Principal" className="hidden items-center gap-1 sm:flex">
            <NavLinks />
          </nav>

          <div className="ml-auto hidden w-full max-w-sm sm:block">
            <Suspense fallback={null}>
              <SearchBar compact />
            </Suspense>
          </div>

          <div className="ml-auto shrink-0 sm:ml-0">{conta}</div>
        </div>

        <div className="mt-3 flex items-center gap-2 sm:hidden">
          <nav aria-label="Principal" className="flex shrink-0 items-center gap-1">
            <NavLinks />
          </nav>
          <div className="min-w-0 flex-1">
            <Suspense fallback={null}>
              <SearchBar compact />
            </Suspense>
          </div>
        </div>
      </div>
    </header>
  );
}
