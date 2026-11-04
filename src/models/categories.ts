// Categorias de peças e seus nomes em português. Usado na busca, nos cards e
// nos filtros. Manter aqui para um único lugar de verdade.

import type { Category } from "./types";

export const CATEGORIES: { code: Category; label: string }[] = [
  { code: "gpu", label: "Placa de vídeo" },
  { code: "cpu", label: "Processador" },
  { code: "ram", label: "Memória RAM" },
  { code: "ssd", label: "Armazenamento" },
  { code: "motherboard", label: "Placa-mãe" },
  { code: "psu", label: "Fonte" },
  { code: "case", label: "Gabinete" },
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

/**
 * Casa o apelido `alvo` com o que a pessoa digitou (`q`, já em minúsculas):
 * - prefixo: "proc" acha "processador" (a pessoa ainda está digitando);
 * - frase inteira dentro da busca: "ryzen 5 5600" acha "ryzen".
 * Nunca casa um pedaço do meio de outra palavra: "hdmi" não é "hd" (SSD).
 */
function casaComApelido(alvo: string, q: string): boolean {
  if (alvo === q) return true;
  if (q.length >= 2 && alvo.startsWith(q)) return true;
  return ` ${q} `.includes(` ${alvo} `);
}

/** Devolve os códigos de categoria que combinam com um termo de busca. */
export function categoriesMatching(term: string): Category[] {
  const q = term.trim().toLowerCase();
  if (!q) return [];
  const result: Category[] = [];
  for (const c of CATEGORIES) {
    const alvos = [c.label.toLowerCase(), c.code, ...(SINONIMOS[c.code] ?? [])];
    if (alvos.some((a) => casaComApelido(a, q))) result.push(c.code);
  }
  return result;
}
