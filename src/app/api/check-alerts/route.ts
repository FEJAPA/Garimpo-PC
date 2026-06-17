// Endpoint que verifica os alertas de preço e envia e-mails quando o preço de
// uma peça cai até o valor que o usuário pediu.
//
// É um "job de fundo": deve ser chamado por um agendador (ex.: cron) de tempos
// em tempos. Protegido por um token secreto (CRON_SECRET) para que só nós
// possamos dispará-lo.
//
// Como testar manualmente:
//   curl -H "Authorization: Bearer SEU_CRON_SECRET" http://localhost:3000/api/check-alerts

import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/models/supabase-admin";
import { sendEmail, priceAlertEmail } from "@/services/email";
import { formatBRL } from "@/lib/format";

export async function GET(request: Request) {
  // 1) Segurança: exige o token secreto.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const admin = getAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: "Supabase admin não configurado (falta SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 }
    );
  }

  // 2) Busca alertas ativos ainda não notificados, com peça e ofertas em estoque.
  const { data: alertas, error } = await admin
    .from("price_alerts")
    .select(
      "id, user_id, target_price, product:products(name, slug, offers(price_pix, in_stock))"
    )
    .eq("is_active", true)
    .is("notified_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  let enviados = 0;

  for (const alerta of alertas ?? []) {
    // O Supabase devolve "product" como objeto único aqui.
    const produto = alerta.product as unknown as {
      name: string;
      slug: string;
      offers: { price_pix: number; in_stock: boolean }[];
    } | null;
    if (!produto) continue;

    const precos = produto.offers.filter((o) => o.in_stock).map((o) => o.price_pix);
    if (precos.length === 0) continue;
    const menor = Math.min(...precos);

    // 3) Preço atingiu o alvo? Então notifica.
    if (menor <= Number(alerta.target_price)) {
      // Descobre o e-mail do usuário (via admin auth).
      const { data: userRes } = await admin.auth.admin.getUserById(alerta.user_id);
      const email = userRes?.user?.email;
      if (!email) continue;

      const link = `${baseUrl}/peca/${produto.slug}`;
      const ok = await sendEmail(
        email,
        `⛏️ ${produto.name} caiu para ${formatBRL(menor)}!`,
        priceAlertEmail(produto.name, formatBRL(menor), link)
      );

      if (ok) {
        await admin
          .from("price_alerts")
          .update({ notified_at: new Date().toISOString() })
          .eq("id", alerta.id);
        enviados++;
      }
    }
  }

  return NextResponse.json({ verificados: alertas?.length ?? 0, emails_enviados: enviados });
}
