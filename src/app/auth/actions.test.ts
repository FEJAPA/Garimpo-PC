// Testes do login com `next` (V2, pacote G): depois de entrar, a pessoa volta
// para a página de origem, mas só se for um caminho interno (sem redirecionamento aberto).

import { afterEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({ erro: null as { message: string } | null }));

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

import { login } from "./actions";

async function destinoDoLogin(next?: string): Promise<string> {
  const fd = new FormData();
  fd.set("email", "a@b.com");
  fd.set("password", "123456");
  if (next !== undefined) fd.set("next", next);
  try {
    await login(fd);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("REDIRECT:")) return msg.slice("REDIRECT:".length);
    throw e;
  }
  throw new Error("login não redirecionou");
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
