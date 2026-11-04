-- Peças extras de várias categorias (CPU, RAM, SSD, placa-mãe, fonte, gabinete),
-- para a busca "funcionar pra tudo" já no banco real.
-- Rode no SQL Editor DEPOIS do seed.sql principal. Pode rodar de novo sem
-- duplicar (apaga estas peças pelo slug antes de reinserir).

do $$
declare
  pid uuid; oid uuid; i int; inicial numeric; atual numeric;
  -- lista: slug, nome, categoria, marca, descrição, preço, loja1, loja2
  rec record;
begin
  -- Remove versões anteriores destas peças (cascade limpa ofertas/histórico).
  delete from public.products where slug in (
    'ryzen-5-7600','core-i5-14400f','corsair-vengeance-16gb-ddr5','kingston-nv2-1tb',
    'b650m-asus','corsair-cv650','gabinete-gamemax-h605',
    'rx-6600','rtx-4060-ti','rx-7700-xt','b760m-gigabyte','a620m-asrock',
    'xpg-lancer-rgb-32gb-ddr5','wd-black-sn770-2tb','msi-mag-a750gl','montech-sky-two','rise-mode-galaxy'
  );

  for rec in
    select * from (values
      ('ryzen-5-7600','AMD Ryzen 5 7600','cpu','AMD','Processador de 6 núcleos da plataforma AM5. Ótimo custo-benefício para jogos em Full HD.',1299.90,'kabum','pichau'),
      ('core-i5-14400f','Intel Core i5-14400F','cpu','Intel','Processador de 10 núcleos, popular em PCs gamer de entrada/médio. Precisa de placa de vídeo.',1149.90,'terabyte','kabum'),
      ('corsair-vengeance-16gb-ddr5','Memória Corsair Vengeance 16GB DDR5 5600MHz','ram','Corsair','Kit de memória RAM DDR5 rápido, ideal para PCs novos AM5/Intel recentes.',349.90,'kabum','terabyte'),
      ('kingston-nv2-1tb','SSD Kingston NV2 1TB NVMe','ssd','Kingston','SSD NVMe de 1TB, rápido e barato. Espaço para sistema, programas e vários jogos.',419.90,'pichau','kabum'),
      ('b650m-asus','Placa-mãe ASUS TUF B650M-Plus','motherboard','ASUS','Placa-mãe AM5 (para Ryzen série 7000+), boa para montagens de médio porte.',1199.90,'kabum','pichau'),
      ('corsair-cv650','Fonte Corsair CV650 650W 80 Plus Bronze','psu','Corsair','Fonte de 650W com certificação 80 Plus Bronze. Opção confiável para PCs de médio porte.',329.90,'terabyte','kabum'),
      ('gabinete-gamemax-h605','Gabinete Gamemax H605 com 3 fans ARGB','case','Gamemax','Gabinete médio com lateral de vidro e ventiladores ARGB inclusos. Bom visual por preço acessível.',279.90,'kabum','pichau'),
      -- Alternativas para o Montador de PC (preços ilustrativos)
      ('rx-6600','AMD Radeon RX 6600 8GB','gpu','AMD','Placa de vídeo de entrada: roda a maioria dos jogos em Full HD no médio/alto. Boa porta de entrada para orçamentos apertados.',1399.90,'terabyte','kabum'),
      ('rtx-4060-ti','NVIDIA GeForce RTX 4060 Ti 8GB','gpu','NVIDIA','Um degrau acima da RTX 4060: Full HD no ultra e 1440p com DLSS.',2699.90,'kabum','terabyte'),
      ('rx-7700-xt','AMD Radeon RX 7700 XT 12GB','gpu','AMD','Intermediária forte para 1440p, com 12 GB de memória. Ótimo desempenho por real.',2999.90,'pichau','kabum'),
      ('b760m-gigabyte','Placa-mãe Gigabyte B760M DS3H DDR5','motherboard','Gigabyte','Placa-mãe LGA1700 (Intel 12ª a 14ª geração) com DDR5, formato mATX.',999.90,'kabum','terabyte'),
      ('a620m-asrock','Placa-mãe ASRock A620M-HDV/M.2','motherboard','ASRock','Placa-mãe AM5 básica e barata: serve bem para Ryzen 5 sem overclock.',699.90,'pichau','kabum'),
      ('xpg-lancer-rgb-32gb-ddr5','Memória XPG Lancer RGB 32GB (2x16GB) DDR5 6000MHz','ram','XPG','Kit de 32 GB com iluminação RGB: folga para jogos pesados e visual no gabinete.',699.90,'kabum','pichau'),
      ('wd-black-sn770-2tb','SSD WD Black SN770 2TB NVMe Gen4','ssd','Western Digital','SSD rápido (PCIe 4.0) com 2 TB: cabe uma biblioteca grande de jogos.',899.90,'terabyte','pichau'),
      ('msi-mag-a750gl','Fonte MSI MAG A750GL 750W 80 Plus Gold modular','psu','MSI','Fonte de 750 W Gold e modular (menos cabos sobrando). Folga para placas fortes.',599.90,'kabum','terabyte'),
      ('montech-sky-two','Gabinete Montech Sky Two branco, vidro panorâmico, 4 fans ARGB','case','Montech','Gabinete branco com dois painéis de vidro e 4 ventoinhas ARGB: o PC vira vitrine.',749.90,'pichau','kabum'),
      ('rise-mode-galaxy','Gabinete Rise Mode Galaxy preto com 1 fan','case','Rise Mode','Gabinete simples e barato, sem iluminação. Cumpre o papel quando o dinheiro vai para a placa de vídeo.',199.90,'kabum','terabyte')
    ) as t(slug, name, category, brand, descr, preco, loja1, loja2)
  loop
    insert into public.products (slug, name, category, brand, description)
    values (rec.slug, rec.name, rec.category, rec.brand, rec.descr)
    returning id into pid;

    -- Oferta na loja 1 (preço base) + histórico
    insert into public.offers (product_id, store_id, url, price_pix, price_installment, installment_count, in_stock)
    values (pid, rec.loja1, 'https://www.' || rec.loja1 || '.com.br', rec.preco, round(rec.preco*1.12,2), 10, true)
    returning id into oid;
    atual := rec.preco; inicial := round(atual*1.18,2);
    for i in 0..7 loop
      insert into public.price_history (offer_id, recorded_at, price_pix)
      values (oid, (date '2026-03-01' + (i*15))::timestamptz + time '12:00',
              round((inicial - (inicial-atual)*(i::numeric/7)) * (case when i%2=0 then 1 else 0.985 end), 2));
    end loop;

    -- Oferta na loja 2 (um pouco mais cara) + histórico
    insert into public.offers (product_id, store_id, url, price_pix, price_installment, installment_count, in_stock)
    values (pid, rec.loja2, 'https://www.' || rec.loja2 || '.com.br', round(rec.preco*1.04,2), round(rec.preco*1.16,2), 12, true)
    returning id into oid;
    atual := round(rec.preco*1.04,2); inicial := round(atual*1.18,2);
    for i in 0..7 loop
      insert into public.price_history (offer_id, recorded_at, price_pix)
      values (oid, (date '2026-03-01' + (i*15))::timestamptz + time '12:00',
              round((inicial - (inicial-atual)*(i::numeric/7)) * (case when i%2=0 then 1 else 0.985 end), 2));
    end loop;
  end loop;
end $$;

-- Marketplace genérico (fictício) com nota baixa: NÃO é "loja confiável".
-- Serve para o Montador mostrar a diferença do filtro de lojas.
insert into public.stores (id, name, rating, rating_count, is_official, url) values
  ('promocenter', 'Promo Center (marketplace)', 3.8, 2300, false, null)
on conflict (id) do nothing;

-- Ofertas "boas demais" do marketplace (RTX 4060 e RTX 4070 SUPER).
insert into public.offers (product_id, store_id, url, price_pix, price_installment, installment_count, in_stock)
select p.id, 'promocenter', null, o.pix, o.parc, 12, true
from (values ('rtx-4060', 1649.90, 1899.90), ('rtx-4070-super', 3899.90, 4299.90)) as o(slug, pix, parc)
join public.products p on p.slug = o.slug
where not exists (select 1 from public.offers x where x.product_id = p.id and x.store_id = 'promocenter');
