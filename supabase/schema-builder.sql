-- Montador de PC: tabelas de apoio (scaffold V1 — ainda NÃO usadas pelo app).
-- Na V1 as specs e as referências vivem em src/models/part-specs.ts e
-- src/models/reference-builds.ts. Na V2 (pacotes A, D e G do plano) o app passa
-- a ler daqui. Rode no SQL Editor DEPOIS de schema.sql e schema-auth.sql.

-- 1) Especificações técnicas por peça (1 linha por produto).
create table if not exists public.part_specs (
  product_id     uuid primary key references public.products(id) on delete cascade,
  perf           numeric(6,1) not null,          -- índice relativo na categoria (RTX 4060 = 100)
  aesthetics     smallint not null default 50,   -- 0 a 100
  tdp            smallint,                       -- W (gpu, cpu)
  socket         text,                           -- AM4 | AM5 | LGA1700
  ram_type       text,                           -- DDR4 | DDR5
  form_factor    text,                           -- ATX | mATX | ITX (placa-mãe)
  case_supports  text[],                         -- form factors aceitos (gabinete)
  wattage        smallint,                       -- W (fonte)
  source         text,                           -- de onde veio o número (V2)
  updated_at     timestamptz not null default now()
);

-- 2) Computadores de referência (para a estimativa de desempenho e o gráfico).
create table if not exists public.reference_builds (
  id            text primary key,                -- ex.: "entrada"
  name          text not null,
  description   text,
  parts         text,                            -- peças principais em texto
  approx_price  numeric(10,2),
  score         numeric(6,1) not null,           -- Índice GarimpoPC
  fps           jsonb not null,                  -- {"esports":{"1080p":260,"1440p":180},...}
  source        text,                            -- fonte dos benchmarks (V2)
  measured_at   date
);

-- 3) Montagens salvas pela pessoa (V2, pacote G).
create table if not exists public.saved_builds (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'Minha montagem',
  prefs       jsonb not null,                    -- BuildPreferences
  parts       jsonb not null,                    -- lista de {product_id, offer_id, price}
  total_pix   numeric(10,2) not null,
  created_at  timestamptz not null default now()
);

alter table public.part_specs       enable row level security;
alter table public.reference_builds enable row level security;
alter table public.saved_builds     enable row level security;

drop policy if exists "leitura publica part_specs" on public.part_specs;
create policy "leitura publica part_specs" on public.part_specs for select using (true);

drop policy if exists "leitura publica reference_builds" on public.reference_builds;
create policy "leitura publica reference_builds" on public.reference_builds for select using (true);

drop policy if exists "montagens do proprio usuario" on public.saved_builds;
create policy "montagens do proprio usuario" on public.saved_builds
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
