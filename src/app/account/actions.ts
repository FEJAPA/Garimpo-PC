"use server";

// Ações de servidor da conta: alertas de preço (de peça e de montagem) e
// montagens salvas. Todas exigem login, e a RLS do banco confere o dono de novo.
//
// V2 (pacote G): saveBuild/deleteSavedBuild (G1), createBuildAlert (G2),
// reactivateAlert (DAD-05), teto do preço-alvo (SEG-10) e erro do delete (SEG-11).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSupabase, getCurrentUser } from "@/models/supabase-server";
import { parseSavedBuildForm, parseTargetPrice, type SavedBuildRowPart } from "@/services/saved-builds";

type ActionResult = { ok: boolean; message: string };

/** Quantas montagens cada pessoa pode guardar (evita encher o banco com cliques repetidos). */
const MAX_SAVED_BUILDS = 50;

/** Volta para /conta com um código de aviso (a página traduz o código; texto livre na URL não). */
function voltarParaConta(aviso: string): never {
  redirect(`/conta?aviso=${aviso}`);
}

/** Resolve o id interno da peça a partir do slug (ex.: "rtx-4060"). */
async function getProductId(slug: string): Promise<string | null> {
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle();
  return data?.id ?? null;
}

/** Cria um alerta: avisa quando o preço PIX cair até o valor alvo. */
export async function createAlert(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Você precisa entrar para criar um alerta." };

  const slug = String(formData.get("slug") ?? "");
  const alvo = parseTargetPrice(formData.get("target_price"));
  if (!slug) return { ok: false, message: "Peça não encontrada." };
  if (!alvo.ok) return { ok: false, message: alvo.message };

  const productId = await getProductId(slug);
  if (!productId) return { ok: false, message: "Peça não encontrada." };

  const supabase = await getServerSupabase();
  const { error } = await supabase.from("price_alerts").insert({
    user_id: user.id,
    product_id: productId,
    target_price: alvo.value,
  });

  if (error) return { ok: false, message: "Não foi possível criar o alerta." };

  revalidatePath(`/peca/${slug}`);
  revalidatePath("/conta");
  return { ok: true, message: "Alerta criado! Avisaremos quando o preço cair." };
}

/** Remove um alerta do usuário (de peça ou de montagem). */
export async function deleteAlert(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=%2Fconta");
  const id = String(formData.get("id") ?? "");
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("price_alerts").delete().eq("id", id).eq("user_id", user.id);
  // SEG-11: uma falha não pode aparecer como sucesso.
  if (error) {
    console.error("Erro ao remover alerta:", error.message);
    voltarParaConta("erro-remover-alerta");
  }
  revalidatePath("/conta");
}

/**
 * Reativa um alerta que já avisou (DAD-05). Ao avisar, a rota /api/check-alerts
 * desliga o alerta (is_active = false) e grava notified_at; reativar zera os dois
 * para a rota voltar a verificar.
 */
export async function reactivateAlert(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=%2Fconta");
  const id = String(formData.get("id") ?? "");
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("price_alerts")
    .update({ is_active: true, notified_at: null })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    console.error("Erro ao reativar alerta:", error.message);
    voltarParaConta("erro-reativar-alerta");
  }
  revalidatePath("/conta");
}

/**
 * Salva a montagem atual (G1). O formulário traz `name`, `prefs` e `parts` (JSON
 * de toSavedBuildRow). As ofertas são conferidas no banco: o preço gravado é o
 * de lá, e a peça precisa bater com a oferta (o jsonb não tem chave estrangeira).
 */
export async function saveBuild(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Você precisa entrar para salvar a montagem." };

  const lido = parseSavedBuildForm(formData);
  if (!lido.ok) return lido;
  const { name, prefs, parts } = lido.value;

  const supabase = await getServerSupabase();

  const { count, error: erroContagem } = await supabase
    .from("saved_builds")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (erroContagem) {
    console.error("Erro ao contar montagens salvas:", erroContagem.message);
    return { ok: false, message: "Não foi possível salvar a montagem agora. Tente de novo em instantes." };
  }
  if ((count ?? 0) >= MAX_SAVED_BUILDS) {
    return {
      ok: false,
      message: `Você já tem ${MAX_SAVED_BUILDS} montagens salvas. Remova alguma em Minha conta para salvar esta.`,
    };
  }

  const { data: ofertas, error: erroOfertas } = await supabase
    .from("offers")
    .select("id, product_id, store_id, price_pix, product:products(slug)")
    .in(
      "id",
      parts.map((p) => p.offerId),
    );
  if (erroOfertas) {
    console.error("Erro ao conferir as ofertas da montagem:", erroOfertas.message);
    return { ok: false, message: "Não foi possível salvar a montagem agora. Tente de novo em instantes." };
  }

  type OfertaBanco = {
    id: string;
    product_id: string;
    store_id: string;
    price_pix: number | string;
    product: { slug: string } | null;
  };
  const porId = new Map(((ofertas ?? []) as unknown as OfertaBanco[]).map((o) => [o.id, o]));
  const partesConferidas: SavedBuildRowPart[] = [];
  for (const parte of parts) {
    const oferta = porId.get(parte.offerId);
    const preco = Number(oferta?.price_pix);
    if (!oferta || oferta.product_id !== parte.productId || !Number.isFinite(preco) || preco <= 0) {
      return { ok: false, message: "Alguma oferta da montagem mudou ou saiu do ar. Monte de novo e tente salvar." };
    }
    partesConferidas.push({
      productId: parte.productId,
      offerId: parte.offerId,
      price: preco,
      slug: oferta.product?.slug,
      storeId: oferta.store_id,
    });
  }
  const totalPix = Math.round(partesConferidas.reduce((s, p) => s + p.price, 0) * 100) / 100;

  const { error } = await supabase.from("saved_builds").insert({
    user_id: user.id,
    name,
    prefs,
    parts: partesConferidas,
    total_pix: totalPix,
  });
  if (error) {
    console.error("Erro ao salvar montagem:", error.message);
    return { ok: false, message: "Não foi possível salvar a montagem agora. Tente de novo em instantes." };
  }

  revalidatePath("/conta");
  return { ok: true, message: `Montagem “${name}” salva em Minha conta.` };
}

/** Remove uma montagem salva (os alertas dela somem junto, pelo "on delete cascade"). */
export async function deleteSavedBuild(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=%2Fconta");
  const id = String(formData.get("id") ?? "");
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("saved_builds").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    console.error("Erro ao remover montagem:", error.message);
    voltarParaConta("erro-remover-montagem");
  }
  revalidatePath("/conta");
}

/**
 * Cria (ou atualiza) o alerta da montagem inteira (G2): avisa quando a soma do
 * melhor preço de hoje de cada peça cair até o valor pedido. Um alerta ativo
 * por montagem: se já existe, troca o valor e volta a vigiar.
 */
export async function createBuildAlert(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Você precisa entrar para criar um alerta." };

  const buildId = String(formData.get("saved_build_id") ?? "");
  const alvo = parseTargetPrice(formData.get("target_price"));
  if (!alvo.ok) return { ok: false, message: alvo.message };

  const supabase = await getServerSupabase();
  const { data: montagem } = await supabase
    .from("saved_builds")
    .select("id")
    .eq("id", buildId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!montagem) return { ok: false, message: "Montagem não encontrada." };

  const { data: existente } = await supabase
    .from("price_alerts")
    .select("id")
    .eq("saved_build_id", buildId)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const { error } = existente
    ? await supabase
        .from("price_alerts")
        .update({ target_price: alvo.value, is_active: true, notified_at: null })
        .eq("id", existente.id)
        .eq("user_id", user.id)
    : await supabase.from("price_alerts").insert({
        user_id: user.id,
        saved_build_id: buildId,
        target_price: alvo.value,
      });

  if (error) {
    console.error("Erro ao criar alerta da montagem:", error.message);
    return { ok: false, message: "Não foi possível criar o alerta da montagem." };
  }

  revalidatePath("/conta");
  return { ok: true, message: "Alerta criado! Avisaremos quando a montagem cair até esse valor." };
}
