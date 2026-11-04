"use client";

// "Salvar montagem" no resultado do Montador (V2, pacote G1). O Pacote F encaixa
// <SaveBuildButton prefs={prefs} result={result} /> no BuildResultView.
// - Sem login: link "Entre para salvar a montagem", que volta para esta página.
// - Com login: campo de nome + botão; a action confere as ofertas e grava.
//
// Aqui também mora o formulário do alerta da montagem inteira (G2), usado na
// página /conta: ele precisa de estado no navegador para o retorno em linha.

import { useEffect, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Bookmark, Check } from "lucide-react";
import type { BuildPreferences, BuildSuccess } from "@/models/builder-types";
import { getBrowserSupabase } from "@/models/supabase-browser";
import { isSupabaseConfigured } from "@/models/supabase";
import { createBuildAlert, saveBuild } from "@/app/account/actions";
import { DEFAULT_BUILD_NAME, SAVED_BUILD_NAME_MAX, toSavedBuildRow } from "@/services/saved-builds";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, INPUT_CLASSES, MoneyInput } from "@/components/ui/Field";

type Retorno = { ok: boolean; message: string };

/** Descobre no navegador se há sessão (sem Supabase, já sabemos que não há). */
function useLogado(): boolean | null {
  const configurado = isSupabaseConfigured();
  const [logado, setLogado] = useState<boolean | null>(configurado ? null : false);
  useEffect(() => {
    if (!configurado) return;
    getBrowserSupabase()
      .auth.getUser()
      .then(({ data }) => setLogado(Boolean(data.user)));
  }, [configurado]);
  return logado;
}

export function SaveBuildButton({ prefs, result }: { prefs: BuildPreferences; result: BuildSuccess }) {
  const logado = useLogado();
  const pathname = usePathname();
  // A query (ex.: ?b=código) é lida depois de montar, para o link de entrar voltar à mesma montagem.
  const [busca, setBusca] = useState("");
  const [nome, setNome] = useState(DEFAULT_BUILD_NAME);
  const [retorno, setRetorno] = useState<Retorno | null>(null);
  // Guarda QUAL resultado foi salvo: se a pessoa montar de novo, o botão volta.
  const [salvo, setSalvo] = useState<BuildSuccess | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (logado !== false) return;
    // Fora do render para não divergir do HTML do servidor (que não conhece a query).
    const id = requestAnimationFrame(() => setBusca(window.location.search));
    return () => cancelAnimationFrame(id);
  }, [logado]);

  if (logado === false) {
    const next = `${pathname || "/montar"}${busca}`;
    return (
      <ButtonLink href={`/entrar?next=${encodeURIComponent(next)}`} variant="secondary">
        <Bookmark className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        Entre para salvar a montagem
      </ButtonLink>
    );
  }

  const jaSalva = salvo === result;
  const nomeLongo = nome.trim().length > SAVED_BUILD_NAME_MAX;

  function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (nomeLongo) return;
    const row = toSavedBuildRow(prefs, result, nome);
    const fd = new FormData();
    fd.set("name", row.name);
    fd.set("prefs", JSON.stringify(row.prefs));
    fd.set("parts", JSON.stringify(row.parts));
    startTransition(async () => {
      const res = await saveBuild(fd);
      setRetorno(res);
      if (res.ok) setSalvo(result);
    });
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      <form onSubmit={salvar} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Field
            label="Nome da montagem"
            htmlFor="nome-montagem"
            hint={`Até ${SAVED_BUILD_NAME_MAX} caracteres.`}
            error={nomeLongo ? `O nome pode ter até ${SAVED_BUILD_NAME_MAX} caracteres.` : null}
          >
            <input
              id="nome-montagem"
              name="name"
              type="text"
              value={nome}
              maxLength={SAVED_BUILD_NAME_MAX + 20}
              onChange={(e) => setNome(e.target.value)}
              aria-invalid={nomeLongo || undefined}
              disabled={logado === null}
              className={INPUT_CLASSES}
            />
          </Field>
        </div>
        <Button
          type="submit"
          variant="secondary"
          loading={pending}
          disabled={logado === null || jaSalva || nomeLongo}
          className="sm:mb-[22px]"
        >
          {jaSalva ? (
            <Check className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          ) : (
            <Bookmark className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          )}
          {jaSalva ? "Montagem salva" : "Salvar montagem"}
        </Button>
      </form>
      <p role="status" aria-live="polite" className={`text-xs ${retorno?.ok ? "text-good" : "text-bad"}`}>
        {retorno?.message}
        {retorno?.ok && (
          <>
            {" "}
            <Link href="/conta" className="font-medium text-brand hover:underline">
              Ver em Minha conta
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

/** Formulário "Avisar quando a montagem custar até R$ X" (página /conta, G2). */
export function SavedBuildAlertForm({
  buildId,
  buildName,
  suggested,
}: {
  buildId: string;
  buildName: string;
  /** Valor inicial do campo (o alvo atual, ou um pouco abaixo do total salvo). */
  suggested: number;
}) {
  const [valor, setValor] = useState(String(Math.max(1, Math.round(suggested))));
  const [retorno, setRetorno] = useState<Retorno | null>(null);
  const [pending, startTransition] = useTransition();
  const campoId = `alvo-montagem-${buildId}`;

  function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("saved_build_id", buildId);
    // A action lê com parseMoney ("5.999,90" e "5999.90" valem).
    fd.set("target_price", valor);
    startTransition(async () => setRetorno(await createBuildAlert(fd)));
  }

  return (
    <form onSubmit={criar} className="flex flex-col gap-2">
      <Field label="Avisar quando a montagem custar até" htmlFor={campoId}>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <MoneyInput id={campoId} value={valor} onChange={setValor} />
          </div>
          <Button type="submit" variant="secondary" loading={pending} aria-label={`Criar alerta para ${buildName}`}>
            <Bell className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Criar alerta
          </Button>
        </div>
      </Field>
      <p role="status" aria-live="polite" className={`text-xs ${retorno?.ok ? "text-good" : "text-bad"}`}>
        {retorno?.message}
      </p>
    </form>
  );
}
