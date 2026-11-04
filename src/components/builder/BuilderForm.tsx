"use client";

// Formulário do Montador: entradas (orçamento, teto, lojas confiáveis, slider) e
// o resultado (peças, desempenho, pagamento). Spec §3 e §8.

import { useState, useTransition } from "react";
import { Cpu, Wrench } from "lucide-react";
import type { ProductWithOffers } from "@/models/types";
import type { BuildResult } from "@/models/builder-types";
import { PART_SPECS } from "@/models/part-specs";
import { autoBuild } from "@/services/builder/auto-build";
import { DEFAULT_BUDGET, normalizeBudget } from "@/services/builder/budget";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { Field, MoneyInput } from "@/components/ui/Field";
import { Toggle } from "@/components/ui/Toggle";
import { Slider } from "@/components/ui/Slider";
import { BuildResultView } from "./BuildResultView";

/** "6.000" / "6000,50" / "6000" -> 6000 / 6000.5 / 6000. */
export function parseMoney(text: string): number {
  const limpo = text.trim().replace(/\./g, "").replace(",", ".");
  if (limpo === "") return Number.NaN;
  return Number(limpo);
}

function rotuloDoSlider(a: number): string {
  if (a <= 15) return "Máximo desempenho";
  if (a < 40) return "Prioriza desempenho";
  if (a <= 60) return "Equilibrado";
  if (a < 85) return "Prioriza o visual";
  return "Máxima estética";
}

export function BuilderForm({
  products,
  initialTarget,
  initialCap,
}: {
  products: ProductWithOffers[];
  initialTarget?: number;
  initialCap?: number;
}) {
  const [alvoTexto, setAlvoTexto] = useState(String(initialTarget ?? DEFAULT_BUDGET.target));
  const [tetoTexto, setTetoTexto] = useState(String(initialCap ?? Math.max(initialTarget ?? 0, DEFAULT_BUDGET.hardCap)));
  const [trustedOnly, setTrustedOnly] = useState(true);
  const [aesthetics, setAesthetics] = useState(25);
  const [result, setResult] = useState<BuildResult | null>(null);
  const [versao, setVersao] = useState(0);
  const [pending, startTransition] = useTransition();

  const alvo = parseMoney(alvoTexto);
  const teto = tetoTexto.trim() === "" ? alvo : parseMoney(tetoTexto);
  const alvoInvalido = !Number.isFinite(alvo) || alvo <= 0;
  const tetoInvalido = !Number.isFinite(teto) || teto < 0;
  const tetoMenor = !alvoInvalido && !tetoInvalido && teto < alvo;
  const orcamento = normalizeBudget({ target: alvoInvalido ? 0 : alvo, hardCap: tetoInvalido ? 0 : teto });
  const folga = orcamento.hardCap - orcamento.target;
  const podeMontar = !alvoInvalido && !tetoInvalido;

  function montar(e: React.FormEvent) {
    e.preventDefault();
    if (!podeMontar) return;
    startTransition(() => {
      setResult(autoBuild(products, PART_SPECS, { budget: orcamento, trustedOnly, aesthetics }));
      setVersao((v) => v + 1);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
      {/* Painel de entradas */}
      <Card className="lg:sticky lg:top-24">
        <form onSubmit={montar} className="flex flex-col gap-5" aria-describedby="montador-ajuda">
          <Field label="Quero gastar" htmlFor="alvo" hint="O valor que você tem em mente." error={alvoInvalido ? "Informe um valor maior que zero." : null}>
            <MoneyInput id="alvo" value={alvoTexto} onChange={setAlvoTexto} invalid={alvoInvalido} placeholder="6.000" />
          </Field>

          <Field
            label="No máximo (teto)"
            htmlFor="teto"
            hint={
              tetoMenor
                ? "Teto menor que o alvo: vamos considerar o teto igual ao alvo (sem folga)."
                : folga > 0
                  ? `Folga de ${formatBRL(folga)}, usada só se destravar uma peça bem melhor.`
                  : "Sem folga: a montagem fica dentro do valor que você quer gastar."
            }
            error={tetoInvalido ? "Informe um valor válido." : null}
          >
            <MoneyInput id="teto" value={tetoTexto} onChange={setTetoTexto} invalid={tetoInvalido} placeholder="7.000" />
          </Field>

          <Toggle
            id="lojas-confiaveis"
            checked={trustedOnly}
            onChange={setTrustedOnly}
            label="Só lojas confiáveis"
            description="Lojas oficiais com nota 4,5 ou mais. Desligue para ver ofertas de marketplaces."
          />

          <Slider
            id="balanco"
            value={aesthetics}
            onChange={setAesthetics}
            label="O que importa mais?"
            leftLabel="Desempenho"
            rightLabel="Estética"
            valueLabel={rotuloDoSlider(aesthetics)}
          />

          <Button type="submit" size="lg" loading={pending} disabled={!podeMontar}>
            {result ? <Wrench className="h-4 w-4" aria-hidden /> : <Cpu className="h-4 w-4" aria-hidden />}
            {result ? "Montar de novo" : "Montar meu PC"}
          </Button>
          <p id="montador-ajuda" className="text-xs text-ink-faint">
            O total nunca passa do teto. Os preços são os de hoje, no Pix.
          </p>
        </form>
      </Card>

      {/* Resultado */}
      <div className={`min-w-0 transition-opacity duration-150 ${pending ? "opacity-60" : ""}`} aria-live="polite">
        {!result && <EstadoVazio />}
        {result && !result.ok && (
          <Callout tone="bad" title="Não deu para montar">
            {result.reason}
          </Callout>
        )}
        {result && result.ok && (
          <div key={versao} className="reveal">
            <BuildResultView result={result} />
          </div>
        )}
      </div>
    </div>
  );
}

function EstadoVazio() {
  return (
    <Card padding="lg">
      <h2 className="font-display text-xl font-semibold tracking-tight text-ink">O que vai acontecer</h2>
      <ol className="mt-4 flex flex-col gap-3 text-sm text-ink-muted">
        <li className="flex gap-3">
          <span className="tnum font-display font-semibold text-brand">1</span>
          Dividimos o seu orçamento entre placa de vídeo, processador, placa-mãe, memória, SSD, fonte e gabinete.
        </li>
        <li className="flex gap-3">
          <span className="tnum font-display font-semibold text-brand">2</span>
          Em cada categoria, escolhemos a melhor peça que cabe e combina com as outras (socket, memória, fonte, gabinete).
        </li>
        <li className="flex gap-3">
          <span className="tnum font-display font-semibold text-brand">3</span>
          Se a folga destravar uma placa de vídeo bem melhor, usamos; senão, ficamos no valor que você quer gastar.
        </li>
        <li className="flex gap-3">
          <span className="tnum font-display font-semibold text-brand">4</span>
          Mostramos o desempenho esperado comparado com PCs de referência e como pagar: Pix ou parcelado.
        </li>
      </ol>
    </Card>
  );
}
