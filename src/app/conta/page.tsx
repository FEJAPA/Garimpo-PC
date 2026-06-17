// Página "Minha conta": mostra o e-mail do usuário, seus alertas de preço ativos
// e o botão de sair. Exige login (redireciona para /entrar se não estiver logado).

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSupabase, getCurrentUser } from "@/models/supabase-server";
import { logout } from "@/app/auth/actions";
import { deleteAlert } from "@/app/account/actions";
import { formatBRL } from "@/lib/format";

type AlertRow = {
  id: string;
  target_price: number;
  product: { name: string; slug: string } | null;
};

export default async function ContaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("price_alerts")
    .select("id, target_price, product:products(name, slug)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const alertas = (data ?? []) as unknown as AlertRow[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Minha conta</h1>
          <p className="mt-1 text-sm text-ink-muted">{user.email}</p>
        </div>
        <form action={logout}>
          <button className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink transition hover:border-bad hover:text-bad">
            Sair
          </button>
        </form>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">🔔 Meus alertas de preço</h2>

        {alertas.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-ink-muted">
            Você ainda não tem alertas. Abra uma peça e clique em{" "}
            <strong className="text-ink">“Criar alerta de preço”</strong>.
            <div className="mt-3">
              <Link href="/" className="text-accent hover:underline">
                Ver peças →
              </Link>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {alertas.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4"
              >
                <div>
                  <Link
                    href={`/peca/${a.product?.slug ?? ""}`}
                    className="font-medium text-ink hover:text-accent"
                  >
                    {a.product?.name ?? "Peça"}
                  </Link>
                  <p className="text-sm text-ink-muted">
                    avisar quando custar até{" "}
                    <span className="font-semibold text-good">
                      {formatBRL(a.target_price)}
                    </span>
                  </p>
                </div>
                <form action={deleteAlert}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="text-sm text-ink-faint transition hover:text-bad">
                    Remover
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
