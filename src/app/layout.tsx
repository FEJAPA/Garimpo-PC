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
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
