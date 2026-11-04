// Cliente do Supabase para uso no NAVEGADOR (componentes "use client").
// Hoje é usado pelo botão de alerta de preço (PriceAlertButton) para saber se há
// alguém logado. O login e o cadastro rodam no servidor (src/app/auth/actions.ts).

import { createBrowserClient } from "@supabase/ssr";

export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
  return createBrowserClient(url, anonKey);
}
