"use client";

// Botão "Criar alerta de preço" na página da peça.
// - Se o usuário NÃO está logado, leva para a tela de login.
// - Se está logado, abre um campo para digitar o preço-alvo e cria o alerta.

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/models/supabase-browser";
import { isSupabaseConfigured } from "@/models/supabase";
import { createAlert } from "@/app/account/actions";
import { formatBRL } from "@/lib/format";

export function PriceAlertButton({
  productSlug,
  productName,
  currentPrice,
}: {
  productSlug: string;
  productName: string;
  currentPrice: number;
}) {
  const [logado, setLogado] = useState<boolean | null>(null);
  const [aberto, setAberto] = useState(false);
  // Sugere um alvo 10% abaixo do preço atual, arredondado.
  const [alvo, setAlvo] = useState(Math.round(currentPrice * 0.9));
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Descobre, no navegador, se há um usuário logado.
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLogado(false);
      return;
    }
    const supabase = getBrowserSupabase();
    supabase.auth.getUser().then(({ data }) => setLogado(Boolean(data.user)));
  }, []);

  if (logado === false) {
    return (
      <Link
        href="/entrar"
        className="inline-flex items-center justify-center rounded-lg border border-brand/40 bg-brand/10 px-4 py-2.5 text-sm font-semibold text-brand-strong transition hover:bg-brand/20"
      >
        🔔 Entre para criar um alerta de preço
      </Link>
    );
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        disabled={logado === null}
        className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-50"
      >
        🔔 Criar alerta de preço
      </button>
    );
  }

  function salvar() {
    const fd = new FormData();
    fd.set("slug", productSlug);
    fd.set("target_price", String(alvo));
    startTransition(async () => {
      const res = await createAlert(fd);
      setFeedback(res);
      if (res.ok) setAberto(false);
    });
  }

  return (
    <div className="w-full max-w-xs rounded-xl border border-line bg-surface-2 p-3">
      <p className="text-xs text-ink-muted">
        Avise-me quando <strong className="text-ink">{productName}</strong> custar até:
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm text-ink-muted">R$</span>
        <input
          type="number"
          min={1}
          value={alvo}
          onChange={(e) => setAlvo(Number(e.target.value))}
          className="w-28 rounded-lg border border-line bg-surface px-2 py-1.5 text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
        <button
          onClick={salvar}
          disabled={pending}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-faint">Preço atual: {formatBRL(currentPrice)}</p>
      {feedback && (
        <p className={`mt-2 text-xs ${feedback.ok ? "text-good" : "text-bad"}`}>
          {feedback.message}
        </p>
      )}
    </div>
  );
}
