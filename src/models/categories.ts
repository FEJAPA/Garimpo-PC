// Categorias de peças e seus nomes em português. Usado na busca, nos cards e
// nos filtros. Manter aqui para um único lugar de verdade.

import type { Category } from "./types";

export const CATEGORIES: { code: Category; label: string; emoji: string }[] = [
  { code: "gpu", label: "Placa de vídeo", emoji: "🎮" },
  { code: "cpu", label: "Processador", emoji: "🧠" },
  { code: "ram", label: "Memória RAM", emoji: "🧩" },
  { code: "ssd", label: "Armazenamento", emoji: "💾" },
  { code: "motherboard", label: "Placa-mãe", emoji: "🔌" },
  { code: "psu", label: "Fonte", emoji: "⚡" },
  { code: "case", label: "Gabinete", emoji: "🗄️" },
];

/** Nome em português de uma categoria (ex.: "gpu" -> "Placa de vídeo"). */
export function categoryLabel(code: string): string {
  return CATEGORIES.find((c) => c.code === code)?.label ?? code;
}

// Apelidos (em português, com e sem acento) que apontam para cada código.
// Usados para a busca entender termos como "placa de video", "memoria", etc.
const SINONIMOS: Record<Category, string[]> = {
  gpu: ["placa de vídeo", "placa de video", "vga", "gpu", "placa grafica", "placa gráfica"],
  cpu: ["processador", "cpu", "ryzen", "core", "intel", "amd"],
  ram: ["memória", "memoria", "ram", "ddr", "ddr4", "ddr5"],
  ssd: ["armazenamento", "ssd", "hd", "nvme", "disco"],
  motherboard: ["placa-mãe", "placa mae", "placa mãe", "motherboard", "mobo"],
  psu: ["fonte", "psu", "watts"],
  case: ["gabinete", "case", "torre"],
};

/** Devolve os códigos de categoria que combinam com um termo de busca. */
export function categoriesMatching(term: string): Category[] {
  const q = term.trim().toLowerCase();
  if (!q) return [];
  const result: Category[] = [];
  for (const c of CATEGORIES) {
    const alvos = [c.label.toLowerCase(), c.code, ...(SINONIMOS[c.code] ?? [])];
    if (alvos.some((a) => a.includes(q) || q.includes(a))) result.push(c.code);
  }
  return result;
}
