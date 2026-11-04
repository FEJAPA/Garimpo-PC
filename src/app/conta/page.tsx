// Página "Minha conta": e-mail, montagens salvas, alertas de preço e sair. Exige login.
//
// V2 (pacote G):
// - G1: lista as montagens salvas (nome, total no Pix, data e link para reabrir no Montador).
// - G2: cada montagem pode ter um alerta "avisar quando custar até R$ X".
// - DAD-05: quando a rota de alertas avisa, ela desliga o alerta (is_active = false)
//   e grava notified_at. Aqui ele sai de "ativos" e aparece como "avisado em DD/MM",
//   com o botão "Reativar".
// - A11Y-10: cada "Remover" diz o que remove.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, BellRing, Bookmark } from "lucide-react";
import { getServerSupabase, getCurrentUser } from "@/models/supabase-server";
import { logout } from "@/app/auth/actions";
import { deleteAlert, deleteSavedBuild, reactivateAlert } from "@/app/account/actions";
import { formatBRL } from "@/lib/format";
import { encodeBuild } from "@/lib/share";
import { fromSavedBuildRow, sharePartsFromRow, type SavedBuildRow } from "@/services/saved-builds";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SavedBuildAlertForm } from "@/components/builder/SaveBuildButton";

type AlertRow = {
  id: string;
  target_price: number | string;
  is_active: boolean;
  notified_at: string | null;
  saved_build_id?: string | null;
  product: { name: string; slug: string } | null;
};

/** Avisos vindos das actions por código (a URL nunca carrega texto livre para a tela). */
const AVISOS: Record<string, string> = {
  "erro-remover-alerta": "Não foi possível remover o alerta. Tente de novo.",
  "erro-reativar-alerta": "Não foi possível reativar o alerta. Tente de novo.",
  "erro-remover-montagem": "Não foi possível remover a montagem. Tente de novo.",
};

const DIA_MES = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const DATA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function avisadoEm(iso: string): string {
  return `avisado em ${DIA_MES.format(new Date(iso))}`;
}

/** Botão "Remover" de um alerta, com nome acessível que diz qual (A11Y-10). */
function RemoverAlerta({ id, rotulo }: { id: string; rotulo: string }) {
  return (
    <form action={deleteAlert}>
      <input type="hidden" name="id" value={id} />
      <Button variant="ghost" size="sm" aria-label={`Remover alerta de ${rotulo}`}>
        Remover
      </Button>
    </form>
  );
}

function ReativarAlerta({ id, rotulo }: { id: string; rotulo: string }) {
  return (
    <form action={reactivateAlert}>
      <input type="hidden" name="id" value={id} />
      <Button variant="secondary" size="sm" aria-label={`Reativar alerta de ${rotulo}`}>
        Reativar
      </Button>
    </form>
  );
}

export default async function ContaPage(props: PageProps<"/conta">) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=%2Fconta");

  const params = await props.searchParams;
  const aviso = typeof params.aviso === "string" ? (AVISOS[params.aviso] ?? null) : null;

  const supabase = await getServerSupabase();

  // Alertas: ativos e já avisados. Bancos sem schema-alerts.sql ainda não têm
  // saved_build_id; nesse caso repetimos a consulta sem a coluna.
  const COLUNAS = "id, target_price, is_active, notified_at, product:products(name, slug)";
  let alertasRes = await supabase
    .from("price_alerts")
    .select(`${COLUNAS}, saved_build_id`)
    .order("created_at", { ascending: false });
  if (alertasRes.error) {
    console.error("Erro ao ler alertas (tentando sem saved_build_id):", alertasRes.error.message);
    alertasRes = (await supabase
      .from("price_alerts")
      .select(COLUNAS)
      .order("created_at", { ascending: false })) as typeof alertasRes;
  }
  const erroAlertas = Boolean(alertasRes.error);
  const todos = (alertasRes.data ?? []) as unknown as AlertRow[];
  const deMontagem = todos.filter((a) => a.saved_build_id);
  const dePeca = todos.filter((a) => !a.saved_build_id);
  const ativos = dePeca.filter((a) => a.is_active && !a.notified_at);
  const avisados = dePeca.filter((a) => a.notified_at);

  const montagensRes = await supabase
    .from("saved_builds")
    .select("id, name, prefs, parts, total_pix, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const erroMontagens = Boolean(montagensRes.error);
  if (montagensRes.error) console.error("Erro ao ler montagens salvas:", montagensRes.error.message);
  const linhas = (montagensRes.data ?? []) as unknown as SavedBuildRow[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <SectionTitle
        as="h1"
        title="Minha conta"
        description={user.email}
        action={
          <form action={logout}>
            <Button variant="ghost" size="sm">
              Sair
            </Button>
          </form>
        }
      />

      {aviso && (
        <Callout tone="bad" className="mt-6">
          {aviso}
        </Callout>
      )}

      <section className="mt-8" aria-labelledby="titulo-montagens">
        <SectionTitle as="h2" title={<span id="titulo-montagens">Minhas montagens</span>} />
        {erroMontagens ? (
          <Callout tone="bad" className="mt-3">
            Não foi possível carregar suas montagens agora. Recarregue a página em instantes.
          </Callout>
        ) : linhas.length === 0 ? (
          <Card className="mt-3 text-center text-sm text-ink-muted" padding="lg">
            <Bookmark className="mx-auto h-6 w-6 text-ink-faint" strokeWidth={1.75} aria-hidden />
            <p className="mt-3">
              Você ainda não salvou nenhuma montagem. Monte um PC e clique em{" "}
              <strong className="text-ink">“Salvar montagem”</strong>.
            </p>
            <Link href="/montar" className="mt-3 inline-block font-medium text-brand hover:underline">
              Montar um PC
            </Link>
          </Card>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {linhas.map((linha) => {
              const m = fromSavedBuildRow(linha);
              const partesLink = sharePartsFromRow(linha);
              // Só monta o código se todas as peças têm slug e loja (montagens antigas podem não ter).
              const href =
                m.prefs && partesLink.length === m.parts.length && partesLink.length > 0
                  ? `/montar?b=${encodeBuild(m.prefs, partesLink)}`
                  : "/montar";
              const alerta = deMontagem.find((a) => a.saved_build_id === m.id);
              const alvo = alerta ? Number(alerta.target_price) : null;
              return (
                <li key={m.id}>
                  <Card padding="sm" className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-medium text-ink">{m.name}</h3>
                        <p className="text-sm text-ink-muted">
                          <span className="tnum font-semibold text-ink">{formatBRL(m.totalPix)}</span> no Pix ·{" "}
                          {m.parts.length} peças · salva em {DATA.format(new Date(m.createdAt))}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <ButtonLink href={href} variant="secondary" size="sm">
                          Abrir no Montador
                        </ButtonLink>
                        <form action={deleteSavedBuild}>
                          <input type="hidden" name="id" value={m.id} />
                          <Button variant="ghost" size="sm" aria-label={`Remover a montagem ${m.name}`}>
                            Remover
                          </Button>
                        </form>
                      </div>
                    </div>

                    {alerta && alvo !== null && (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
                        <p className="flex items-center gap-2 text-ink-muted">
                          {alerta.notified_at ? (
                            <Badge tone="good">
                              <BellRing className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                              {avisadoEm(alerta.notified_at)}
                            </Badge>
                          ) : (
                            <Badge tone="brand">
                              <Bell className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                              Alerta ativo
                            </Badge>
                          )}
                          <span>
                            até <span className="tnum font-semibold text-ink">{formatBRL(alvo)}</span>
                          </span>
                        </p>
                        <div className="flex items-center gap-2">
                          {alerta.notified_at && <ReativarAlerta id={alerta.id} rotulo={m.name} />}
                          <RemoverAlerta id={alerta.id} rotulo={m.name} />
                        </div>
                      </div>
                    )}

                    <SavedBuildAlertForm
                      buildId={m.id}
                      buildName={m.name}
                      suggested={alvo ?? Math.floor(m.totalPix * 0.95)}
                    />
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="titulo-alertas">
        <SectionTitle as="h2" title={<span id="titulo-alertas">Meus alertas de preço</span>} />
        {erroAlertas ? (
          <Callout tone="bad" className="mt-3">
            Não foi possível carregar seus alertas agora. Recarregue a página em instantes.
          </Callout>
        ) : ativos.length === 0 && avisados.length === 0 ? (
          <Card className="mt-3 text-center text-sm text-ink-muted" padding="lg">
            <Bell className="mx-auto h-6 w-6 text-ink-faint" strokeWidth={1.75} aria-hidden />
            <p className="mt-3">
              Você ainda não tem alertas. Abra uma peça e clique em{" "}
              <strong className="text-ink">“Criar alerta de preço”</strong>.
            </p>
            <Link href="/busca" className="mt-3 inline-block font-medium text-brand hover:underline">
              Ver peças
            </Link>
          </Card>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {ativos.map((a) => (
              <li key={a.id}>
                <Card className="flex items-center justify-between gap-4" padding="sm">
                  <div className="min-w-0">
                    <Link href={`/peca/${a.product?.slug ?? ""}`} className="font-medium text-ink hover:text-brand">
                      {a.product?.name ?? "Peça"}
                    </Link>
                    <p className="text-sm text-ink-muted">
                      avisar quando custar até{" "}
                      <span className="tnum font-semibold text-ink">{formatBRL(Number(a.target_price))}</span>
                    </p>
                  </div>
                  <RemoverAlerta id={a.id} rotulo={a.product?.name ?? "peça"} />
                </Card>
              </li>
            ))}
            {avisados.map((a) => (
              <li key={a.id}>
                <Card className="flex flex-wrap items-center justify-between gap-4" padding="sm">
                  <div className="min-w-0">
                    <Link href={`/peca/${a.product?.slug ?? ""}`} className="font-medium text-ink hover:text-brand">
                      {a.product?.name ?? "Peça"}
                    </Link>
                    <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                      <Badge tone="good">
                        <BellRing className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                        {avisadoEm(a.notified_at as string)}
                      </Badge>
                      <span>
                        alvo de <span className="tnum font-semibold text-ink">{formatBRL(Number(a.target_price))}</span>{" "}
                        · pausado até você reativar
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ReativarAlerta id={a.id} rotulo={a.product?.name ?? "peça"} />
                    <RemoverAlerta id={a.id} rotulo={a.product?.name ?? "peça"} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
