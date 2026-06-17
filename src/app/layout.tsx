import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GarimpoPC — Preços de hardware gamer no Brasil",
  description:
    "Acompanhe e compare preços de peças de PC gamer no Brasil, com histórico de preços e lojas confiáveis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col text-ink">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line py-6 text-center text-xs text-ink-faint">
          GarimpoPC · projeto em desenvolvimento
        </footer>
      </body>
    </html>
  );
}
