// Dados de EXEMPLO usados enquanto o banco de dados (Supabase) ainda não está
// configurado. São placas de vídeo reais com preços ilustrativos, para você ver
// o site funcionando de imediato. Quando o Supabase estiver pronto, o app passa
// a usar os dados reais do banco automaticamente.

import type { ProductWithOffers, Store } from "./types";

const lojas: Record<string, Store> = {
  kabum: {
    id: "kabum",
    name: "KaBuM!",
    rating: 4.8,
    rating_count: 125000,
    is_official: true,
    url: "https://www.kabum.com.br",
  },
  pichau: {
    id: "pichau",
    name: "Pichau",
    rating: 4.6,
    rating_count: 48000,
    is_official: true,
    url: "https://www.pichau.com.br",
  },
  terabyte: {
    id: "terabyte",
    name: "Terabyte Shop",
    rating: 4.7,
    rating_count: 61000,
    is_official: true,
    url: "https://www.terabyteshop.com.br",
  },
  // Marketplace genérico (fictício) com nota baixa: NÃO é "loja confiável".
  // Serve para o Montador mostrar a diferença do filtro de lojas.
  promocenter: {
    id: "promocenter",
    name: "Promo Center (marketplace)",
    rating: 3.8,
    rating_count: 2300,
    is_official: false,
    url: null,
  },
};

// Gera alguns pontos de histórico decrescentes a partir de um preço atual,
// só para o gráfico ter o que mostrar nos dados de exemplo.
function historicoExemplo(precoAtual: number): { recorded_at: string; price_pix: number }[] {
  const pontos: { recorded_at: string; price_pix: number }[] = [];
  // Datas fixas (não usamos "hoje" para manter os exemplos estáveis).
  const datas = [
    "2026-03-01",
    "2026-03-15",
    "2026-04-01",
    "2026-04-15",
    "2026-05-01",
    "2026-05-15",
    "2026-06-01",
    "2026-06-15",
  ];
  const inicial = Math.round(precoAtual * 1.18);
  datas.forEach((data, i) => {
    const fracao = i / (datas.length - 1);
    // Vai do preço inicial (mais alto) até o atual, com leves oscilações.
    const oscilacao = i % 2 === 0 ? 1 : 0.985;
    const preco = Math.round((inicial - (inicial - precoAtual) * fracao) * oscilacao);
    pontos.push({ recorded_at: `${data}T12:00:00Z`, price_pix: preco });
  });
  return pontos;
}

export const MOCK_PRODUCTS: ProductWithOffers[] = [
  {
    id: "p-rtx-4060",
    slug: "rtx-4060",
    name: "NVIDIA GeForce RTX 4060 8GB",
    category: "gpu",
    brand: "NVIDIA",
    description:
      "Placa de vídeo de entrada da geração RTX 40. Ótima para jogar em Full HD (1080p) com bom desempenho e recursos modernos como DLSS.",
    image_url: null,
    offers: [
      {
        id: "o-4060-kabum",
        product_id: "p-rtx-4060",
        store_id: "kabum",
        url: "https://www.kabum.com.br",
        price_pix: 1899.9,
        price_installment: 2099.9,
        installment_count: 10,
        in_stock: true,
        store: lojas.kabum,
      },
      {
        id: "o-4060-pichau",
        product_id: "p-rtx-4060",
        store_id: "pichau",
        url: "https://www.pichau.com.br",
        price_pix: 1929.9,
        price_installment: 2149.9,
        installment_count: 12,
        in_stock: true,
        store: lojas.pichau,
      },
      {
        id: "o-4060-promocenter",
        product_id: "p-rtx-4060",
        store_id: "promocenter",
        url: null,
        price_pix: 1649.9,
        price_installment: 1899.9,
        installment_count: 12,
        in_stock: true,
        store: lojas.promocenter,
      },
    ],
  },
  {
    id: "p-rx-7600",
    slug: "rx-7600",
    name: "AMD Radeon RX 7600 8GB",
    category: "gpu",
    brand: "AMD",
    description:
      "Concorrente direta da RTX 4060, também voltada para jogos em Full HD (1080p). Costuma ter bom custo-benefício.",
    image_url: null,
    offers: [
      {
        id: "o-7600-terabyte",
        product_id: "p-rx-7600",
        store_id: "terabyte",
        url: "https://www.terabyteshop.com.br",
        price_pix: 1749.9,
        price_installment: 1949.9,
        installment_count: 10,
        in_stock: true,
        store: lojas.terabyte,
      },
      {
        id: "o-7600-kabum",
        product_id: "p-rx-7600",
        store_id: "kabum",
        url: "https://www.kabum.com.br",
        price_pix: 1799.9,
        price_installment: 1999.9,
        installment_count: 10,
        in_stock: true,
        store: lojas.kabum,
      },
    ],
  },
  {
    id: "p-rtx-4070-super",
    slug: "rtx-4070-super",
    name: "NVIDIA GeForce RTX 4070 SUPER 12GB",
    category: "gpu",
    brand: "NVIDIA",
    description:
      "Placa de vídeo intermediária forte, ideal para jogar em 1440p (Quad HD) com altas taxas de quadros. Bom equilíbrio entre preço e desempenho.",
    image_url: null,
    offers: [
      {
        id: "o-4070s-pichau",
        product_id: "p-rtx-4070-super",
        store_id: "pichau",
        url: "https://www.pichau.com.br",
        price_pix: 4299.9,
        price_installment: 4799.9,
        installment_count: 12,
        in_stock: true,
        store: lojas.pichau,
      },
      {
        id: "o-4070s-terabyte",
        product_id: "p-rtx-4070-super",
        store_id: "terabyte",
        url: "https://www.terabyteshop.com.br",
        price_pix: 4399.9,
        price_installment: 4899.9,
        installment_count: 10,
        in_stock: true,
        store: lojas.terabyte,
      },
      {
        id: "o-4070s-promocenter",
        product_id: "p-rtx-4070-super",
        store_id: "promocenter",
        url: null,
        price_pix: 3899.9,
        price_installment: 4299.9,
        installment_count: 12,
        in_stock: true,
        store: lojas.promocenter,
      },
    ],
  },
  ...peçasExtras(),
];

// Cria peças de exemplo de outras categorias (CPU, RAM, SSD, etc.) de forma
// compacta, cada uma com 2 ofertas em lojas confiáveis.
function peçasExtras(): ProductWithOffers[] {
  const base: {
    slug: string;
    name: string;
    category: ProductWithOffers["category"];
    brand: string;
    description: string;
    preco: number;
    lojas: [keyof typeof lojas, keyof typeof lojas];
  }[] = [
    {
      slug: "ryzen-5-7600",
      name: "AMD Ryzen 5 7600",
      category: "cpu",
      brand: "AMD",
      description:
        "Processador de 6 núcleos da plataforma AM5. Ótimo custo-benefício para jogos em Full HD.",
      preco: 1299.9,
      lojas: ["kabum", "pichau"],
    },
    {
      slug: "core-i5-14400f",
      name: "Intel Core i5-14400F",
      category: "cpu",
      brand: "Intel",
      description:
        "Processador de 10 núcleos, popular em PCs gamer de entrada/médio. Precisa de placa de vídeo (sem gráficos integrados).",
      preco: 1149.9,
      lojas: ["terabyte", "kabum"],
    },
    {
      slug: "corsair-vengeance-16gb-ddr5",
      name: "Memória Corsair Vengeance 16GB DDR5 5600MHz",
      category: "ram",
      brand: "Corsair",
      description: "Kit de memória RAM DDR5 rápido, ideal para PCs novos com placas AM5/Intel recentes.",
      preco: 349.9,
      lojas: ["kabum", "terabyte"],
    },
    {
      slug: "kingston-nv2-1tb",
      name: "SSD Kingston NV2 1TB NVMe",
      category: "ssd",
      brand: "Kingston",
      description: "SSD NVMe de 1TB, rápido e barato. Espaço para sistema, programas e vários jogos.",
      preco: 419.9,
      lojas: ["pichau", "kabum"],
    },
    {
      slug: "b650m-asus",
      name: "Placa-mãe ASUS TUF B650M-Plus",
      category: "motherboard",
      brand: "ASUS",
      description: "Placa-mãe AM5 (para Ryzen série 7000+), boa para montagens de médio porte.",
      preco: 1199.9,
      lojas: ["kabum", "pichau"],
    },
    {
      slug: "corsair-cv650",
      name: "Fonte Corsair CV650 650W 80 Plus Bronze",
      category: "psu",
      brand: "Corsair",
      description: "Fonte de 650W com certificação 80 Plus Bronze. Boa opção confiável para PCs de médio porte.",
      preco: 329.9,
      lojas: ["terabyte", "kabum"],
    },
    {
      slug: "gabinete-gamemax-h605",
      name: "Gabinete Gamemax H605 com 3 fans ARGB",
      category: "case",
      brand: "Gamemax",
      description: "Gabinete médio com lateral de vidro e ventiladores ARGB inclusos. Bom visual por preço acessível.",
      preco: 279.9,
      lojas: ["kabum", "pichau"],
    },
    // --- Alternativas para o Montador de PC (preços ilustrativos) ---
    {
      slug: "rx-6600",
      name: "AMD Radeon RX 6600 8GB",
      category: "gpu",
      brand: "AMD",
      description:
        "Placa de vídeo de entrada: roda a maioria dos jogos em Full HD no médio/alto. Boa porta de entrada para orçamentos apertados.",
      preco: 1399.9,
      lojas: ["terabyte", "kabum"],
    },
    {
      slug: "rtx-4060-ti",
      name: "NVIDIA GeForce RTX 4060 Ti 8GB",
      category: "gpu",
      brand: "NVIDIA",
      description: "Um degrau acima da RTX 4060: Full HD no ultra e 1440p com DLSS.",
      preco: 2699.9,
      lojas: ["kabum", "terabyte"],
    },
    {
      slug: "rx-7700-xt",
      name: "AMD Radeon RX 7700 XT 12GB",
      category: "gpu",
      brand: "AMD",
      description: "Intermediária forte para 1440p, com 12 GB de memória. Ótimo desempenho por real.",
      preco: 2999.9,
      lojas: ["pichau", "kabum"],
    },
    {
      slug: "b760m-gigabyte",
      name: "Placa-mãe Gigabyte B760M DS3H DDR5",
      category: "motherboard",
      brand: "Gigabyte",
      description: "Placa-mãe LGA1700 (Intel 12ª a 14ª geração) com DDR5, formato mATX.",
      preco: 999.9,
      lojas: ["kabum", "terabyte"],
    },
    {
      slug: "a620m-asrock",
      name: "Placa-mãe ASRock A620M-HDV/M.2",
      category: "motherboard",
      brand: "ASRock",
      description: "Placa-mãe AM5 básica e barata: serve bem para Ryzen 5 sem overclock.",
      preco: 699.9,
      lojas: ["pichau", "kabum"],
    },
    {
      slug: "xpg-lancer-rgb-32gb-ddr5",
      name: "Memória XPG Lancer RGB 32GB (2x16GB) DDR5 6000MHz",
      category: "ram",
      brand: "XPG",
      description: "Kit de 32 GB com iluminação RGB: folga para jogos pesados e visual no gabinete.",
      preco: 699.9,
      lojas: ["kabum", "pichau"],
    },
    {
      slug: "wd-black-sn770-2tb",
      name: "SSD WD Black SN770 2TB NVMe Gen4",
      category: "ssd",
      brand: "Western Digital",
      description: "SSD rápido (PCIe 4.0) com 2 TB: cabe uma biblioteca grande de jogos.",
      preco: 899.9,
      lojas: ["terabyte", "pichau"],
    },
    {
      slug: "msi-mag-a750gl",
      name: "Fonte MSI MAG A750GL 750W 80 Plus Gold modular",
      category: "psu",
      brand: "MSI",
      description: "Fonte de 750 W Gold e modular (menos cabos sobrando). Folga para placas fortes.",
      preco: 599.9,
      lojas: ["kabum", "terabyte"],
    },
    {
      slug: "montech-sky-two",
      name: "Gabinete Montech Sky Two branco, vidro panorâmico, 4 fans ARGB",
      category: "case",
      brand: "Montech",
      description: "Gabinete branco com dois painéis de vidro e 4 ventoinhas ARGB: o PC vira vitrine.",
      preco: 749.9,
      lojas: ["pichau", "kabum"],
    },
    {
      slug: "rise-mode-galaxy",
      name: "Gabinete Rise Mode Galaxy preto com 1 fan",
      category: "case",
      brand: "Rise Mode",
      description:
        "Gabinete simples e barato, sem iluminação. Cumpre o papel quando o dinheiro vai para a placa de vídeo.",
      preco: 199.9,
      lojas: ["kabum", "terabyte"],
    },
  ];

  return base.map((b) => {
    const [l1, l2] = b.lojas;
    const id = `p-${b.slug}`;
    return {
      id,
      slug: b.slug,
      name: b.name,
      category: b.category,
      brand: b.brand,
      description: b.description,
      image_url: null,
      offers: [
        {
          id: `o-${b.slug}-${l1}`,
          product_id: id,
          store_id: l1,
          url: lojas[l1].url,
          price_pix: b.preco,
          price_installment: Math.round(b.preco * 1.12 * 100) / 100,
          installment_count: 10,
          in_stock: true,
          store: lojas[l1],
        },
        {
          id: `o-${b.slug}-${l2}`,
          product_id: id,
          store_id: l2,
          url: lojas[l2].url,
          price_pix: Math.round(b.preco * 1.04 * 100) / 100,
          price_installment: Math.round(b.preco * 1.16 * 100) / 100,
          installment_count: 12,
          in_stock: true,
          store: lojas[l2],
        },
      ],
    };
  });
}

/** Histórico de exemplo (por id de oferta) para a tela de detalhe. */
export const MOCK_HISTORY: Record<string, { recorded_at: string; price_pix: number }[]> =
  (() => {
    const h: Record<string, { recorded_at: string; price_pix: number }[]> = {
      "o-4060-kabum": historicoExemplo(1899.9),
      "o-4060-pichau": historicoExemplo(1929.9),
      "o-7600-terabyte": historicoExemplo(1749.9),
      "o-7600-kabum": historicoExemplo(1799.9),
      "o-4070s-pichau": historicoExemplo(4299.9),
      "o-4070s-terabyte": historicoExemplo(4399.9),
    };
    // Gera histórico também para as peças extras, a partir do preço de cada oferta.
    for (const p of peçasExtras()) {
      for (const o of p.offers) h[o.id] = historicoExemplo(o.price_pix);
    }
    return h;
  })();
