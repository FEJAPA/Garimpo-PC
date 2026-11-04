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
  capacity_gb    smallint,                       -- GB (ram, ssd) — V2
  upscaling      text[],                         -- DLSS | FSR | XeSS (gpu) — V2
  source         text,                           -- de onde veio o número (V2)
  updated_at     timestamptz not null default now()
);

-- V2 (pacote A): bancos criados com a versão anterior deste arquivo já têm a
-- tabela, e o "create table if not exists" acima não acrescenta colunas. Estes
-- "add column if not exists" deixam o script seguro para rodar de novo.
alter table public.part_specs add column if not exists capacity_gb smallint;
alter table public.part_specs add column if not exists upscaling   text[];
alter table public.part_specs add column if not exists source      text;

-- 2) Computadores de referência (para a estimativa de desempenho e o gráfico).
create table if not exists public.reference_builds (
  id            text primary key,                -- ex.: "entrada"
  name          text not null,
  description   text,
  parts         text,                            -- peças principais em texto
  approx_price  numeric(10,2),
  score         numeric(6,1) not null,           -- Índice GarimpoPC
  ram_gb        integer,                         -- memória da referência em GB
  fps           jsonb not null,                  -- {"esports":{"1080p":260,"1440p":180},...}
  source        text,                            -- fonte dos benchmarks (V2)
  measured_at   date
);

alter table public.reference_builds add column if not exists ram_gb integer;

-- 3) Montagens salvas pela pessoa (V2, pacote G).
-- Gravadas pela action saveBuild (src/app/account/actions.ts); o formato do jsonb
-- é o de src/services/saved-builds.ts (toSavedBuildRow / fromSavedBuildRow).
create table if not exists public.saved_builds (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'Minha montagem',
  prefs       jsonb not null,                    -- BuildPreferences
  parts       jsonb not null,                    -- lista de {productId, offerId, price, slug, storeId}
  total_pix   numeric(10,2) not null,            -- total no Pix quando foi salva
  created_at  timestamptz not null default now()
);

-- Regras que o app também confere (nome até 60 caracteres, total não negativo,
-- peças em lista de 1 a 20). O "if not exists" de constraint não existe no
-- Postgres, então cada uma é criada só se ainda não houver (script re-executável).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'saved_builds_name_len') then
    alter table public.saved_builds
      add constraint saved_builds_name_len check (char_length(name) between 1 and 60);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'saved_builds_total_pix_pos') then
    alter table public.saved_builds
      add constraint saved_builds_total_pix_pos check (total_pix >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'saved_builds_parts_array') then
    alter table public.saved_builds
      add constraint saved_builds_parts_array
      -- CASE: o Postgres não garante a ordem do "and", e jsonb_array_length falha em não-lista.
      check (case when jsonb_typeof(parts) = 'array' then jsonb_array_length(parts) between 1 and 20 else false end);
  end if;
end $$;

-- A página /conta lista as montagens da pessoa, da mais nova para a mais antiga.
create index if not exists idx_saved_builds_user on public.saved_builds(user_id, created_at desc);

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
