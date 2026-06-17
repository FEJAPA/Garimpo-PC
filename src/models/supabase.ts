// Conexão com o banco de dados Supabase.
//
// As chaves ficam no arquivo .env.local (que NÃO vai para o git). Enquanto você
// ainda não configurou o Supabase, isStorageConfigured() retorna false e o app
// usa dados de exemplo locais (ver src/lib/data.ts). Assim você já vê o site
// funcionando antes de criar o banco.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Indica se as chaves do Supabase já foram configuradas no .env.local. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

let client: SupabaseClient | null = null;

/**
 * Retorna o cliente do Supabase, ou null se ainda não estiver configurado.
 * Use junto com isSupabaseConfigured().
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(url as string, anonKey as string);
  }
  return client;
}
