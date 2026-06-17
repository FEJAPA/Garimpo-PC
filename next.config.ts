import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Diz ao Next.js que a raiz do projeto é esta pasta (evita confusão com
  // outro package-lock.json que existe na pasta pessoal do usuário).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
