"use server";

// Ações de servidor para favoritos e alertas de preço (exigem login).

import { revalidatePath } from "next/cache";
import { getServerSupabase, getCurrentUser } from "@/models/supabase-server";

/** Resolve o id interno da peça a partir do slug (ex.: "rtx-4060"). */
async function getProductId(slug: string): Promise<string | null> {
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle();
  return data?.id ?? null;
}

/** Cria um alerta: avisa quando o preço PIX cair até o valor alvo. */
export async function createAlert(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Você precisa entrar para criar um alerta." };

  const slug = String(formData.get("slug") ?? "");
  const targetPrice = Number(formData.get("target_price"));
  if (!slug || !Number.isFinite(targetPrice) || targetPrice <= 0) {
    return { ok: false, message: "Informe um preço-alvo válido." };
  }

  const productId = await getProductId(slug);
  if (!productId) return { ok: false, message: "Peça não encontrada." };

  const supabase = await getServerSupabase();
  const { error } = await supabase.from("price_alerts").insert({
    user_id: user.id,
    product_id: productId,
    target_price: targetPrice,
  });

  if (error) return { ok: false, message: "Não foi possível criar o alerta." };

  revalidatePath(`/peca/${slug}`);
  revalidatePath("/conta");
  return { ok: true, message: "Alerta criado! Avisaremos quando o preço cair." };
}

/** Remove um alerta do usuário. */
export async function deleteAlert(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id") ?? "");
  const supabase = await getServerSupabase();
  await supabase.from("price_alerts").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/conta");
}
