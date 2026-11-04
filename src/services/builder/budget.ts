// Orçamento do Montador: alvo (quanto a pessoa quer gastar), teto (máximo
// absoluto, nunca ultrapassado) e folga (teto - alvo). Spec §2 e §5.4/5.5.

import type { BudgetPlan } from "@/models/builder-types";

/** Valores padrão do formulário: "posso gastar 6 mil, no máximo 7". */
export const DEFAULT_BUDGET: BudgetPlan = { target: 6000, hardCap: 7000 };

function sane(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Garante que o teto nunca é menor que o alvo (se for, iguala) e que os
 * valores são números válidos e não negativos.
 */
export function normalizeBudget(budget: BudgetPlan): BudgetPlan {
  const target = sane(budget.target);
  const hardCap = Math.max(target, sane(budget.hardCap));
  return { target, hardCap };
}

/** Folga disponível acima do alvo (0 quando alvo = teto). */
export function wiggleRoom(budget: BudgetPlan): number {
  const b = normalizeBudget(budget);
  return b.hardCap - b.target;
}

/** true se o total cabe no teto (o valor exato do teto é aceito). */
export function fitsHardCap(total: number, budget: BudgetPlan): boolean {
  return total <= normalizeBudget(budget).hardCap;
}
