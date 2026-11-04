// Regras de compatibilidade entre peças. Spec §5.6.
//
// TODO(V2-A): comprimento máximo de GPU no gabinete, altura de cooler, slots
// M.2, quantidade de pentes de RAM, fonte SFX em gabinetes ITX.

import type { PartSpec } from "@/models/builder-types";

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
 */
export function isCompatible(chosen: PartSpec[], candidate: PartSpec): boolean {
  const all = [...chosen, candidate];
  const by = (cat: PartSpec["category"]) => all.find((p) => p.category === cat);

  const cpu = by("cpu");
  const mobo = by("motherboard");
  const ram = by("ram");
  const gabinete = by("case");
  const psu = by("psu");

  if (cpu && mobo && cpu.socket && mobo.socket && cpu.socket !== mobo.socket) return false;
  if (ram && mobo && ram.ramType && mobo.ramType && ram.ramType !== mobo.ramType) return false;
  if (gabinete && mobo && gabinete.caseSupports && mobo.formFactor) {
    if (!gabinete.caseSupports.includes(mobo.formFactor)) return false;
  }
  if (psu && psu.wattage !== undefined) {
    const consumidores = all.filter((p) => p.category === "gpu" || p.category === "cpu");
    if (psu.wattage < requiredWattage(consumidores)) return false;
  }
  return true;
}
