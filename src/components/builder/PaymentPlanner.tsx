"use client";

// Plano de pagamento: Pix (à vista) × parcelado × misturar (parte no Pix, parte
// no cartão), com a divisão por loja (cada loja é um pagamento separado). Spec §7.
// As contas ficam em services/builder/payments.ts e mixed-plan.ts; aqui só tela.
//
// Premissa mostrada na tela: "a prazo" é o preço parcelado que a loja anuncia
// (maior que o Pix), e ele vale até o número de parcelas do anúncio (S-03).
// "Sem acréscimo" = paga só esse preço a prazo; "+R$ X" = juros da loja acima dele.
//
// TODO(V2-E): campo de cupom (lógica pronta em services/builder/coupons.ts).

import { useId, useState, type ReactNode } from "react";
import { CreditCard, QrCode, Split } from "lucide-react";
import type { BuildPart, PaymentSummary } from "@/models/builder-types";
import {
  defaultInstallmentCount,
  installmentBands,
  installmentOptions,
  installmentPlan,
  interestTablesOf,
  storeInstallment,
  storeNoExtraUpTo,
  type ScheduleBand,
} from "@/services/builder/payments";
import { mixedPlan, mixedPlanPrompt } from "@/services/builder/mixed-plan";
import { formatBRL } from "@/lib/format";
import { MAX_MONEY, formatMoneyPreview, parseMoney } from "@/lib/money";
import { Card } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Field, INPUT_CLASSES, MoneyInput } from "@/components/ui/Field";

type Metodo = "pix" | "parcelado" | "misturar";

/** Erro do campo de dinheiro. Vazio não é erro: `mixedPlanPrompt` pede o que falta. */
function erroDoValor(texto: string): string | null {
  if (texto.trim() === "") return null;
  const n = parseMoney(texto);
  if (!Number.isFinite(n)) return "Digite um valor em reais, ex.: 1.500 ou 1.500,50";
  if (n > MAX_MONEY) return `Valor acima do permitido (${formatBRL(MAX_MONEY)}).`;
  return null;
}

/**
 * Dica do campo com o valor entendido na frente (F-14), igual ao formulário do
 * Montador: "= R$ 3.000,50 · Vai para o Pix…".
 */
function comPrevia(texto: string, dica: string): ReactNode {
  const previa = formatMoneyPreview(texto);
  if (!previa) return dica;
  return (
    <>
      <span className="tnum font-medium text-ink-muted">{previa}</span> · {dica}
    </>
  );
}

/** Percentual em pt-BR, ex.: 0.06 -> "6%", 0.055 -> "5,5%". */
function formatPercent(fracao: number): string {
  return `${(Math.round(fracao * 1000) / 10).toLocaleString("pt-BR")}%`;
}

export function PaymentPlanner({
  payment,
  parts = [],
}: {
  payment: PaymentSummary;
  /** Peças da montagem; sem elas o modo "Misturar" fica escondido. */
  parts?: BuildPart[];
}) {
  const [metodo, setMetodo] = useState<Metodo>("pix");
  // Abre no maior número de parcelas SEM acréscimo (ou no mais barato, se todas têm).
  const [parcelas, setParcelas] = useState(() => defaultInstallmentCount(payment));
  // Montagem nova (outro resumo): volta para o padrão em vez de manter a escolha antiga.
  const [resumoBase, setResumoBase] = useState(payment);
  if (resumoBase !== payment) {
    setResumoBase(payment);
    setParcelas(defaultInstallmentCount(payment));
  }

  const plano = installmentPlan(payment, parcelas);
  const { faixas, arredondamento } = installmentBands(payment, plano.count);
  const opcoes = installmentOptions(payment);
  const comTabela = payment.stores.some((s) => s.interestTable && s.interestTable.length > 0);
  const aMaisQuePix = Math.round((plano.total - payment.pixTotal) * 100) / 100;
  const acimaDoPrazo = Math.round((plano.total - payment.installmentTotal) * 100) / 100;
  const podeMisturar = parts.length > 0;
  const melhor = payment.bestInstallment;

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
                Você economiza <span className="tnum font-semibold">{formatBRL(payment.pixSavings)}</span>{" "}
                {melhor ? `em relação a ${melhor.count}x no cartão, o parcelado mais barato.` : "em relação ao parcelado."}
              </p>
            )}
          </div>
        )}

        {metodo === "parcelado" && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <Faixas faixas={faixas} total={plano.count} />
              {arredondamento > 0 && (
                <p className="tnum mt-1 text-xs text-ink-faint">
                  A 1ª parcela fica {formatBRL(arredondamento)} maior (arredondamento dos centavos).
                </p>
              )}
              <p className="tnum mt-1 text-sm text-ink-muted">Total parcelado {formatBRL(plano.total)}</p>
              {aMaisQuePix > 0 && (
                <p className="tnum mt-1 text-sm text-ink-muted">
                  {formatBRL(aMaisQuePix)} ({formatPercent(aMaisQuePix / payment.pixTotal)}) a mais que no Pix.
                </p>
              )}
              {acimaDoPrazo > 0 ? (
                <p className="tnum mt-1 text-sm text-ink-muted">
                  Inclui {formatBRL(acimaDoPrazo)} de acréscimo sobre o preço a prazo das lojas.
                </p>
              ) : (
                <p className="mt-1 text-sm text-good">Sem acréscimo: é o preço a prazo anunciado pelas lojas.</p>
              )}
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Número de parcelas
              <select
                value={plano.count}
                onChange={(e) => setParcelas(Number(e.target.value))}
                className={`${INPUT_CLASSES} tnum w-full font-normal sm:w-56`}
              >
                {opcoes.map((o) => (
                  <option key={o.count} value={o.count}>
                    {o.count}x · {o.extra > 0 ? `+${formatBRL(o.extra)}` : "sem acréscimo"}
                  </option>
                ))}
              </select>
              <span className="max-w-64 text-xs font-normal text-ink-faint">
                {/* S-04b: com ou sem tabela, cada loja limita só as parcelas dela. */}
                {comTabela && "Acréscimo sobre o preço a prazo. "}
                Cada loja parcela até o máximo dela; se uma termina antes, as últimas parcelas ficam menores.
              </span>
            </label>
          </div>
        )}

        {metodo === "misturar" && podeMisturar && <Misturar parts={parts} payment={payment} />}

        <table className="w-full text-left text-sm">
          <caption className="sr-only">Pagamento por loja</caption>
          <thead className="text-xs text-ink-faint">
            <tr>
              <th scope="col" className="py-2 font-medium">Loja</th>
              <th scope="col" className="hidden py-2 text-right font-medium sm:table-cell">Itens</th>
              <th scope="col" className="py-2 text-right font-medium">Pix</th>
              <th scope="col" className="py-2 text-right font-medium">A prazo</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {payment.stores.map((s) => {
              // No modo parcelado, mostra a loja nas parcelas escolhidas; nos
              // outros, no máximo que ela oferece.
              const p = storeInstallment(s, metodo === "parcelado" ? plano.count : Number.MAX_SAFE_INTEGER);
              // Parcela "cheia" (a última faixa); o resto dos centavos vai na 1ª.
              const parcela = p.schedule?.[p.schedule.length - 1]?.monthly ?? p.monthly;
              const semAcrescimoAte = s.interestTable ? storeNoExtraUpTo(s) : 0;
              const extra = Math.round((p.total - s.installmentTotal) * 100) / 100;
              return (
                <tr key={s.store.id} className="border-t border-line align-top">
                  <th scope="row" className="py-2.5 font-normal text-ink">{s.store.name}</th>
                  <td className="hidden py-2.5 text-right text-ink-muted sm:table-cell">{s.items}</td>
                  <td className="py-2.5 text-right font-semibold text-ink">{formatBRL(s.pixTotal)}</td>
                  <td className="py-2.5 text-right text-ink-muted">
                    <span className="text-ink">{formatBRL(s.installmentTotal)}</span>
                    <span className="mt-0.5 block text-xs">
                      {p.count > 1 ? `${p.count}x de ${formatBRL(parcela)}` : "só à vista"}
                    </span>
                    {(semAcrescimoAte > 1 || extra > 0) && (
                      <span className="mt-0.5 block text-xs">
                        {semAcrescimoAte > 1 && <span className="text-good">sem acréscimo até {semAcrescimoAte}x</span>}
                        {semAcrescimoAte > 1 && extra > 0 && <span className="text-ink-faint"> · </span>}
                        {extra > 0 && <span className="text-ink-faint">+{formatBRL(extra)} em {p.count}x</span>}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="-mt-2 text-xs text-ink-faint">
          A prazo é o preço parcelado que a loja anuncia (maior que o Pix). Ele vale até o número de parcelas do
          anúncio; juros acima dele aparecem como acréscimo.
        </p>
      </Card>
    </section>
  );
}

/**
 * Manchete das parcelas. Uma faixa: "12x de R$ 140". Várias (lojas com prazos
 * diferentes): "10x de R$ 586,17" e embaixo "+ 2x de R$ 551,49".
 */
function Faixas({ faixas, total, tamanho = "lg" }: { faixas: ScheduleBand[]; total: number; tamanho?: "lg" | "md" }) {
  const grande = tamanho === "lg" ? "text-4xl" : "text-3xl";
  if (faixas.length <= 1) {
    const f = faixas[0] ?? { count: total, monthly: 0 };
    return (
      <>
        <p className="text-sm text-ink-muted">{f.count}x de</p>
        <p className={`font-display ${grande} font-semibold tracking-tight text-ink`}>{formatBRL(f.monthly)}</p>
      </>
    );
  }
  const [primeira, ...resto] = faixas;
  return (
    <>
      <p className="text-sm text-ink-muted">Em {total} parcelas</p>
      <p className={`font-display ${tamanho === "lg" ? "text-3xl sm:text-4xl" : "text-2xl"} font-semibold tracking-tight text-ink`}>
        {primeira.count}x de {formatBRL(primeira.monthly)}
      </p>
      {resto.map((f) => (
        <p key={`${f.count}-${f.monthly}`} className="tnum text-lg font-semibold text-ink-muted">
          + {f.count}x de {formatBRL(f.monthly)}
        </p>
      ))}
    </>
  );
}

/** Modo "Misturar": a pessoa diz o que tem à vista e o que cabe por mês. */
function Misturar({ parts, payment }: { parts: BuildPart[]; payment: PaymentSummary }) {
  const id = useId();
  const [aVista, setAVista] = useState("");
  const [porMes, setPorMes] = useState("");

  // As tabelas de juros já vêm no resumo; remontamos o mapa por loja.
  const tabelas = interestTablesOf(payment);

  // F-11: só calcula com os DOIS campos preenchidos (0 vale). Com "cabe por mês"
  // vazio, o plano diria "falta R$ X por mês" sem a pessoa ter dito quanto cabe.
  const falta = mixedPlanPrompt(aVista, porMes);
  const erroAVista = erroDoValor(aVista);
  const erroPorMes = erroDoValor(porMes);
  const temErro = erroAVista !== null || erroPorMes !== null;
  const cash = parseMoney(aVista);
  const monthly = parseMoney(porMes);
  const plano =
    falta === null && !temErro
      ? mixedPlan(parts, { cash: Number.isFinite(cash) ? cash : 0, monthly: Number.isFinite(monthly) ? monthly : 0 }, tabelas)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Tenho à vista (R$)"
          htmlFor={`${id}-avista`}
          hint={comPrevia(aVista, "Vai para o Pix, começando pelas peças que mais encarecem no cartão.")}
          error={erroAVista}
        >
          <MoneyInput id={`${id}-avista`} value={aVista} onChange={setAVista} invalid={erroAVista !== null} placeholder="0" />
        </Field>
        <Field
          label="Cabe por mês (R$)"
          htmlFor={`${id}-pormes`}
          hint={comPrevia(porMes, "O resto vai para o cartão, no menor número de parcelas que cabe.")}
          error={erroPorMes}
        >
          <MoneyInput id={`${id}-pormes`} value={porMes} onChange={setPorMes} invalid={erroPorMes !== null} placeholder="0" />
        </Field>
      </div>

      {!plano ? (
        !temErro && falta && <Callout>{falta}</Callout>
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
              {plano.months > 0 ? (
                <>
                  <Faixas faixas={plano.schedule} total={plano.months} tamanho="md" />
                  <p className="tnum text-sm text-ink-muted">Total no cartão {formatBRL(plano.installmentTotal)}</p>
                </>
              ) : (
                <p className="font-display text-3xl font-semibold tracking-tight text-ink">{formatBRL(0)}</p>
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
