"use server";

// Ações de servidor para login/cadastro/sair. São funções que rodam no servidor
// quando o usuário envia o formulário de login.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/models/supabase-server";

/** Entrar com e-mail e senha. */
export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/entrar?erro=${encodeURIComponent(traduzErro(error.message))}`);
  }
  revalidatePath("/", "layout");
  redirect("/conta");
}

/** Criar uma conta nova com e-mail e senha. */
export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/entrar?erro=${encodeURIComponent(traduzErro(error.message))}`);
  }
  // Dependendo da config do Supabase, pode exigir confirmação por e-mail.
  redirect("/entrar?mensagem=" + encodeURIComponent("Conta criada! Você já pode entrar."));
}

/** Sair da conta. */
export async function logout() {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

// Traduz algumas mensagens de erro comuns do Supabase para português.
function traduzErro(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (msg.includes("already registered")) return "Este e-mail já está cadastrado.";
  if (msg.includes("Password should be")) return "A senha deve ter pelo menos 6 caracteres.";
  if (msg.includes("valid email")) return "Digite um e-mail válido.";
  return "Não foi possível concluir. Tente novamente.";
}
