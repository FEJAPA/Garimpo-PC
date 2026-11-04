"use client";

// Plano de pagamento: Pix (à vista) × parcelado × misturar (parte no Pix, parte
// no cartão), com a divisão por loja (cada loja é um pagamento separado). Spec §7.
// As contas ficam em services/builder/payments.ts e mixed-plan.ts; aqui só tela.
//
// TODO(V2-E): campo de cupom (lógica pronta em services/builder/coupons.ts).

import { useId, useState } from "react";
import { CreditCard, QrCode, Split } from "lucide-react";
import type { BuildPart, InstallmentRate, PaymentSummary } from "@/models/builder-types";
import { installmentPlan, interestFreeUpTo, storeInstallment } from "@/services/builder/payments";
import { mixedPlan } from "@/services/builder/mixed-plan";
import { formatBRL } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Field, INPUT_CLASSES, MoneyInput } from "@/components/ui/Field";

type Metodo = "pix" | "parcelado" | "misturar";

/** "1.500" / "1500,50" / "" -> 1500 / 1500.5 / NaN (mesma regra do BuilderForm). */
function lerReais(texto: string): number {
  const limpo = texto.trim().replace(/^R\$\s*/i, "").replace(/\./g, "").replace(",", ".");
  if (limpo === "") return Number.NaN;
  return Number(limpo);
}

function invalido(texto: string): boolean {
  if (texto.trim() === "") return false;
  const n = lerReais(texto);
  return !Number.isFinite(n) || n < 0;
}

/** Percentual em pt-BR, ex.: 0.06 -> "6%", 0.055 -> "5,5%". */
function formatPercent(fracao: number): string {
  return `${(Math.round(fracao * 1000) / 10).toLocaleString("pt-BR")}%`;
}

export function PaymentPlanner({
  payment,
  // TODO(V2-E): BuildResultView (pacote F) precisa passar `parts`; sem elas o
  // modo "Misturar" fica escondido.
  parts = [],
}: {
  payment: PaymentSummary;
  parts?: BuildPart[];
}) {
  const [metodo, setMetodo] = useState<Metodo>("pix");
  const [parcelas, setParcelas] = useState(payment.maxInstallments);
  const plano = installmentPlan(payment, parcelas);
  const opcoes = Array.from({ length: Math.max(1, payment.maxInstallments) }, (_, i) => i + 1);
  const comTabela = payment.stores.some((s) => s.interestTable && s.interestTable.length > 0);
  const acrescimo = Math.round((plano.total - payment.pixTotal) * 100) / 100;
  const podeMisturar = parts.length > 0;

  return (
    <section>
      <SectionTitle title="Como pagar" description="Cada loja é um pagamento separado; os totais abaixo somam todas." />
      <Card className="mt-4 flex flex-col gap-5">
        <div
          role="group"
          aria-label="Forma de pagamento"
          className={`grid gap-2 rounded-control bg-surface-2 p-1 ${podeMisturar ? "grid-cols-3" : "grid-cols-2"}`}
        >
          <OpcaoMetodo ativo={metodo === "pix"} onClick={() => setMetodo("pix")} icon={QrCode} label="Pix (à vista)" />
          <OpcaoMetodo ativo={metodo === "parcelado"} onClick={() => setMetodo("parcelado")} icon={CreditCard} label="Parcelado" />
          {podeMisturar && (
            <OpcaoMetodo ativo={metodo === "misturar"} onClick={() => setMetodo("misturar")} icon={Split} label="Misturar" />
          )}
        </div>

        {metodo === "pix" && (
          <div>
            <p className="text-sm text-ink-muted">Total no Pix</p>
            <p className="font-display text-4xl font-semibold tracking-tight text-ink">{formatBRL(payment.pixTotal)}</p>
            {payment.pixSavings > 0 && (
              <p className="mt-1 text-sm text-good">
                Você economiza <span className="tnum font-semibold">{formatBRL(payment.pixSavings)}</span> em relação ao parcelado.
              </p>
            )}
          </div>
        )}

        {metodo === "parcelado" && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-ink-muted">{plano.count}x de</p>
              <p className="font-display text-4xl font-semibold tracking-tight text-ink">{formatBRL(plano.monthly)}</p>
              <p className="tnum mt-1 text-sm text-ink-muted">Total parcelado {formatBRL(plano.total)}</p>
              {acrescimo > 0 ? (
                <p className="tnum mt-1 text-sm text-ink-muted">
                  Acréscimo de {formatBRL(acrescimo)} ({formatPercent(acrescimo / payment.pixTotal)}) em relação ao Pix.
                </p>
              ) : (
                <p className="mt-1 text-sm text-good">Sem juros: mesmo preço do Pix.</p>
              )}
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Número de parcelas
              <select
                value={plano.count}
                onChange={(e) => setParcelas(Number(e.target.value))}
                className={`${INPUT_CLASSES} tnum w-40 font-normal`}
              >
                {opcoes.map((n) => (
                  <option key={n} value={n}>
                    {n}x
                  </option>
                ))}
              </select>
              <span className="max-w-64 text-xs font-normal text-ink-faint">
                {comTabela
                  ? "Cada loja parcela até o máximo dela; se uma termina antes, as últimas parcelas ficam menores."
                  : "Limitado pela loja que parcela em menos vezes."}
              </span>
            </label>
          </div>
        )}

        {metodo === "misturar" && podeMisturar && <Misturar parts={parts} payment={payment} />}

        <table className="w-full text-left text-sm">
          <thead className="text-xs text-ink-faint">
            <tr>
              <th className="py-2 font-medium">Loja</th>
              <th className="hidden py-2 text-right font-medium sm:table-cell">Itens</th>
              <th className="py-2 text-right font-medium">Pix</th>
              <th className="py-2 text-right font-medium">Parcelado</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {payment.stores.map((s) => {
              // No modo parcelado, mostra a loja nas parcelas escolhidas; nos
              // outros, no máximo que ela oferece.
              const p = storeInstallment(s, metodo === "parcelado" ? plano.count : Number.MAX_SAFE_INTEGER);
              const semJurosAte = s.interestTable ? interestFreeUpTo(s.interestTable) : 0;
              const extra = Math.round((p.total - s.pixTotal) * 100) / 100;
              return (
                <tr key={s.store.id} className="border-t border-line align-top">
                  <td className="py-2.5 text-ink">{s.store.name}</td>
                  <td className="hidden py-2.5 text-right text-ink-muted sm:table-cell">{s.items}</td>
                  <td className="py-2.5 text-right font-semibold text-ink">{formatBRL(s.pixTotal)}</td>
                  <td className="py-2.5 text-right text-ink-muted">
                    {p.count > 1 ? `${p.count}x de ${formatBRL(p.monthly)}` : "só à vista"}
                    {s.interestTable && (
                      <span className="mt-0.5 block text-xs">
                        {semJurosAte > 0 && <span className="text-good">sem juros até {semJurosAte}x</span>}
                        {semJurosAte > 0 && extra > 0 && <span className="text-ink-faint"> · </span>}
                        {extra > 0 && (
                          <span className="text-ink-faint">
                            +{formatBRL(extra)} ({formatPercent(extra / s.pixTotal)})
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

/** Modo "Misturar": a pessoa diz o que tem à vista e o que cabe por mês. */
function Misturar({ parts, payment }: { parts: BuildPart[]; payment: PaymentSummary }) {
  const id = useId();
  const [aVista, setAVista] = useState("");
  const [porMes, setPorMes] = useState("");

  // As tabelas de juros já vêm no resumo; remontamos o mapa por loja.
  const tabelas: Record<string, InstallmentRate[]> = {};
  for (const s of payment.stores) if (s.interestTable) tabelas[s.store.id] = s.interestTable;

  const preenchido = aVista.trim() !== "" || porMes.trim() !== "";
  const temErro = invalido(aVista) || invalido(porMes);
  const cash = lerReais(aVista);
  const monthly = lerReais(porMes);
  const plano =
    preenchido && !temErro
      ? mixedPlan(parts, { cash: Number.isFinite(cash) ? cash : 0, monthly: Number.isFinite(monthly) ? monthly : 0 }, tabelas)
      : null;
  const erro = "Digite um valor em reais, ex.: 1.500";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Tenho à vista (R$)"
          htmlFor={`${id}-avista`}
          hint="Vai para o Pix, começando pelas peças mais caras."
          error={invalido(aVista) ? erro : null}
        >
          <MoneyInput id={`${id}-avista`} value={aVista} onChange={setAVista} invalid={invalido(aVista)} placeholder="0" />
        </Field>
        <Field
          label="Cabe por mês (R$)"
          htmlFor={`${id}-pormes`}
          hint="O resto vai para o cartão, no menor número de parcelas que cabe."
          error={invalido(porMes) ? erro : null}
        >
          <MoneyInput id={`${id}-pormes`} value={porMes} onChange={setPorMes} invalid={invalido(porMes)} placeholder="0" />
        </Field>
      </div>

      {!plano ? (
        !temErro && (
          <Callout>Diga quanto você tem à vista e quanto cabe por mês para ver a melhor divisão.</Callout>
        )
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-control bg-surface-2 p-4">
              <p className="text-sm text-ink-muted">No Pix</p>
              <p className="font-display text-3xl font-semibold tracking-tight text-ink">{formatBRL(plano.pixTotal)}</p>
              <ListaDePecas pecas={plano.pixItems} vazio="Nenhuma peça no Pix." />
            </div>
            <div className="rounded-control bg-surface-2 p-4">
              <p className="text-sm text-ink-muted">No cartão</p>
              <p className="font-display text-3xl font-semibold tracking-tight text-ink">
                {plano.months > 0 ? `${plano.months}x de ${formatBRL(plano.monthly)}` : formatBRL(0)}
              </p>
              {plano.months > 0 && (
                <p className="tnum text-sm text-ink-muted">Total no cartão {formatBRL(plano.installmentTotal)}</p>
              )}
              <ListaDePecas pecas={plano.installmentItems} vazio="Nada para parcelar." />
            </div>
          </div>
          <Callout tone={plano.fits ? "good" : "warn"} title={plano.fits ? "Cabe no seu orçamento" : "Ainda não cabe por mês"}>
            <ul className="flex flex-col gap-0.5">
              {plano.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </Callout>
        </>
      )}
    </div>
  );
}

function ListaDePecas({ pecas, vazio }: { pecas: BuildPart[]; vazio: string }) {
  if (pecas.length === 0) return <p className="mt-2 text-xs text-ink-faint">{vazio}</p>;
  return (
    <ul className="mt-2 flex flex-col gap-1 text-xs text-ink-muted">
      {pecas.map((p) => (
        <li key={p.product.id} className="flex justify-between gap-3">
          <span className="min-w-0 truncate">{p.product.name}</span>
          <span className="tnum shrink-0">{formatBRL(p.offer.price_pix)}</span>
        </li>
      ))}
    </ul>
  );
}

function OpcaoMetodo({
  ativo,
  onClick,
  icon: Icon,
  label,
}: {
  ativo: boolean;
  onClick: () => void;
  icon: typeof QrCode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-control px-2 py-1.5 text-center text-sm font-medium transition-colors duration-150 ${
        ativo ? "bg-surface text-ink shadow-float" : "text-ink-muted hover:text-ink"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </button>
  );
}
