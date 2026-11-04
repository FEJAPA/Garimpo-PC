import type { NextConfig } from "next";

// Cabeçalhos de segurança básicos (SEG-07): sem iframes de terceiros, sem adivinhação
// de tipo de conteúdo, referrer enxuto e APIs sensíveis do navegador desligadas.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Diz ao Next.js que a raiz do projeto é esta pasta (evita confusão com
  // outro package-lock.json que existe na pasta pessoal do usuário).
  turbopack: {
    root: __dirname,
  },
  // A página /metodologia lê este arquivo no servidor; garante que ele vai junto no deploy.
  outputFileTracingIncludes: {
    "/metodologia": ["./docs/METODOLOGIA-DESEMPENHO.md"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
