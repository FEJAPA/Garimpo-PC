"use server";

// Ações de servidor para login/cadastro/sair. São funções que rodam no servidor
// quando o usuário envia o formulário de login.
//
// V2 (pacote G): o formulário pode trazer `next` (a página de onde a pessoa veio,
// ex.: "/montar" ou "/peca/rtx-4060"). Depois de entrar, voltamos para lá, mas só
// se for um caminho INTERNO; qualquer outra coisa vai para /conta (evita o
// "redirecionamento aberto", em que um link nosso levaria a um site de golpe).

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/models/supabase-server";

/**
 * Caminho interno seguro para voltar depois do login, ou null.
 * Aceita "/montar?b=..." e recusa "//site.com", "/\\site.com", "https://...",
 * caracteres de controle e textos enormes.
 */
function caminhoSeguro(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const valor = raw.trim();
  if (valor === "" || valor.length > 2000) return null;
  if (!valor.startsWith("/") || valor.startsWith("//") || valor.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(valor)) return null;
  // Voltar para a própria tela de entrar não ajuda ninguém.
  if (valor === "/entrar" || valor.startsWith("/entrar?")) return null;
  return valor;
}

/** Sufixo "&next=..." para manter o destino quando o login volta com erro. */
function comNext(next: string | null): string {
  return next ? `&next=${encodeURIComponent(next)}` : "";
}

/** Entrar com e-mail e senha. Volta para `next` (se for seguro) ou para /conta. */
export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = caminhoSeguro(formData.get("next"));

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/entrar?erro=${encodeURIComponent(traduzErro(error.message))}${comNext(next)}`);
  }
  revalidatePath("/", "layout");
  redirect(next ?? "/conta");
}

/** Criar uma conta nova com e-mail e senha. */
export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = caminhoSeguro(formData.get("next"));

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/entrar?erro=${encodeURIComponent(traduzErro(error.message))}${comNext(next)}`);
  }
  // Dependendo da config do Supabase, pode exigir confirmação por e-mail.
  redirect("/entrar?mensagem=" + encodeURIComponent("Conta criada! Você já pode entrar.") + comNext(next));
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
