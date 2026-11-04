// Página "Minha conta": e-mail, alertas de preço ativos e sair. Exige login.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { getServerSupabase, getCurrentUser } from "@/models/supabase-server";
import { logout } from "@/app/auth/actions";
import { deleteAlert } from "@/app/account/actions";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/SectionTitle";

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

      <section className="mt-8">
        <SectionTitle as="h3" title="Meus alertas de preço" />
        {alertas.length === 0 ? (
          <Card className="mt-3 text-center text-sm text-ink-muted" padding="lg">
            <Bell className="mx-auto h-6 w-6 text-ink-faint" aria-hidden />
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
            {alertas.map((a) => (
              <li key={a.id}>
                <Card className="flex items-center justify-between gap-4" padding="sm">
                  <div>
                    <Link href={`/peca/${a.product?.slug ?? ""}`} className="font-medium text-ink hover:text-brand">
                      {a.product?.name ?? "Peça"}
                    </Link>
                    <p className="text-sm text-ink-muted">
                      avisar quando custar até <span className="tnum font-semibold text-ink">{formatBRL(a.target_price)}</span>
                    </p>
                  </div>
                  <form action={deleteAlert}>
                    <input type="hidden" name="id" value={a.id} />
                    <Button variant="ghost" size="sm">
                      Remover
                    </Button>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
