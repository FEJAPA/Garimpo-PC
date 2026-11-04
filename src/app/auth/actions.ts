"use server";

// Ações de servidor para login/cadastro/sair. São funções que rodam no servidor
// quando o usuário envia o formulário de login.
//
// V2 (pacote G): o formulário pode trazer `next` (a página de onde a pessoa veio,
// ex.: "/montar" ou "/peca/rtx-4060"). Depois de entrar, voltamos para lá, mas só
// se for um caminho INTERNO; qualquer outra coisa vai para /conta (evita o
// "redirecionamento aberto", em que um link nosso levaria a um site de golpe).
//
// S-15 / F-10: a volta para /entrar leva só CÓDIGOS na URL (?erro=credenciais,
// ?mensagem=conta-criada), e a página traduz por um mapa fixo. Se a URL levasse
// texto, qualquer pessoa poderia mandar um link nosso com "Sua conta foi
// bloqueada, ligue para 0800..." numa caixa com cara de aviso oficial.

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
    redirect(`/entrar?erro=${traduzErro(error)}${comNext(next)}`);
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
    redirect(`/entrar?erro=${traduzErro(error)}${comNext(next)}`);
  }
  // Dependendo da config do Supabase, pode exigir confirmação por e-mail (a página explica).
  redirect(`/entrar?mensagem=conta-criada${comNext(next)}`);
}

/** Sair da conta. */
export async function logout() {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Código do erro para a URL de /entrar (a página traduz). Olha primeiro o
 * `code` do Supabase (estável) e depois o texto da mensagem (versões antigas).
 * Qualquer outra coisa vira "generico": o texto do Supabase nunca vai para a URL.
 */
function traduzErro(error: { message?: string; code?: string }):
  | "credenciais"
  | "email-nao-confirmado"
  | "ja-cadastrado"
  | "senha-curta"
  | "email-invalido"
  | "generico" {
  const code = error.code ?? "";
  const msg = error.message ?? "";
  if (code === "invalid_credentials" || msg.includes("Invalid login credentials")) return "credenciais";
  if (code === "email_not_confirmed" || msg.includes("Email not confirmed")) return "email-nao-confirmado";
  if (code === "user_already_exists" || code === "email_exists" || msg.includes("already registered")) {
    return "ja-cadastrado";
  }
  if (code === "weak_password" || msg.includes("Password should be")) return "senha-curta";
  if (code === "email_address_invalid" || /valid email|validate email|invalid format/i.test(msg)) {
    return "email-invalido";
  }
  return "generico";
}
