// Página de login / cadastro. O login é OPCIONAL: só é preciso para salvar
// montagens e para os alertas de preço.
//
// S-15 / F-10: `?erro=` e `?mensagem=` trazem só CÓDIGOS (ver src/app/auth/actions.ts),
// traduzidos pelos mapas abaixo. Código desconhecido não mostra nada: um link
// com texto inventado na URL nunca vira uma caixa de aviso "oficial".

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { login, signup } from "@/app/auth/actions";
import { isSupabaseConfigured } from "@/models/supabase";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { INPUT_CLASSES } from "@/components/ui/Field";

export const metadata: Metadata = {
  title: "Entrar",
};

/** Erros das actions de login/cadastro, por código. */
const ERROS: Record<string, string> = {
  credenciais: "E-mail ou senha incorretos.",
  "email-nao-confirmado": "Confirme seu e-mail pelo link que enviamos antes de entrar.",
  "ja-cadastrado": "Este e-mail já está cadastrado. Use “Entrar”.",
  "senha-curta": "A senha deve ter pelo menos 6 caracteres.",
  "email-invalido": "Digite um e-mail válido.",
  generico: "Não foi possível concluir. Tente novamente.",
};

/** Mensagens de sucesso, por código. */
const MENSAGENS: Record<string, string> = {
  "conta-criada": "Conta criada! Se chegar um e-mail de confirmação, clique no link dele. Depois é só entrar.",
};

/**
 * Texto do mapa para o código da URL, ou null. Código desconhecido, repetido na
 * URL (vira lista) ou herdado do objeto (ex.: "constructor") não mostra nada.
 */
function traduzir(mapa: Record<string, string>, codigo: unknown): string | null {
  if (typeof codigo !== "string" || !Object.hasOwn(mapa, codigo)) return null;
  return mapa[codigo];
}

/**
 * Para onde voltar depois de entrar (?next=/peca/rtx-4060). Só caminhos internos:
 * qualquer outra coisa vira null, para ninguém usar o login para mandar a pessoa
 * a outro site. As ações de login/cadastro devem validar de novo no servidor.
 */
function destinoSeguro(valor: unknown): string | null {
  if (typeof valor !== "string" || valor.length > 200) return null;
  if (!valor.startsWith("/") || valor.startsWith("//") || valor.includes("\\")) return null;
  return valor;
}

export default async function EntrarPage(props: PageProps<"/entrar">) {
  const params = await props.searchParams;
  const erro = traduzir(ERROS, params.erro);
  const mensagem = traduzir(MENSAGENS, params.mensagem);
  const destino = destinoSeguro(params.next);

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12">
      <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Voltar
      </Link>

      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Entrar no GarimpoPC</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Crie uma conta para salvar montagens e receber alertas quando o preço cair.
      </p>

      {!isSupabaseConfigured() && (
        <Callout tone="warn" className="mt-6">
          O login ainda não está configurado (banco de dados ausente).
        </Callout>
      )}
      {erro && (
        <Callout tone="bad" className="mt-6">
          {erro}
        </Callout>
      )}
      {mensagem && (
        <Callout tone="good" className="mt-6">
          {mensagem}
        </Callout>
      )}

      <form className="mt-6 flex flex-col gap-4">
        {destino && <input type="hidden" name="next" value={destino} />}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">E-mail</span>
          <input type="email" name="email" required autoComplete="email" placeholder="voce@exemplo.com" className={INPUT_CLASSES} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Senha</span>
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete="current-password"
            placeholder="mínimo 6 caracteres"
            className={INPUT_CLASSES}
          />
        </label>
        <div className="mt-2 flex flex-col gap-2">
          <Button formAction={login}>Entrar</Button>
          <Button formAction={signup} variant="secondary">
            Criar conta
          </Button>
        </div>
      </form>
    </div>
  );
}
