-- Seed dos computadores de referência (V2, pacote D).
-- Mesmo conteúdo de src/models/reference-builds.ts (a lista do código é a reserva
-- quando o Supabase não está configurado ou a tabela está vazia). Esta é a ÚNICA fonte
-- de reference_builds no SQL: supabase/seed-builder.sql não grava mais essa tabela
-- (rodá-lo depois deste voltaria os valores antigos).
--
-- Rode DEPOIS de supabase/schema-builder.sql (que cria a tabela, inclusive a coluna
-- ram_gb). É idempotente (upsert por id).
--
-- ATENÇÃO: `fps` e `score` são ESTIMATIVAS GarimpoPC, não medições nossas: partem de
-- índices de referência (em parte ilustrativos, V1) e de agregados públicos (ver a
-- coluna `source` e docs/METODOLOGIA-DESEMPENHO.md). `measured_at` NÃO é data de
-- medição: guarda o mês de referência das fontes (dia 01 por convenção, porque a coluna
-- é do tipo date). Nunca grave aqui um mês que a fonte não tem.
insert into public.reference_builds
  (id, name, description, parts, approx_price, score, fps, ram_gb, source, measured_at)
values
  ('console', 'Equivalente a console', 'Desempenho na faixa de um console atual. Roda tudo em Full HD no médio/alto.', 'RX 6600 + Ryzen 5 5600 + 16 GB DDR4', 4200, 80, '{"esports":{"1080p":235,"1440p":165},"aaa-medio":{"1080p":80,"1440p":57},"aaa-pesado":{"1080p":41,"1440p":28}}'::jsonb, 16, 'Estimativa GarimpoPC: índices de referência (parte ilustrativa, V1) + agregados públicos (checkfps.io, Tom''s Hardware), consultados em nov/2026', '2026-05-01'::date),
  ('entrada-economica', 'PC de entrada econômico', 'Full HD no alto na maioria dos jogos, reaproveitando plataforma DDR4.', 'RX 7600 + Ryzen 5 5600 + 16 GB DDR4', 4900, 93, '{"esports":{"1080p":251,"1440p":191},"aaa-medio":{"1080p":97,"1440p":71},"aaa-pesado":{"1080p":50,"1440p":35}}'::jsonb, 16, 'Estimativa GarimpoPC: índices de referência (parte ilustrativa, V1) + agregados públicos (checkfps.io, Tom''s Hardware), consultados em nov/2026', '2026-05-01'::date),
  ('entrada', 'PC de entrada 2025', 'O ponto de partida clássico: Full HD no alto com folga.', 'RTX 4060 + Ryzen 5 7600 + 16 GB DDR5', 5800, 100, '{"esports":{"1080p":270,"1440p":200},"aaa-medio":{"1080p":102,"1440p":74},"aaa-pesado":{"1080p":52,"1440p":36}}'::jsonb, 16, 'Estimativa GarimpoPC: índices de referência (parte ilustrativa, V1) + agregados públicos (checkfps.io, Tom''s Hardware), consultados em nov/2026', '2026-05-01'::date),
  ('intermediario', 'PC intermediário', 'Full HD no ultra e 1440p no alto na maioria dos jogos.', 'RTX 4060 Ti + Core i5-14400F + 16 GB DDR5', 6600, 110, '{"esports":{"1080p":277,"1440p":221},"aaa-medio":{"1080p":115,"1440p":87},"aaa-pesado":{"1080p":61,"1440p":43}}'::jsonb, 16, 'Estimativa GarimpoPC: índices de referência (parte ilustrativa, V1) + agregados públicos (checkfps.io, Tom''s Hardware), consultados em nov/2026', '2026-05-01'::date),
  ('intermediario-2026', 'PC intermediário 2026', '16 GB de vídeo e 32 GB de memória: Full HD no ultra e 1440p confortável.', 'RX 9060 XT 16 GB + Ryzen 5 7600 + 32 GB DDR5', 7000, 122, '{"esports":{"1080p":298,"1440p":242},"aaa-medio":{"1080p":128,"1440p":98},"aaa-pesado":{"1080p":68,"1440p":48}}'::jsonb, 32, 'Estimativa GarimpoPC: índices de referência (parte ilustrativa, V1) + agregados públicos (checkfps.io, Tom''s Hardware), consultados em nov/2026', '2026-05-01'::date),
  ('intermediario-plus', 'PC intermediário forte', 'Feito para 1440p; Full HD vira passeio.', 'RX 7700 XT + Ryzen 5 7600 + 32 GB DDR5', 7300, 129, '{"esports":{"1080p":305,"1440p":253},"aaa-medio":{"1080p":134,"1440p":105},"aaa-pesado":{"1080p":72,"1440p":52}}'::jsonb, 32, 'Estimativa GarimpoPC: índices de referência (parte ilustrativa, V1) + agregados públicos (checkfps.io, Tom''s Hardware), consultados em nov/2026', '2026-05-01'::date),
  ('avancado', 'PC avançado', '1440p no ultra com taxas altas; começa a encarar 4K.', 'RTX 4070 SUPER + Ryzen 7 7700 + 32 GB DDR5', 9500, 149, '{"esports":{"1080p":328,"1440p":283},"aaa-medio":{"1080p":151,"1440p":123},"aaa-pesado":{"1080p":84,"1440p":62}}'::jsonb, 32, 'Estimativa GarimpoPC: índices de referência (parte ilustrativa, V1) + agregados públicos (checkfps.io, Tom''s Hardware), consultados em nov/2026', '2026-05-01'::date),
  ('avancado-plus', 'PC avançado forte', '1440p no ultra acima de 60 fps até nos jogos pesados.', 'RX 9070 XT + Ryzen 7 7700 + 32 GB DDR5', 10500, 171, '{"esports":{"1080p":343,"1440p":307},"aaa-medio":{"1080p":163,"1440p":140},"aaa-pesado":{"1080p":96,"1440p":74}}'::jsonb, 32, 'Estimativa GarimpoPC: índices de referência (parte ilustrativa, V1) + agregados públicos (checkfps.io, Tom''s Hardware), consultados em nov/2026', '2026-05-01'::date),
  ('alto', 'PC de alto desempenho', '1440p com taxas muito altas; 4K no alto na maioria dos jogos.', 'RTX 5070 Ti + Ryzen 7 7700 + 32 GB DDR5', 12500, 182, '{"esports":{"1080p":348,"1440p":316},"aaa-medio":{"1080p":167,"1440p":147},"aaa-pesado":{"1080p":101,"1440p":79}}'::jsonb, 32, 'Estimativa GarimpoPC: índices de referência (parte ilustrativa, V1) + agregados públicos (checkfps.io, Tom''s Hardware), consultados em nov/2026', '2026-05-01'::date),
  ('entusiasta', 'PC entusiasta', '4K e 1440p em taxas muito altas; sobra para tudo.', 'RTX 4080 SUPER + Ryzen 7 7800X3D + 32 GB DDR5', 15000, 194, '{"esports":{"1080p":402,"1440p":359},"aaa-medio":{"1080p":192,"1440p":162},"aaa-pesado":{"1080p":110,"1440p":84}}'::jsonb, 32, 'Estimativa GarimpoPC: índices de referência (parte ilustrativa, V1) + agregados públicos (checkfps.io, Tom''s Hardware), consultados em nov/2026', '2026-05-01'::date),
  ('entusiasta-plus', 'PC entusiasta forte', 'Para monitores de alta taxa em 1440p e 4K no ultra.', 'RTX 5080 + Ryzen 7 9800X3D + 32 GB DDR5', 18500, 212, '{"esports":{"1080p":441,"1440p":395},"aaa-medio":{"1080p":213,"1440p":178},"aaa-pesado":{"1080p":120,"1440p":91}}'::jsonb, 32, 'Estimativa GarimpoPC: índices de referência (parte ilustrativa, V1) + agregados públicos (checkfps.io, Tom''s Hardware), consultados em nov/2026', '2026-05-01'::date),
  ('topo', 'PC topo de linha', 'O máximo de hoje: 4K no ultra com folga.', 'RTX 5090 + Ryzen 7 9800X3D + 64 GB DDR5', 32000, 257, '{"esports":{"1080p":476,"1440p":441},"aaa-medio":{"1080p":234,"1440p":209},"aaa-pesado":{"1080p":142,"1440p":115}}'::jsonb, 64, 'Estimativa GarimpoPC: índices de referência (parte ilustrativa, V1) + agregados públicos (checkfps.io, Tom''s Hardware), consultados em nov/2026', '2026-05-01'::date)
on conflict (id) do update set
  name         = excluded.name,
  description  = excluded.description,
  parts        = excluded.parts,
  approx_price = excluded.approx_price,
  score        = excluded.score,
  fps          = excluded.fps,
  ram_gb       = excluded.ram_gb,
  source       = excluded.source,
  measured_at  = excluded.measured_at;
