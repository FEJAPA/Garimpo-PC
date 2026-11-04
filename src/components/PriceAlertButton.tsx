"use client";

// Botão "Criar alerta de preço" na página da peça.
// - Sem login: leva para a tela de entrar e volta para esta peça depois (?next=).
// - Com login: abre um campo para o preço-alvo e cria o alerta.

import { useState, useEffect, useTransition } from "react";
import { Bell } from "lucide-react";
import { getBrowserSupabase } from "@/models/supabase-browser";
import { isSupabaseConfigured } from "@/models/supabase";
import { createAlert } from "@/app/account/actions";
import { formatBRL } from "@/lib/currency";
import { Button, ButtonLink } from "./ui/Button";
import { INPUT_CLASSES } from "./ui/Field";

export function PriceAlertButton({
  productSlug,
  productName,
  currentPrice,
}: {
  productSlug: string;
  productName: string;
  currentPrice: number;
}) {
  const configurado = isSupabaseConfigured();
  // Sem Supabase, já sabemos que não há login; com Supabase, descobrimos no navegador.
  const [logado, setLogado] = useState<boolean | null>(configurado ? null : false);
  const [aberto, setAberto] = useState(false);
  const [alvo, setAlvo] = useState(Math.round(currentPrice * 0.9));
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!configurado) return;
    const supabase = getBrowserSupabase();
    supabase.auth.getUser().then(({ data }) => setLogado(Boolean(data.user)));
  }, [configurado]);

  if (logado === false) {
    return (
      <ButtonLink href={`/entrar?next=${encodeURIComponent(`/peca/${productSlug}`)}`} variant="secondary">
        <Bell className="h-4 w-4" aria-hidden />
        Entre para criar um alerta de preço
      </ButtonLink>
    );
  }

  if (!aberto) {
    return (
      <Button variant="secondary" onClick={() => setAberto(true)} disabled={logado === null}>
        <Bell className="h-4 w-4" aria-hidden />
        Criar alerta de preço
      </Button>
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
    <div className="w-full max-w-xs rounded-card border border-line bg-surface-2 p-3">
      <label htmlFor="alvo-alerta" className="text-xs text-ink-muted">
        Avise-me quando <strong className="text-ink">{productName}</strong> custar até:
      </label>
      <div className="mt-2 flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-faint">
            R$
          </span>
          <input
            id="alvo-alerta"
            type="number"
            min={1}
            value={alvo}
            onChange={(e) => setAlvo(Number(e.target.value))}
            className={`${INPUT_CLASSES} tnum pl-10`}
          />
        </div>
        <Button onClick={salvar} loading={pending}>
          Salvar
        </Button>
      </div>
      <p className="mt-1 text-xs text-ink-faint">Preço atual: {formatBRL(currentPrice)}</p>
      {feedback && (
        <p className={`mt-2 text-xs ${feedback.ok ? "text-good" : "text-bad"}`} role="status">
          {feedback.message}
        </p>
      )}
    </div>
  );
}
