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
    'b650m-asus','corsair-cv650','gabinete-gamemax-h605'
  );

  for rec in
    select * from (values
      ('ryzen-5-7600','AMD Ryzen 5 7600','cpu','AMD','Processador de 6 núcleos da plataforma AM5. Ótimo custo-benefício para jogos em Full HD.',1299.90,'kabum','pichau'),
      ('core-i5-14400f','Intel Core i5-14400F','cpu','Intel','Processador de 10 núcleos, popular em PCs gamer de entrada/médio. Precisa de placa de vídeo.',1149.90,'terabyte','kabum'),
      ('corsair-vengeance-16gb-ddr5','Memória Corsair Vengeance 16GB DDR5 5600MHz','ram','Corsair','Kit de memória RAM DDR5 rápido, ideal para PCs novos AM5/Intel recentes.',349.90,'kabum','terabyte'),
      ('kingston-nv2-1tb','SSD Kingston NV2 1TB NVMe','ssd','Kingston','SSD NVMe de 1TB, rápido e barato. Espaço para sistema, programas e vários jogos.',419.90,'pichau','kabum'),
      ('b650m-asus','Placa-mãe ASUS TUF B650M-Plus','motherboard','ASUS','Placa-mãe AM5 (para Ryzen série 7000+), boa para montagens de médio porte.',1199.90,'kabum','pichau'),
      ('corsair-cv650','Fonte Corsair CV650 650W 80 Plus Bronze','psu','Corsair','Fonte de 650W com certificação 80 Plus Bronze. Opção confiável para PCs de médio porte.',329.90,'terabyte','kabum'),
      ('gabinete-gamemax-h605','Gabinete Gamemax H605 com 3 fans ARGB','case','Gamemax','Gabinete médio com lateral de vidro e ventiladores ARGB inclusos. Bom visual por preço acessível.',279.90,'kabum','pichau')
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
