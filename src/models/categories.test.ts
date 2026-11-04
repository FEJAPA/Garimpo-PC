import { describe, expect, it } from "vitest";
import { CATEGORIES, categoriesMatching, categoryLabel } from "./categories";

describe("categoriesMatching (CON-07: palavra inteira ou prefixo)", () => {
  it("entende os apelidos em português, com e sem acento", () => {
    expect(categoriesMatching("placa de video")).toEqual(["gpu"]);
    expect(categoriesMatching("Processador")).toEqual(["cpu"]);
    expect(categoriesMatching("memoria")).toEqual(["ram"]);
    expect(categoriesMatching("SSD")).toEqual(["ssd"]);
    expect(categoriesMatching("gabinete")).toEqual(["case"]);
  });

  it("aceita prefixo de quem ainda está digitando", () => {
    expect(categoriesMatching("proc")).toEqual(["cpu"]);
    expect(categoriesMatching("gabin")).toEqual(["case"]);
  });

  it("achar a frase como palavras inteiras dentro da busca continua valendo", () => {
    expect(categoriesMatching("ryzen 5 5600")).toEqual(["cpu"]);
    expect(categoriesMatching("placa de video rtx")).toEqual(["gpu"]);
  });

  it("não casa um apelido que só aparece no meio de outra palavra", () => {
    // "hdmi" contém "hd" (apelido de SSD) e "hd" não é a palavra "hdmi".
    expect(categoriesMatching("hdmi")).toEqual([]);
    // "incorporado" contém "core".
    expect(categoriesMatching("incorporado")).toEqual([]);
  });

  it("termo vazio ou de uma letra só não casa por prefixo com tudo", () => {
    expect(categoriesMatching("")).toEqual([]);
    expect(categoriesMatching("   ")).toEqual([]);
    expect(categoriesMatching("r")).toEqual([]);
  });
});

describe("CATEGORIES", () => {
  it("tem as sete categorias e nenhum emoji (CON-02)", () => {
    expect(CATEGORIES).toHaveLength(7);
    for (const c of CATEGORIES) expect(Object.keys(c).sort()).toEqual(["code", "label"]);
  });

  it("categoryLabel traduz o código e devolve o próprio código se desconhecido", () => {
    expect(categoryLabel("gpu")).toBe("Placa de vídeo");
    expect(categoryLabel("xyz")).toBe("xyz");
  });
});
