// Tabelas de juros das lojas (V2, pacote E). Lê `store_installments` no
// Supabase quando ele está configurado; sem Supabase (modo de demonstração)
// usa o mock de src/models/installment-tables.ts.
//
// Regra do AGENTS.md (dado ilustrativo nunca vira fato no modo real): com
// Supabase configurado, erro ou tabela vazia devolvem VAZIO, nunca o mock. Com
// banco de verdade as ofertas são reais, e juros ilustrativos por cima delas
// enganariam a pessoa. Sem tabela, o Montador usa o preço parcelado da própria
// oferta (V1). Atenção: supabase/seed-payments.sql também é só demonstração.

import { getSupabase } from "@/models/supabase";
import { INSTALLMENT_TABLES } from "@/models/installment-tables";
import type { InstallmentRate } from "@/models/builder-types";
import { MAX_INSTALLMENTS } from "@/services/builder/payments";

/** Linha crua da tabela `store_installments` (numeric pode chegar como texto). */
export type InstallmentRow = {
  store_id: string;
  count: number | string;
  factor: number | string;
};

/**
 * Agrupa as linhas por loja, em ordem crescente de parcelas.
 * Linhas sem sentido (parcelas fora de 1..24, fator < 1 ou não numérico) são
 * ignoradas, para um dado errado no banco não virar "desconto" no cartão nem
 * travar a tela com centenas de opções (LOG-12).
 */
export function groupInstallmentRows(rows: InstallmentRow[]): Record<string, InstallmentRate[]> {
  const porLoja: Record<string, InstallmentRate[]> = {};
  for (const row of rows) {
    const count = Math.floor(Number(row.count));
    const factor = Number(row.factor);
    if (!Number.isFinite(count) || count < 1 || count > MAX_INSTALLMENTS) continue;
    if (!Number.isFinite(factor) || factor < 1) continue;
    (porLoja[row.store_id] ??= []).push({ count, factor });
  }
  for (const tabela of Object.values(porLoja)) tabela.sort((a, b) => a.count - b.count);
  return porLoja;
}

/** Tabelas de juros por loja (id da loja → faixas). */
export async function getInstallmentTables(): Promise<Record<string, InstallmentRate[]>> {
  const supabase = getSupabase();
  if (!supabase) return INSTALLMENT_TABLES;

  const { data, error } = await supabase.from("store_installments").select("store_id, count, factor");
  if (error) {
    console.error("Erro ao buscar juros das lojas no Supabase:", error.message);
    return {};
  }
  return groupInstallmentRows((data ?? []) as InstallmentRow[]);
}
