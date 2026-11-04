import type { NextConfig } from "next";

// Cabeçalhos de segurança básicos (SEG-07): sem iframes de terceiros, sem adivinhação
// de tipo de conteúdo, referrer enxuto e APIs sensíveis do navegador desligadas.
//
// F-22 (endurecimento, não há falha conhecida):
// - HSTS: depois da 1ª visita por HTTPS, o navegador só fala HTTPS com o site (e os
//   subdomínios) por 2 anos. Sem `preload` de propósito: entrar na lista de preload
//   dos navegadores é difícil de desfazer, então só quando o domínio estiver fechado.
//   Em http://localhost o navegador ignora este cabeçalho, então o dev não muda.
// - CSP `object-src 'none'`: nada de <object>/<embed> (plugins), que podem rodar
//   código fora das regras da página. `frame-ancestors 'none'` continua: ninguém
//   põe o site num iframe (clickjacking).
// - Sem `script-src` por enquanto: fazer direito exige nonce gerado a cada requisição
//   (Proxy + renderização dinâmica). Fica para a V3.
const CSP = ["frame-ancestors 'none'", "object-src 'none'"].join("; ");

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: CSP },
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
