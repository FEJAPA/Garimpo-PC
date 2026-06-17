// Página de login / cadastro. O login é OPCIONAL no GarimpoPC: só é preciso
// para salvar favoritos e criar alertas de preço.

import Link from "next/link";
import { login, signup } from "@/app/auth/actions";
import { isSupabaseConfigured } from "@/models/supabase";

export default async function EntrarPage(props: PageProps<"/entrar">) {
  const params = await props.searchParams;
  const erro = typeof params.erro === "string" ? params.erro : null;
  const mensagem = typeof params.mensagem === "string" ? params.mensagem : null;

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12">
      <Link href="/" className="mb-6 text-sm text-accent hover:underline">
        ← Voltar
      </Link>

      <h1 className="text-2xl font-extrabold tracking-tight">
        Entrar no <span className="text-gradient">GarimpoPC</span>
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Crie uma conta para salvar peças favoritas e receber alertas quando o preço cair.
      </p>

      {!isSupabaseConfigured() && (
        <div className="mt-6 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
          O login ainda não está configurado (banco de dados ausente).
        </div>
      )}

      {erro && (
        <div className="mt-6 rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
          {erro}
        </div>
      )}
      {mensagem && (
        <div className="mt-6 rounded-xl border border-good/30 bg-good-soft px-4 py-3 text-sm text-good">
          {mensagem}
        </div>
      )}

      <form className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink-muted">E-mail</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="voce@exemplo.com"
            className="rounded-lg border border-line bg-surface px-3 py-2 text-ink outline-none placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink-muted">Senha</span>
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete="current-password"
            placeholder="mínimo 6 caracteres"
            className="rounded-lg border border-line bg-surface px-3 py-2 text-ink outline-none placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </label>

        <div className="mt-2 flex flex-col gap-2">
          <button
            formAction={login}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong"
          >
            Entrar
          </button>
          <button
            formAction={signup}
            className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-brand"
          >
            Criar conta
          </button>
        </div>
      </form>
    </div>
  );
}
