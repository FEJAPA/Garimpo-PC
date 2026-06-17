-- Dados iniciais do GarimpoPC: lojas confiáveis, algumas placas de vídeo reais,
-- suas ofertas e um histórico de preços de exemplo para o gráfico.
-- Pode rodar várias vezes sem duplicar (usa "on conflict do nothing" / limpeza).

-- Limpa dados antigos para reinserir do zero (mantém a estrutura das tabelas).
truncate table public.price_history, public.offers, public.products, public.stores
  restart identity cascade;

-- 1) Lojas confiáveis (especializadas em hardware).
insert into public.stores (id, name, rating, rating_count, is_official, url) values
  ('kabum',    'KaBuM!',         4.8, 125000, true, 'https://www.kabum.com.br'),
  ('pichau',   'Pichau',         4.6,  48000, true, 'https://www.pichau.com.br'),
  ('terabyte', 'Terabyte Shop',  4.7,  61000, true, 'https://www.terabyteshop.com.br');

-- 2) Peças (placas de vídeo) + 3) ofertas + 4) histórico, em um bloco só,
-- usando variáveis para ligar os ids automaticamente.
do $$
declare
  p_4060   uuid;
  p_7600   uuid;
  p_4070s  uuid;
  o_id     uuid;
  d        date;
  inicial  numeric;
  atual    numeric;
  i        int;
begin
  -- ----- RTX 4060 -----
  insert into public.products (slug, name, category, brand, description)
  values ('rtx-4060', 'NVIDIA GeForce RTX 4060 8GB', 'gpu', 'NVIDIA',
    'Placa de vídeo de entrada da geração RTX 40. Ótima para jogar em Full HD (1080p) com bom desempenho e recursos modernos como DLSS.')
  returning id into p_4060;

  -- ----- RX 7600 -----
  insert into public.products (slug, name, category, brand, description)
  values ('rx-7600', 'AMD Radeon RX 7600 8GB', 'gpu', 'AMD',
    'Concorrente direta da RTX 4060, também voltada para jogos em Full HD (1080p). Costuma ter bom custo-benefício.')
  returning id into p_7600;

  -- ----- RTX 4070 SUPER -----
  insert into public.products (slug, name, category, brand, description)
  values ('rtx-4070-super', 'NVIDIA GeForce RTX 4070 SUPER 12GB', 'gpu', 'NVIDIA',
    'Placa de vídeo intermediária forte, ideal para jogar em 1440p (Quad HD) com altas taxas de quadros. Bom equilíbrio entre preço e desempenho.')
  returning id into p_4070s;

  -- Ofertas (uma a uma para capturar o id e gerar o histórico de cada uma).
  -- Para cada oferta geramos 8 pontos de histórico (de 01/03 a 15/06, a cada 15
  -- dias), partindo de um preço ~18% mais alto até o preço atual.

  -- RTX 4060 @ KaBuM!
  insert into public.offers (product_id, store_id, url, price_pix, price_installment, installment_count, in_stock)
  values (p_4060, 'kabum', 'https://www.kabum.com.br', 1899.90, 2099.90, 10, true) returning id into o_id;
  atual := 1899.90; inicial := round(atual * 1.18, 2);
  for i in 0..7 loop
    d := date '2026-03-01' + (i * 15);
    insert into public.price_history (offer_id, recorded_at, price_pix)
    values (o_id, d::timestamptz + time '12:00',
            round((inicial - (inicial - atual) * (i::numeric/7)) * (case when i % 2 = 0 then 1 else 0.985 end), 2));
  end loop;

  -- RTX 4060 @ Pichau
  insert into public.offers (product_id, store_id, url, price_pix, price_installment, installment_count, in_stock)
  values (p_4060, 'pichau', 'https://www.pichau.com.br', 1929.90, 2149.90, 12, true) returning id into o_id;
  atual := 1929.90; inicial := round(atual * 1.18, 2);
  for i in 0..7 loop
    d := date '2026-03-01' + (i * 15);
    insert into public.price_history (offer_id, recorded_at, price_pix)
    values (o_id, d::timestamptz + time '12:00',
            round((inicial - (inicial - atual) * (i::numeric/7)) * (case when i % 2 = 0 then 1 else 0.985 end), 2));
  end loop;

  -- RX 7600 @ Terabyte
  insert into public.offers (product_id, store_id, url, price_pix, price_installment, installment_count, in_stock)
  values (p_7600, 'terabyte', 'https://www.terabyteshop.com.br', 1749.90, 1949.90, 10, true) returning id into o_id;
  atual := 1749.90; inicial := round(atual * 1.18, 2);
  for i in 0..7 loop
    d := date '2026-03-01' + (i * 15);
    insert into public.price_history (offer_id, recorded_at, price_pix)
    values (o_id, d::timestamptz + time '12:00',
            round((inicial - (inicial - atual) * (i::numeric/7)) * (case when i % 2 = 0 then 1 else 0.985 end), 2));
  end loop;

  -- RX 7600 @ KaBuM!
  insert into public.offers (product_id, store_id, url, price_pix, price_installment, installment_count, in_stock)
  values (p_7600, 'kabum', 'https://www.kabum.com.br', 1799.90, 1999.90, 10, true) returning id into o_id;
  atual := 1799.90; inicial := round(atual * 1.18, 2);
  for i in 0..7 loop
    d := date '2026-03-01' + (i * 15);
    insert into public.price_history (offer_id, recorded_at, price_pix)
    values (o_id, d::timestamptz + time '12:00',
            round((inicial - (inicial - atual) * (i::numeric/7)) * (case when i % 2 = 0 then 1 else 0.985 end), 2));
  end loop;

  -- RTX 4070 SUPER @ Pichau
  insert into public.offers (product_id, store_id, url, price_pix, price_installment, installment_count, in_stock)
  values (p_4070s, 'pichau', 'https://www.pichau.com.br', 4299.90, 4799.90, 12, true) returning id into o_id;
  atual := 4299.90; inicial := round(atual * 1.18, 2);
  for i in 0..7 loop
    d := date '2026-03-01' + (i * 15);
    insert into public.price_history (offer_id, recorded_at, price_pix)
    values (o_id, d::timestamptz + time '12:00',
            round((inicial - (inicial - atual) * (i::numeric/7)) * (case when i % 2 = 0 then 1 else 0.985 end), 2));
  end loop;

  -- RTX 4070 SUPER @ Terabyte
  insert into public.offers (product_id, store_id, url, price_pix, price_installment, installment_count, in_stock)
  values (p_4070s, 'terabyte', 'https://www.terabyteshop.com.br', 4399.90, 4899.90, 10, true) returning id into o_id;
  atual := 4399.90; inicial := round(atual * 1.18, 2);
  for i in 0..7 loop
    d := date '2026-03-01' + (i * 15);
    insert into public.price_history (offer_id, recorded_at, price_pix)
    values (o_id, d::timestamptz + time '12:00',
            round((inicial - (inicial - atual) * (i::numeric/7)) * (case when i % 2 = 0 then 1 else 0.985 end), 2));
  end loop;
end $$;
