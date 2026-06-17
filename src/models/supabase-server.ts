// Cliente do Supabase para uso no SERVIDOR (componentes de servidor, rotas de
// API e o Proxy). Ele lê/grava os cookies de sessão do usuário logado.
//
// Diferente de src/lib/supabase.ts (que é simples e usado para ler dados
// públicos), este aqui sabe da SESSÃO do usuário — necessário para login.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "./supabase";

export { isSupabaseConfigured };

/**
 * Cria um cliente Supabase ligado aos cookies da requisição atual.
 * Em Next.js 16, cookies() é assíncrono — por isso await.
 */
export async function getServerSupabase() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado a partir de um Server Component sem permissão de escrita.
          // O Proxy cuida de atualizar a sessão, então podemos ignorar.
        }
      },
    },
  });
}

/** Retorna o usuário logado (ou null). Seguro de chamar mesmo sem Supabase. */
export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
