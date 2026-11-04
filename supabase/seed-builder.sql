-- Dados ILUSTRATIVOS do Montador (espelham src/models/part-specs.ts). Rode DEPOIS de
-- seed-extras.sql e schema-builder.sql. Pode rodar de novo (upsert).
-- Os computadores de referência (reference_builds) NÃO são gravados aqui: a fonte é
-- supabase/seed-references.sql.

-- capacity_gb (ram, ssd) e upscaling (gpu) entraram na V2 (pacote A). A coluna
-- source marca TODAS estas linhas como "ilustrativo (V1)": não são medições.
insert into public.part_specs (product_id, perf, aesthetics, tdp, socket, ram_type, form_factor, case_supports, wattage, capacity_gb, upscaling, source)
select p.id, s.perf, s.aesthetics, s.tdp, s.socket, s.ram_type, s.form_factor, s.case_supports, s.wattage, s.capacity_gb, s.upscaling, 'ilustrativo (V1)'
from (values
  ('rx-6600',                      78, 40, 132, null,      null,   null,   null, null, null, array['FSR']),
  ('rx-7600',                      97, 45, 165, null,      null,   null,   null, null, null, array['FSR']),
  ('rtx-4060',                    100, 50, 115, null,      null,   null,   null, null, null, array['DLSS','FSR']),
  ('rtx-4060-ti',                 118, 55, 160, null,      null,   null,   null, null, null, array['DLSS','FSR']),
  ('rx-7700-xt',                  142, 50, 245, null,      null,   null,   null, null, null, array['FSR']),
  ('rtx-4070-super',              168, 60, 220, null,      null,   null,   null, null, null, array['DLSS','FSR']),
  ('ryzen-5-7600',                100, 50,  65, 'AM5',     null,   null,   null, null, null, null::text[]),
  ('core-i5-14400f',               92, 50, 110, 'LGA1700', null,   null,   null, null, null, null::text[]),
  ('b650m-asus',                  100, 60, null, 'AM5',     'DDR5', 'mATX', null, null, null, null::text[]),
  ('a620m-asrock',                 80, 35, null, 'AM5',     'DDR5', 'mATX', null, null, null, null::text[]),
  ('b760m-gigabyte',               95, 45, null, 'LGA1700', 'DDR5', 'mATX', null, null, null, null::text[]),
  ('corsair-vengeance-16gb-ddr5', 100, 45, null, null,      'DDR5', null,   null, null, 16, null::text[]),
  ('xpg-lancer-rgb-32gb-ddr5',    130, 85, null, null,      'DDR5', null,   null, null, 32, null::text[]),
  ('kingston-nv2-1tb',            100, 30, null, null,      null,   null,   null, null, 1000, null::text[]),
  ('wd-black-sn770-2tb',          140, 30, null, null,      null,   null,   null, null, 2000, null::text[]),
  ('corsair-cv650',               100, 30, null, null,      null,   null,   null, 650, null, null::text[]),
  ('msi-mag-a750gl',              125, 55, null, null,      null,   null,   null, 750, null, null::text[]),
  ('gabinete-gamemax-h605',        70, 65, null, null,      null,   null,   array['ATX','mATX','ITX'], null, null, null::text[]),
  ('montech-sky-two',              85, 95, null, null,      null,   null,   array['ATX','mATX','ITX'], null, null, null::text[]),
  ('rise-mode-galaxy',             50, 30, null, null,      null,   null,   array['mATX','ITX'], null, null, null::text[])
) as s(slug, perf, aesthetics, tdp, socket, ram_type, form_factor, case_supports, wattage, capacity_gb, upscaling)
join public.products p on p.slug = s.slug
on conflict (product_id) do update set
  perf = excluded.perf, aesthetics = excluded.aesthetics, tdp = excluded.tdp,
  socket = excluded.socket, ram_type = excluded.ram_type, form_factor = excluded.form_factor,
  case_supports = excluded.case_supports, wattage = excluded.wattage,
  capacity_gb = excluded.capacity_gb, upscaling = excluded.upscaling, source = excluded.source,
  updated_at = now();
