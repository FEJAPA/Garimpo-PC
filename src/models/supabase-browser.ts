// Cliente do Supabase para uso no NAVEGADOR (componentes "use client").
// Usado, por exemplo, no formulário de login e no botão de alerta de preço.

import { createBrowserClient } from "@supabase/ssr";

export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
  return createBrowserClient(url, anonKey);
}
