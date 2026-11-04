// Endpoint que verifica os alertas de preço e envia e-mails quando o preço de
// uma peça (ou de uma montagem salva inteira) cai até o valor que a pessoa pediu.
//
// É um "job de fundo": deve ser chamado por um agendador (ex.: cron) de tempos
// em tempos. Usa a chave service_role, então é protegido por um token secreto
// (CRON_SECRET) que é SEMPRE exigido.
//
// Como testar manualmente:
//   curl -H "Authorization: Bearer SEU_CRON_SECRET" http://localhost:3000/api/check-alerts
//
// V2 (pacote G):
// - SEG-01: sem CRON_SECRET configurado → 503; token errado → 401 (comparação em
//   tempo constante); erros do banco não vazam para quem chamou.
// - SEG-02: e-mail simulado (sem RESEND_API_KEY) NÃO marca o alerta como avisado.
// - R-01: o "menor preço" é o de getBestOffer (ignora preço inválido, loja
//   bloqueada e oferta suspeita), o mesmo do "Melhor preço" do site.
// - G2: alertas com saved_build_id comparam o total atual da montagem com o alvo.
// - DAD-04: os alertas são lidos em lotes (paginação por id) e processados com
//   concorrência limitada, para não estourar o tempo da função.
// - DAD-05: ao avisar, o alerta é desligado (is_active = false) e ganha
//   notified_at; a página /conta mostra "avisado em DD/MM" e oferece "Reativar".
// - F-20: as travas acima têm teste em route.test.ts (cliente admin e e-mail falsos).

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminSupabase } from "@/models/supabase-admin";
import { buildAlertEmail, priceAlertEmail, sendEmail } from "@/services/email";
import { normalizeProduct } from "@/services/products";
import { currentBuildTotal, fromSavedBuildRow, type SavedBuildRow } from "@/services/saved-builds";
import { formatBRL, getBestOffer } from "@/lib/format";
import type { ProductWithOffers } from "@/models/types";

/** Alertas lidos por consulta. */
const LOTE = 100;
/** Teto de lotes por execução (5.000 alertas); o resto fica para a próxima. */
const MAX_LOTES = 50;
/** Quantos alertas são processados ao mesmo tempo (e-mail + consulta de usuário). */
const CONCORRENCIA = 5;

const SELECT_PRODUTO = "*, offers(*, store:stores(*))";

type AlertaRow = {
  id: string;
  user_id: string;
  target_price: number | string;
  product_id: string | null;
  saved_build_id: string | null;
  product: ProductWithOffers | null;
  saved_build: SavedBuildRow | null;
};

type Contagem = { verificados: number; emails_enviados: number; simulados: number; falhas: number };

/** Compara dois textos em tempo constante (o hash iguala os tamanhos). */
function mesmoSegredo(recebido: string, esperado: string): boolean {
  const a = createHash("sha256").update(recebido).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}

/** Roda `tarefa` sobre os itens com no máximo `limite` ao mesmo tempo. */
async function emParalelo<T>(itens: T[], limite: number, tarefa: (item: T) => Promise<void>): Promise<void> {
  let proximo = 0;
  const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (proximo < itens.length) {
      const item = itens[proximo++];
      await tarefa(item);
    }
  });
  await Promise.all(trabalhadores);
}

/** Peças (com ofertas e lojas normalizadas) das montagens deste lote, numa consulta só. */
async function produtosDasMontagens(admin: SupabaseClient, alertas: AlertaRow[]): Promise<ProductWithOffers[] | null> {
  const ids = new Set<string>();
  for (const a of alertas) {
    if (!a.saved_build) continue;
    for (const p of fromSavedBuildRow(a.saved_build).parts) ids.add(p.productId);
  }
  if (ids.size === 0) return [];
  const { data, error } = await admin.from("products").select(SELECT_PRODUTO).in("id", [...ids]);
  if (error) {
    console.error("[check-alerts] erro ao buscar peças das montagens:", error.message);
    return null;
  }
  return ((data ?? []) as unknown as ProductWithOffers[]).map(normalizeProduct);
}

export async function GET(request: Request) {
  // 1) Segurança: o segredo é obrigatório.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET não configurado: defina a variável de ambiente para liberar o job de alertas." },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  if (!mesmoSegredo(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const adminOuNulo = getAdminSupabase();
  if (!adminOuNulo) {
    return NextResponse.json(
      { error: "Supabase admin não configurado (falta SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 503 },
    );
  }
  // Variável sem null para as funções internas abaixo (o TypeScript não leva o "if" para dentro delas).
  const admin: SupabaseClient = adminOuNulo;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const contagem: Contagem = { verificados: 0, emails_enviados: 0, simulados: 0, falhas: 0 };
  // Uma pessoa com vários alertas não gera várias consultas de e-mail.
  const emails = new Map<string, Promise<string | null>>();
  const emailDe = (userId: string) => {
    if (!emails.has(userId)) {
      emails.set(
        userId,
        admin.auth.admin.getUserById(userId).then(({ data }) => data?.user?.email ?? null, () => null),
      );
    }
    return emails.get(userId)!;
  };

  /** Envia o aviso e, só se o e-mail saiu de verdade, desliga o alerta. */
  async function avisar(alerta: AlertaRow, assunto: string, html: string): Promise<void> {
    const email = await emailDe(alerta.user_id);
    if (!email) return;
    const envio = await sendEmail(email, assunto, html);
    if (!envio.ok) {
      contagem.falhas++;
      return;
    }
    if (envio.simulated) {
      // SEG-02: sem RESEND_API_KEY nada foi enviado; o alerta continua pendente.
      console.log(`[check-alerts] e-mail simulado para o alerta ${alerta.id}: não marcado como avisado`);
      contagem.simulados++;
      return;
    }
    const { error } = await admin
      .from("price_alerts")
      .update({ notified_at: new Date().toISOString(), is_active: false })
      .eq("id", alerta.id);
    if (error) {
      console.error(`[check-alerts] e-mail enviado, mas falhou ao marcar o alerta ${alerta.id}:`, error.message);
      contagem.falhas++;
      return;
    }
    contagem.emails_enviados++;
  }

  // 2) Percorre os alertas ativos e ainda não avisados, em lotes por id.
  // Banco sem supabase/schema-alerts.sql ainda não tem saved_build_id: na primeira
  // falha, seguimos só com os alertas de peça (o formato antigo) em vez de parar tudo.
  const COLUNAS_V2 = `id, user_id, target_price, product_id, saved_build_id,
         product:products(${SELECT_PRODUTO}),
         saved_build:saved_builds(id, name, prefs, parts, total_pix, created_at)`;
  const COLUNAS_V1 = `id, user_id, target_price, product_id, product:products(${SELECT_PRODUTO})`;
  let colunas = COLUNAS_V2;

  let ultimoId: string | null = null;
  for (let lote = 0; lote < MAX_LOTES; lote++) {
    const ler = (cols: string) => {
      let consulta = admin
        .from("price_alerts")
        .select(cols)
        .eq("is_active", true)
        .is("notified_at", null)
        .order("id")
        .limit(LOTE);
      if (ultimoId) consulta = consulta.gt("id", ultimoId);
      return consulta;
    };

    let { data, error } = await ler(colunas);
    if (error && colunas === COLUNAS_V2) {
      console.error("[check-alerts] sem alertas de montagem (rode supabase/schema-alerts.sql):", error.message);
      colunas = COLUNAS_V1;
      ({ data, error } = await ler(colunas));
    }
    if (error) {
      console.error("[check-alerts] erro ao buscar alertas:", error.message);
      return NextResponse.json({ error: "Não foi possível ler os alertas.", ...contagem }, { status: 500 });
    }
    const alertas = (data ?? []) as unknown as AlertaRow[];
    if (alertas.length === 0) break;
    ultimoId = alertas[alertas.length - 1].id;
    contagem.verificados += alertas.length;

    const pecasDasMontagens = await produtosDasMontagens(admin, alertas);

    await emParalelo(alertas, CONCORRENCIA, async (alerta) => {
      const alvo = Number(alerta.target_price);
      if (!Number.isFinite(alvo) || alvo <= 0) return;

      // 3a) Alerta de montagem inteira (G2).
      if (alerta.saved_build_id) {
        if (!alerta.saved_build || !pecasDasMontagens) return;
        const montagem = fromSavedBuildRow(alerta.saved_build);
        if (montagem.parts.length === 0) return;
        const { total, missing } = currentBuildTotal(montagem.parts, pecasDasMontagens, {
          trustedOnly: montagem.prefs?.trustedOnly === true,
        });
        // Peça sem oferta hoje: o total não representa a montagem, então não avisamos.
        if (missing.length > 0 || total > alvo) return;
        await avisar(
          alerta,
          `Sua montagem “${montagem.name}” caiu para ${formatBRL(total)}`,
          buildAlertEmail(montagem.name, formatBRL(total), `${baseUrl}/conta`),
        );
        return;
      }

      // 3b) Alerta de uma peça.
      if (!alerta.product) return;
      const produto = normalizeProduct(alerta.product);
      const melhor = getBestOffer(produto);
      if (!melhor || melhor.price_pix > alvo) return;
      await avisar(
        alerta,
        `${produto.name} caiu para ${formatBRL(melhor.price_pix)}`,
        priceAlertEmail(produto.name, formatBRL(melhor.price_pix), `${baseUrl}/peca/${produto.slug}`),
      );
    });

    if (alertas.length < LOTE) break;
  }

  return NextResponse.json(contagem);
}
