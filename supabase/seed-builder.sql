-- Dados ILUSTRATIVOS do Montador (espelham src/models/part-specs.ts e
-- src/models/reference-builds.ts). Rode DEPOIS de seed-extras.sql e
-- schema-builder.sql. Pode rodar de novo (upsert).

insert into public.part_specs (product_id, perf, aesthetics, tdp, socket, ram_type, form_factor, case_supports, wattage)
select p.id, s.perf, s.aesthetics, s.tdp, s.socket, s.ram_type, s.form_factor, s.case_supports, s.wattage
from (values
  ('rx-6600',                      78, 40, 132, null,      null,   null,   null, null),
  ('rx-7600',                      97, 45, 165, null,      null,   null,   null, null),
  ('rtx-4060',                    100, 50, 115, null,      null,   null,   null, null),
  ('rtx-4060-ti',                 118, 55, 160, null,      null,   null,   null, null),
  ('rx-7700-xt',                  142, 50, 245, null,      null,   null,   null, null),
  ('rtx-4070-super',              168, 60, 220, null,      null,   null,   null, null),
  ('ryzen-5-7600',                100, 50,  65, 'AM5',     null,   null,   null, null),
  ('core-i5-14400f',               92, 50, 110, 'LGA1700', null,   null,   null, null),
  ('b650m-asus',                  100, 60, null, 'AM5',     'DDR5', 'mATX', null, null),
  ('a620m-asrock',                 80, 35, null, 'AM5',     'DDR5', 'mATX', null, null),
  ('b760m-gigabyte',               95, 45, null, 'LGA1700', 'DDR5', 'mATX', null, null),
  ('corsair-vengeance-16gb-ddr5', 100, 45, null, null,      'DDR5', null,   null, null),
  ('xpg-lancer-rgb-32gb-ddr5',    130, 85, null, null,      'DDR5', null,   null, null),
  ('kingston-nv2-1tb',            100, 30, null, null,      null,   null,   null, null),
  ('wd-black-sn770-2tb',          140, 30, null, null,      null,   null,   null, null),
  ('corsair-cv650',               100, 30, null, null,      null,   null,   null, 650),
  ('msi-mag-a750gl',              125, 55, null, null,      null,   null,   null, 750),
  ('gabinete-gamemax-h605',        70, 65, null, null,      null,   null,   array['ATX','mATX','ITX'], null),
  ('montech-sky-two',              85, 95, null, null,      null,   null,   array['ATX','mATX','ITX'], null),
  ('rise-mode-galaxy',             50, 30, null, null,      null,   null,   array['mATX','ITX'], null)
) as s(slug, perf, aesthetics, tdp, socket, ram_type, form_factor, case_supports, wattage)
join public.products p on p.slug = s.slug
on conflict (product_id) do update set
  perf = excluded.perf, aesthetics = excluded.aesthetics, tdp = excluded.tdp,
  socket = excluded.socket, ram_type = excluded.ram_type, form_factor = excluded.form_factor,
  case_supports = excluded.case_supports, wattage = excluded.wattage, updated_at = now();

insert into public.reference_builds (id, name, description, parts, approx_price, score, fps) values
  ('console', 'Equivalente a console', 'Desempenho na faixa de um console atual. Roda tudo em Full HD no médio.', 'RX 6600 + Ryzen 5 5600 + 16 GB', 4200, 80,
   '{"esports":{"1080p":200,"1440p":140},"aaa-medio":{"1080p":90,"1440p":60},"aaa-pesado":{"1080p":45,"1440p":30}}'),
  ('entrada', 'PC de entrada 2025', 'O ponto de partida clássico: Full HD no alto com folga.', 'RTX 4060 + Ryzen 5 7600 + 16 GB DDR5', 5800, 100,
   '{"esports":{"1080p":260,"1440p":180},"aaa-medio":{"1080p":110,"1440p":75},"aaa-pesado":{"1080p":58,"1440p":38}}'),
  ('intermediario', 'PC intermediário', 'Full HD no ultra e 1440p no alto na maioria dos jogos.', 'RTX 4060 Ti + Core i5-14400F + 16 GB DDR5', 6600, 110,
   '{"esports":{"1080p":280,"1440p":200},"aaa-medio":{"1080p":125,"1440p":85},"aaa-pesado":{"1080p":65,"1440p":44}}'),
  ('intermediario-plus', 'PC intermediário forte', 'Feito para 1440p; Full HD vira passeio.', 'RX 7700 XT + Ryzen 5 7600 + 32 GB DDR5', 7200, 129,
   '{"esports":{"1080p":300,"1440p":230},"aaa-medio":{"1080p":145,"1440p":100},"aaa-pesado":{"1080p":78,"1440p":54}}'),
  ('avancado', 'PC avançado', '1440p no ultra com taxas altas; começa a encarar 4K.', 'RTX 4070 SUPER + Ryzen 7 7700 + 32 GB DDR5', 9500, 150,
   '{"esports":{"1080p":320,"1440p":260},"aaa-medio":{"1080p":170,"1440p":120},"aaa-pesado":{"1080p":95,"1440p":66}}'),
  ('entusiasta', 'PC entusiasta', '4K e 1440p em taxas muito altas; sobra para tudo.', 'RTX 4080 SUPER + Ryzen 7 7800X3D + 32 GB DDR5', 15000, 199,
   '{"esports":{"1080p":360,"1440p":320},"aaa-medio":{"1080p":220,"1440p":165},"aaa-pesado":{"1080p":130,"1440p":95}}')
on conflict (id) do update set
  name = excluded.name, description = excluded.description, parts = excluded.parts,
  approx_price = excluded.approx_price, score = excluded.score, fps = excluded.fps;
