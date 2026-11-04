// Regras de compatibilidade entre peças. Spec §5.6.
//
// TODO(V2-A): comprimento máximo de GPU no gabinete, altura de cooler, slots
// M.2, quantidade de pentes de RAM, fonte SFX em gabinetes ITX.

import type { PartSpec } from "@/models/builder-types";
import type { Category } from "@/models/types";

/** As sete categorias que o Montador sabe montar. */
const CATEGORIAS: readonly Category[] = ["gpu", "cpu", "motherboard", "ram", "ssd", "psu", "case"];

const positivo = (n: number | undefined): boolean => typeof n === "number" && Number.isFinite(n) && n > 0;
const preenchido = (s: string | undefined): boolean => typeof s === "string" && s.trim().length > 0;

/**
 * Diz se a spec tem o mínimo para entrar na montagem (LOG-02/03).
 *
 * Por quê: `isCompatible` só compara campos que existem dos dois lados. Uma
 * placa-mãe sem `socket` "combinaria" com qualquer processador, e a promessa
 * "peças sempre compatíveis" quebraria em silêncio. Então, antes de montar,
 * exigimos por categoria:
 *   - gpu e cpu: `tdp` finito e > 0 (a potência da fonte depende dele);
 *   - cpu: `socket`; placa-mãe: `socket`, `ramType` e `formFactor`;
 *   - ram: `ramType`; gabinete: `caseSupports` não vazio; fonte: `wattage` > 0;
 *   - todas: categoria conhecida, `perf` finito e > 0 e `aesthetics` entre 0 e 100.
 * É a MESMA regra de `src/services/specs.ts` (leitura do banco) e de
 * `scripts/collect-specs.mjs` (S-25): perf 0 viraria utilidade zero e um
 * "+Infinity%" de desempenho na nota da troca.
 * Conferir se a categoria da spec bate com a do produto fica com quem tem o
 * produto (auto-build.ts).
 */
export function hasRequiredSpec(spec: PartSpec): boolean {
  if (!CATEGORIAS.includes(spec.category)) return false;
  if (!positivo(spec.perf)) return false;
  if (!Number.isFinite(spec.aesthetics) || spec.aesthetics < 0 || spec.aesthetics > 100) return false;

  switch (spec.category) {
    case "gpu":
      return positivo(spec.tdp);
    case "cpu":
      return positivo(spec.tdp) && preenchido(spec.socket);
    case "motherboard":
      return preenchido(spec.socket) && preenchido(spec.ramType) && preenchido(spec.formFactor);
    case "ram":
      return preenchido(spec.ramType);
    case "case":
      return Array.isArray(spec.caseSupports) && spec.caseSupports.length > 0;
    case "psu":
      return positivo(spec.wattage);
    case "ssd":
      return true;
  }
}

/** Consumo base (placa-mãe, RAM, SSD, fans) somado ao da GPU e da CPU. */
const BASE_WATTS = 75;
/** Margem de segurança sobre o consumo total. */
const SAFETY_FACTOR = 1.3;

/** Potência mínima da fonte para as peças dadas (só gpu/cpu têm tdp). */
export function requiredWattage(parts: PartSpec[]): number {
  const consumo = parts.reduce((s, p) => s + (p.tdp ?? 0), 0);
  return Math.ceil((consumo + BASE_WATTS) * SAFETY_FACTOR);
}

/**
 * Diz se `candidate` é compatível com as peças já escolhidas. Só verifica
 * pares cujas duas peças estão presentes; o resto é considerado compatível.
 * Por isso o Montador só aceita peças com `hasRequiredSpec` (LOG-02).
 *
 * Atenção: o planejador de auto-build.ts (`makePlanner`) depende do formato
 * destas regras (cpu×placa-mãe, placa-mãe×memória, placa-mãe×gabinete e
 * fonte×(gpu + cpu)). Regra nova aqui = ajustar o planejador também.
 *
 * Feito com um laço só (sem copiar listas) porque roda centenas de milhares de
 * vezes numa montagem com catálogo grande (V2-B1).
 */
export function isCompatible(chosen: PartSpec[], candidate: PartSpec): boolean {
  // Primeira peça de cada categoria (na ordem: escolhidas, depois a candidata)
  // e o consumo de todas as gpus/cpus.
  let cpu: PartSpec | undefined;
  let mobo: PartSpec | undefined;
  let ram: PartSpec | undefined;
  let gabinete: PartSpec | undefined;
  let psu: PartSpec | undefined;
  let consumo = 0;
  for (let i = 0; i <= chosen.length; i++) {
    const p = i < chosen.length ? chosen[i] : candidate;
    switch (p.category) {
      case "cpu":
        cpu ??= p;
        consumo += p.tdp ?? 0;
        break;
      case "gpu":
        consumo += p.tdp ?? 0;
        break;
      case "motherboard":
        mobo ??= p;
        break;
      case "ram":
        ram ??= p;
        break;
      case "case":
        gabinete ??= p;
        break;
      case "psu":
        psu ??= p;
        break;
    }
  }

  if (cpu && mobo && cpu.socket && mobo.socket && cpu.socket !== mobo.socket) return false;
  if (ram && mobo && ram.ramType && mobo.ramType && ram.ramType !== mobo.ramType) return false;
  if (gabinete && mobo && gabinete.caseSupports && mobo.formFactor) {
    if (!gabinete.caseSupports.includes(mobo.formFactor)) return false;
  }
  if (psu && psu.wattage !== undefined) {
    if (psu.wattage < Math.ceil((consumo + BASE_WATTS) * SAFETY_FACTOR)) return false;
  }
  return true;
}
