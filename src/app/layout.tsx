import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

// Tipografia (DESIGN.md): Sora para títulos e números-herói, Inter para UI e corpo.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "GarimpoPC — monte e compare seu PC gamer pelo preço certo",
    template: "%s · GarimpoPC",
  },
  description:
    "Monte um PC gamer automaticamente dentro do seu orçamento, com peças compatíveis de lojas confiáveis, e compare preços com histórico real.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${sora.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {/* Primeiro item da tabulação: quem usa teclado ou leitor de tela pula o cabeçalho (WCAG 2.4.1).
            Fica fora da tela até receber o foco; aí vira um botão ouro, com o anel de foco do DESIGN.md. */}
        <a
          href="#conteudo"
          className="fixed left-4 top-4 z-50 -translate-y-24 rounded-control bg-brand px-4 py-2 text-sm font-semibold text-brand-ink shadow-float transition-transform duration-150 focus:translate-y-0"
        >
          Pular para o conteúdo
        </a>
        <SiteHeader />
        {/* tabIndex -1: o foco vai para o conteúdo ao usar o link acima. scroll-mt: o cabeçalho é sticky e não cobre o título. */}
        <main id="conteudo" tabIndex={-1} className="flex-1 scroll-mt-28 focus:outline-none">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
