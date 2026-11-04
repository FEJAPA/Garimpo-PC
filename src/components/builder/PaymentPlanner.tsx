"use client";

// Plano de pagamento: Pix (à vista) × parcelado, com seletor de parcelas e a
// divisão por loja (cada loja é um pagamento separado). Spec §7.
//
// TODO(V2-E): juros reais por loja/parcelas, misturar Pix + cartão por peça,
// "quanto cabe por mês", cupons.

import { useState } from "react";
import { CreditCard, QrCode } from "lucide-react";
import type { PaymentSummary } from "@/models/builder-types";
import { installmentPlan } from "@/services/builder/payments";
import { formatBRL } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { INPUT_CLASSES } from "@/components/ui/Field";

type Metodo = "pix" | "parcelado";

export function PaymentPlanner({ payment }: { payment: PaymentSummary }) {
  const [metodo, setMetodo] = useState<Metodo>("pix");
  const [parcelas, setParcelas] = useState(payment.maxInstallments);
  const plano = installmentPlan(payment, parcelas);
  const opcoes = Array.from({ length: Math.max(1, payment.maxInstallments) }, (_, i) => i + 1);

  return (
    <section>
      <SectionTitle title="Como pagar" description="Cada loja é um pagamento separado; os totais abaixo somam todas." />
      <Card className="mt-4 flex flex-col gap-5">
        <div role="group" aria-label="Forma de pagamento" className="grid grid-cols-2 gap-2 rounded-control bg-surface-2 p-1">
          <OpcaoMetodo ativo={metodo === "pix"} onClick={() => setMetodo("pix")} icon={QrCode} label="Pix (à vista)" />
          <OpcaoMetodo ativo={metodo === "parcelado"} onClick={() => setMetodo("parcelado")} icon={CreditCard} label="Parcelado" />
        </div>

        {metodo === "pix" ? (
          <div>
            <p className="text-sm text-ink-muted">Total no Pix</p>
            <p className="font-display text-4xl font-semibold tracking-tight text-ink">{formatBRL(payment.pixTotal)}</p>
            {payment.pixSavings > 0 && (
              <p className="mt-1 text-sm text-good">
                Você economiza <span className="tnum font-semibold">{formatBRL(payment.pixSavings)}</span> em relação ao parcelado.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-ink-muted">{plano.count}x de</p>
              <p className="font-display text-4xl font-semibold tracking-tight text-ink">{formatBRL(plano.monthly)}</p>
              <p className="tnum mt-1 text-sm text-ink-muted">Total parcelado {formatBRL(plano.total)}</p>
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
              <span className="text-xs font-normal text-ink-faint">Limitado pela loja que parcela em menos vezes.</span>
            </label>
          </div>
        )}

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
            {payment.stores.map((s) => (
              <tr key={s.store.id} className="border-t border-line">
                <td className="py-2.5 text-ink">{s.store.name}</td>
                <td className="hidden py-2.5 text-right text-ink-muted sm:table-cell">{s.items}</td>
                <td className="py-2.5 text-right font-semibold text-ink">{formatBRL(s.pixTotal)}</td>
                <td className="py-2.5 text-right text-ink-muted">
                  {s.installmentCount > 1
                    ? `${s.installmentCount}x de ${formatBRL(s.installmentTotal / s.installmentCount)}`
                    : "só à vista"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
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
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-control text-sm font-medium transition-colors duration-150 ${
        ativo ? "bg-surface text-ink shadow-float" : "text-ink-muted hover:text-ink"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}
