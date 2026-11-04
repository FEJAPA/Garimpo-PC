// Testes do login com `next` (V2, pacote G): depois de entrar, a pessoa volta
// para a página de origem, mas só se for um caminho interno (sem redirecionamento aberto).
// S-15 / F-10: a URL de /entrar só leva CÓDIGOS (erro=credenciais,
// mensagem=conta-criada); a página traduz. Texto livre na URL viraria phishing.

import { afterEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({ erro: null as { message: string; code?: string } | null }));

// redirect() do Next interrompe a action lançando um erro; aqui guardamos o destino.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/models/supabase-server", () => ({
  getServerSupabase: async () => ({
    auth: {
      signInWithPassword: async () => ({ error: estado.erro }),
      signUp: async () => ({ error: estado.erro }),
    },
  }),
}));

import { login, signup } from "./actions";

async function destinoDe(acao: (fd: FormData) => Promise<void>, next?: string): Promise<string> {
  const fd = new FormData();
  fd.set("email", "a@b.com");
  fd.set("password", "123456");
  if (next !== undefined) fd.set("next", next);
  try {
    await acao(fd);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("REDIRECT:")) return msg.slice("REDIRECT:".length);
    throw e;
  }
  throw new Error("a action não redirecionou");
}

const destinoDoLogin = (next?: string) => destinoDe(login, next);
const destinoDoCadastro = (next?: string) => destinoDe(signup, next);

/** Parâmetros da URL de volta para /entrar. */
function params(destino: string): URLSearchParams {
  expect(destino.startsWith("/entrar?")).toBe(true);
  return new URL(destino, "http://x").searchParams;
}

afterEach(() => {
  estado.erro = null;
});

describe("login com next", () => {
  it("volta para o caminho interno pedido", async () => {
    expect(await destinoDoLogin("/montar?b=abc")).toBe("/montar?b=abc");
    expect(await destinoDoLogin("/peca/rtx-4060")).toBe("/peca/rtx-4060");
  });

  it("sem next, ou com next inseguro, vai para /conta", async () => {
    expect(await destinoDoLogin()).toBe("/conta");
    expect(await destinoDoLogin("https://golpe.com")).toBe("/conta");
    expect(await destinoDoLogin("//golpe.com")).toBe("/conta");
    expect(await destinoDoLogin("/\\golpe.com")).toBe("/conta");
    expect(await destinoDoLogin("/entrar")).toBe("/conta");
    expect(await destinoDoLogin("montar")).toBe("/conta");
  });

  it("com erro de senha, volta para /entrar mantendo o next", async () => {
    estado.erro = { message: "Invalid login credentials" };
    const destino = await destinoDoLogin("/montar");
    expect(destino).toContain("/entrar?erro=");
    expect(destino).toContain("&next=%2Fmontar");
  });
});

describe("/entrar só recebe códigos na URL (S-15)", () => {
  const CODIGOS = ["credenciais", "ja-cadastrado", "senha-curta", "email-invalido", "email-nao-confirmado", "generico"];

  it("login com senha errada → erro=credenciais, mantendo o next", async () => {
    estado.erro = { message: "Invalid login credentials" };
    const destino = await destinoDoLogin("/montar?b=abc");
    expect(params(destino).get("erro")).toBe("credenciais");
    expect(params(destino).get("next")).toBe("/montar?b=abc");
  });

  it("e-mail ainda não confirmado → erro=email-nao-confirmado", async () => {
    estado.erro = { message: "Email not confirmed" };
    expect(params(await destinoDoLogin()).get("erro")).toBe("email-nao-confirmado");
  });

  it("cadastro: e-mail já usado, senha curta e e-mail inválido viram códigos", async () => {
    estado.erro = { message: "User already registered" };
    expect(params(await destinoDoCadastro()).get("erro")).toBe("ja-cadastrado");
    estado.erro = { message: "Password should be at least 6 characters." };
    expect(params(await destinoDoCadastro()).get("erro")).toBe("senha-curta");
    estado.erro = { message: "Unable to validate email address: invalid format" };
    expect(params(await destinoDoCadastro()).get("erro")).toBe("email-invalido");
  });

  it("entende o código do Supabase mesmo se a mensagem mudar", async () => {
    estado.erro = { message: "qualquer coisa", code: "invalid_credentials" };
    expect(params(await destinoDoLogin()).get("erro")).toBe("credenciais");
    estado.erro = { message: "qualquer coisa", code: "email_not_confirmed" };
    expect(params(await destinoDoLogin()).get("erro")).toBe("email-nao-confirmado");
    estado.erro = { message: "qualquer coisa", code: "user_already_exists" };
    expect(params(await destinoDoCadastro()).get("erro")).toBe("ja-cadastrado");
  });

  it("erro desconhecido → generico, e a mensagem do Supabase nunca vai para a URL", async () => {
    estado.erro = { message: "Sua conta foi bloqueada, ligue para 0800 000 0000" };
    const destino = await destinoDoLogin("/conta");
    expect(params(destino).get("erro")).toBe("generico");
    expect(destino).not.toContain("0800");
    expect(destino).not.toContain("bloqueada");
  });

  it("todo erro devolvido é um dos códigos conhecidos", async () => {
    for (const message of ["Invalid login credentials", "Email not confirmed", "x", ""]) {
      estado.erro = { message };
      expect(CODIGOS).toContain(params(await destinoDoLogin()).get("erro"));
      expect(CODIGOS).toContain(params(await destinoDoCadastro()).get("erro"));
    }
  });

  it("cadastro com sucesso → mensagem=conta-criada, mantendo o next", async () => {
    const destino = await destinoDoCadastro("/montar");
    expect(params(destino).get("mensagem")).toBe("conta-criada");
    expect(params(destino).get("next")).toBe("/montar");
    expect(params(await destinoDoCadastro()).get("next")).toBeNull();
  });
});
