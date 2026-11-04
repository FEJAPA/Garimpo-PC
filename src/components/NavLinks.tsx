"use client";

// Links da navegação principal. Fica à parte do SiteHeader (que é de servidor)
// porque precisa saber a página atual para marcá-la com aria-current="page".

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/busca", label: "Peças" },
  { href: "/montar", label: "Montar PC" },
];

/** A página atual é o próprio link ou uma página dentro dele. */
function estaAtivo(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {NAV.map((item) => {
        const ativo = estaAtivo(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo ? "page" : undefined}
            className={`rounded-control px-2.5 py-1.5 text-sm font-medium transition-colors duration-150 hover:bg-surface-2 hover:text-ink ${
              ativo ? "bg-surface-2 text-ink" : "text-ink-muted"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
