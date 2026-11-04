// Atalhos de categoria (chips) que levam para a busca filtrada.

import Link from "next/link";
import { CATEGORIES } from "@/models/categories";
import { CategoryIcon } from "./CategoryIcon";

export function CategoryChips() {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Categorias">
      {CATEGORIES.map((c) => (
        <li key={c.code}>
          <Link
            href={`/busca?q=${encodeURIComponent(c.label)}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-muted transition-colors duration-150 hover:border-line-strong hover:text-ink"
          >
            <CategoryIcon category={c.code} className="h-3.5 w-3.5" />
            {c.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
