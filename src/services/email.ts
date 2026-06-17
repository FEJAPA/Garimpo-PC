// Envio de e-mails via Resend. Usado para os alertas de queda de preço.
// A chave fica em RESEND_API_KEY (.env.local). Sem a chave, o envio é apenas
// simulado no console (útil para testar sem configurar o Resend ainda).

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
// Remetente: enquanto não houver domínio próprio verificado, usar o de testes
// do Resend (onboarding@resend.dev) ou o configurado em EMAIL_FROM.
const from = process.env.EMAIL_FROM ?? "GarimpoPC <onboarding@resend.dev>";

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!apiKey) {
    console.log(`[email simulado] para=${to} assunto="${subject}"`);
    return true;
  }
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({ from, to, subject, html });
    if (error) {
      console.error("Erro ao enviar e-mail:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Falha no envio de e-mail:", e);
    return false;
  }
}

/** Monta o HTML do e-mail de alerta de queda de preço. */
export function priceAlertEmail(productName: string, price: string, link: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
      <h2 style="color:#7c5cff;">⛏️ GarimpoPC — caiu de preço!</h2>
      <p>Boas notícias! A peça que você está acompanhando atingiu o preço desejado:</p>
      <p style="font-size:18px;"><strong>${productName}</strong></p>
      <p style="font-size:24px; color:#0a7d4b; font-weight:bold;">${price}</p>
      <p>
        <a href="${link}" style="display:inline-block; background:#7c5cff; color:#fff;
           padding:10px 18px; border-radius:8px; text-decoration:none;">
          Ver oferta
        </a>
      </p>
      <p style="color:#888; font-size:12px;">
        Você recebeu este e-mail porque criou um alerta no GarimpoPC.
      </p>
    </div>`;
}
