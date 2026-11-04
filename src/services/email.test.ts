// Testes do serviço de e-mail (V2, pacote G: SEG-02, SEG-03 e CON-01).

import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAlertEmail, escapeHtml, priceAlertEmail, safeHttpUrl, sendEmail } from "./email";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("escapeHtml", () => {
  it("escapa os cinco caracteres especiais", () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe("&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;");
  });
});

describe("safeHttpUrl", () => {
  it("aceita só http e https", () => {
    expect(safeHttpUrl("https://garimpopc.com.br/peca/rtx-4060")).toBe("https://garimpopc.com.br/peca/rtx-4060");
    expect(safeHttpUrl("http://localhost:3000/conta")).toBe("http://localhost:3000/conta");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("não é url")).toBeNull();
  });
});

describe("sendEmail sem RESEND_API_KEY", () => {
  it("devolve ok com simulated: true (a rota não marca como avisado)", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await sendEmail("a@b.com", "assunto", "<p>oi</p>")).toEqual({ ok: true, simulated: true });
    expect(log).toHaveBeenCalled();
  });
});

describe("HTML dos alertas", () => {
  it("escapa o nome da peça e o link", () => {
    const html = priceAlertEmail(`RTX <script>"x"</script>`, "R$ 1.899,90", `https://x.com/?a="b"`);
    expect(html).not.toContain("<script>");
    expect(html).toContain("RTX &lt;script&gt;&quot;x&quot;&lt;/script&gt;");
    expect(html).toContain('href="https://x.com/?a=%22b%22"');
  });

  it("sem link http(s) não põe botão", () => {
    const html = priceAlertEmail("RTX 4060", "R$ 1.899,90", "javascript:alert(1)");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<a ");
  });

  it("usa o ouro do DESIGN.md e não usa emoji nem o roxo antigo (CON-01)", () => {
    const html = priceAlertEmail("RTX 4060", "R$ 1.899,90", "https://x.com");
    expect(html).toContain("#f0b43a");
    expect(html).not.toContain("#7c5cff");
    expect(html).not.toContain("⛏");
  });

  it("e-mail da montagem traz o nome escapado e o total", () => {
    const html = buildAlertEmail(`PC <da> sala`, "R$ 5.999,90", "https://x.com/conta");
    expect(html).toContain("PC &lt;da&gt; sala");
    expect(html).toContain("R$ 5.999,90");
  });
});
