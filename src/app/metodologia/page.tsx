// Página /metodologia: mostra docs/METODOLOGIA-DESEMPENHO.md dentro do site, para a
// pessoa entender de onde vêm o Índice GarimpoPC e os FPS estimados. O arquivo é lido
// no servidor (ver `outputFileTracingIncludes` em next.config.ts) e convertido com um
// renderizador mínimo de Markdown (títulos, listas, parágrafos, negrito, itálico, código,
// links). O .md é texto PÚBLICO: nada de caminhos de arquivo ou nomes de campos do código
// nele (os apontamentos para desenvolvedores ficam nos comentários de performance.ts e
// reference-builds.ts).

import type { Metadata } from "next";
import type { ReactNode } from "react";
import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Como estimamos o desempenho",
  description: "Metodologia do Índice GarimpoPC e da estimativa de FPS do Montador de PC.",
};

const ARQUIVO = path.join(process.cwd(), "docs", "METODOLOGIA-DESEMPENHO.md");

/**
 * Negrito, itálico, código e links dentro de uma linha. O itálico (`*assim*`) não pode
 * começar nem terminar com espaço: "2 * 3" continua sendo texto, e `**` é negrito.
 */
function inline(texto: string): ReactNode[] {
  const partes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*(?!\s)[^*]+(?<!\s)\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    const t = m[0];
    if (t.startsWith("**")) partes.push(<strong key={k++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("*")) partes.push(<em key={k++}>{t.slice(1, -1)}</em>);
    else if (t.startsWith("`")) partes.push(<code key={k++} className="rounded bg-surface-2 px-1 py-0.5 text-[0.9em]">{t.slice(1, -1)}</code>);
    else {
      const [, rotulo, url] = /\[([^\]]+)\]\(([^)]+)\)/.exec(t) ?? [];
      const externo = /^https?:/.test(url ?? "");
      partes.push(
        externo ? (
          <a key={k++} href={url} target="_blank" rel="noopener noreferrer" className="text-brand underline">{rotulo}</a>
        ) : (
          <span key={k++} className="text-ink">{rotulo}</span>
        )
      );
    }
    ultimo = m.index + t.length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

type Bloco = { tipo: "h2" | "h3" | "p"; texto: string } | { tipo: "ul" | "ol"; itens: string[] };

/** Agrupa as linhas do Markdown em blocos simples. */
function blocos(md: string): Bloco[] {
  const out: Bloco[] = [];
  let paragrafo: string[] = [];
  const fecha = () => {
    if (paragrafo.length) out.push({ tipo: "p", texto: paragrafo.join(" ") });
    paragrafo = [];
  };
  for (const linha of md.split("\n")) {
    const l = linha.trimEnd();
    if (l.startsWith("# ")) continue; // o título da página já é o h1
    if (l.startsWith("## ")) { fecha(); out.push({ tipo: "h2", texto: l.slice(3) }); continue; }
    if (l.startsWith("### ")) { fecha(); out.push({ tipo: "h3", texto: l.slice(4) }); continue; }
    const li = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(l);
    if (li) {
      fecha();
      const tipo = /^\s*\d+\./.test(l) ? "ol" : "ul";
      const anterior = out[out.length - 1];
      if (anterior && anterior.tipo === tipo) anterior.itens.push(li[1]);
      else out.push({ tipo, itens: [li[1]] });
      continue;
    }
    if (/^\s+\S/.test(linha) && out[out.length - 1] && "itens" in out[out.length - 1]) {
      // continuação de um item de lista (linha indentada)
      const lista = out[out.length - 1] as { itens: string[] };
      lista.itens[lista.itens.length - 1] += " " + l.trim();
      continue;
    }
    if (l === "") { fecha(); continue; }
    paragrafo.push(l);
  }
  fecha();
  return out;
}

export default async function MetodologiaPage() {
  let md = "";
  try {
    md = await fs.readFile(ARQUIVO, "utf8");
  } catch (e) {
    // O caminho vai só para o log (quem cuida do site); a pessoa vê um aviso simples.
    console.error(`Não foi possível ler ${ARQUIVO}:`, (e as Error).message);
    md = "## Explicação indisponível\n\nNão conseguimos carregar a explicação da metodologia agora. Tente de novo mais tarde.";
  }
  const conteudo = blocos(md);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/montar" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Voltar ao Montador
      </Link>
      <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        Como estimamos o desempenho
      </h1>
      <div className="mt-6 flex max-w-[70ch] flex-col gap-4 text-ink-muted">
        {conteudo.map((b, i) => {
          if (b.tipo === "h2") return <h2 key={i} className="mt-6 font-display text-xl font-semibold text-ink">{inline(b.texto)}</h2>;
          if (b.tipo === "h3") return <h3 key={i} className="mt-3 text-base font-semibold text-ink">{inline(b.texto)}</h3>;
          if (b.tipo === "ul") return <ul key={i} className="list-disc space-y-1.5 pl-5">{b.itens.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>;
          if (b.tipo === "ol") return <ol key={i} className="list-decimal space-y-1.5 pl-5">{b.itens.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>;
          if (b.tipo === "p") return <p key={i}>{inline(b.texto)}</p>;
          return null;
        })}
      </div>
    </article>
  );
}
