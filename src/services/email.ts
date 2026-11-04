// Envio de e-mails via Resend. Usado para os alertas de queda de preço.
// A chave fica em RESEND_API_KEY (.env.local). Sem a chave, o envio é apenas
// simulado no console (útil para testar sem configurar o Resend ainda).
//
// V2 (pacote G):
// - SEG-02: o envio simulado devolve `simulated: true`, para a rota de alertas NÃO
//   marcar o alerta como avisado (senão ele nunca mais seria verificado).
// - SEG-03: tudo o que entra no HTML é escapado, e o link só vale se for http(s).
// - CON-01: cores do DESIGN.md (ouro), sem emoji.

import { Resend } from "resend";

export type SendEmailResult =
  | { ok: true; simulated: boolean }
  | { ok: false; simulated: false; error: string };

/** Remetente: o configurado em EMAIL_FROM ou o de testes do Resend. */
function remetente(): string {
  return process.env.EMAIL_FROM ?? "GarimpoPC <onboarding@resend.dev>";
}

/**
 * Envia um e-mail. A chave é lida a cada chamada (e não no carregamento do
 * módulo) para que trocar o ambiente não exija reiniciar e para os testes.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email simulado] para=${to} assunto="${subject}"`);
    return { ok: true, simulated: true };
  }
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({ from: remetente(), to, subject, html });
    if (error) {
      console.error("Erro ao enviar e-mail:", error);
      return { ok: false, simulated: false, error: error.message ?? "erro do Resend" };
    }
    return { ok: true, simulated: false };
  } catch (e) {
    console.error("Falha no envio de e-mail:", e);
    return { ok: false, simulated: false, error: e instanceof Error ? e.message : "falha no envio" };
  }
}

/** Escapa & < > " ' para o texto não virar HTML (nomes vêm do catálogo e de lojas). */
export function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Devolve a URL se ela for http(s); qualquer outro esquema (javascript:, data:...) vira null. */
export function safeHttpUrl(link: string): string | null {
  try {
    const url = new URL(link);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// Tokens do DESIGN.md (e-mail não lê o CSS do site, então os valores vão inline).
const COR = {
  fundo: "#15171c", // surface
  borda: "#2b2f3a", // line
  texto: "#f2efe6", // ink
  textoSecundario: "#aeb0b8", // ink-muted
  legenda: "#8b8e99", // ink-faint
  ouro: "#f0b43a", // brand
  sobreOuro: "#1c1505", // brand-ink
};

/** Esqueleto comum dos e-mails de alerta. Todos os textos recebidos são escapados aqui. */
function alertaHtml(opts: { titulo: string; intro: string; nome: string; preco: string; link: string; botao: string }): string {
  const href = safeHttpUrl(opts.link);
  const botao = href
    ? `<p style="margin:24px 0 0;">
        <a href="${escapeHtml(href)}" style="display:inline-block; background:${COR.ouro}; color:${COR.sobreOuro};
           padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:600;">
          ${escapeHtml(opts.botao)}
        </a>
      </p>`
    : "";
  return `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: auto; background:${COR.fundo};
         color:${COR.texto}; border:1px solid ${COR.borda}; border-radius:10px; padding:24px;">
      <h2 style="margin:0 0 12px; font-size:22px; color:${COR.texto};">${escapeHtml(opts.titulo)}</h2>
      <p style="margin:0; color:${COR.textoSecundario};">${escapeHtml(opts.intro)}</p>
      <p style="margin:16px 0 0; font-size:18px;"><strong>${escapeHtml(opts.nome)}</strong></p>
      <p style="margin:4px 0 0; font-size:28px; color:${COR.ouro}; font-weight:700;">${escapeHtml(opts.preco)}</p>
      ${botao}
      <p style="margin:24px 0 0; color:${COR.legenda}; font-size:12px;">
        Você recebeu este e-mail porque criou um alerta no GarimpoPC. Confira o preço na loja antes de pagar.
      </p>
    </div>`;
}

/** HTML do e-mail de alerta de queda de preço de uma peça. */
export function priceAlertEmail(productName: string, price: string, link: string): string {
  return alertaHtml({
    titulo: "GarimpoPC: caiu de preço",
    intro: "A peça que você está acompanhando chegou ao preço que você pediu:",
    nome: productName,
    preco: price,
    link,
    botao: "Ver oferta",
  });
}

/** HTML do e-mail "sua montagem caiu para R$ X" (alerta da montagem inteira). */
export function buildAlertEmail(buildName: string, total: string, link: string): string {
  return alertaHtml({
    titulo: "GarimpoPC: sua montagem caiu de preço",
    intro: "Somando o melhor preço de hoje de cada peça, a sua montagem salva chegou ao valor que você pediu:",
    nome: buildName,
    preco: `${total} no Pix`,
    link,
    botao: "Ver minhas montagens",
  });
}
