// Cliente ADMIN do Supabase (chave service_role). Tem permissão total e IGNORA
// as regras de segurança (RLS). Use APENAS em código de servidor que roda no
// backend (rotas de API protegidas, jobs de coleta) — NUNCA no navegador.
//
// A chave fica em SUPABASE_SERVICE_ROLE_KEY no .env.local (secreta, sem o
// prefixo NEXT_PUBLIC_ justamente para nunca vazar para o navegador).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

/** Retorna o cliente admin, ou null se a chave service_role não estiver setada. */
export function getAdminSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  if (!admin) {
    admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
