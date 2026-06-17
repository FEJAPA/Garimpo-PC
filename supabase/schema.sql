-- Estrutura do banco de dados do GarimpoPC.
-- Cria as 4 tabelas principais: lojas, peças, ofertas e histórico de preços.
-- Espelha os tipos definidos em src/lib/types.ts.

-- 1) Lojas onde as peças são vendidas.
create table if not exists public.stores (
  id            text primary key,           -- ex.: "kabum"
  name          text not null,              -- ex.: "KaBuM!"
  rating        numeric(2,1) not null default 0,   -- nota de 0.0 a 5.0
  rating_count  integer not null default 0,        -- nº de avaliações
  is_official   boolean not null default false,    -- loja oficial/curada por nós
  url           text
);

-- 2) Peças (produtos canônicos), independentes de loja.
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,        -- usado na URL, ex.: "rtx-4060"
  name         text not null,
  category     text not null,               -- "gpu", "cpu", "ram", ...
  brand        text,
  description  text,
  image_url    text
);

-- 3) Ofertas: uma peça à venda em uma loja específica.
create table if not exists public.offers (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null references public.products(id) on delete cascade,
  store_id           text not null references public.stores(id) on delete cascade,
  url                text,
  price_pix          numeric(10,2) not null,   -- preço à vista/PIX
  price_installment  numeric(10,2),            -- preço parcelado total
  installment_count  integer,                  -- em quantas vezes
  in_stock           boolean not null default true
);

-- 4) Histórico de preços: leitura de preço de uma oferta ao longo do tempo.
create table if not exists public.price_history (
  id           uuid primary key default gen_random_uuid(),
  offer_id     uuid not null references public.offers(id) on delete cascade,
  recorded_at  timestamptz not null default now(),
  price_pix    numeric(10,2) not null
);

-- Índices para deixar as buscas rápidas.
create index if not exists idx_offers_product on public.offers(product_id);
create index if not exists idx_history_offer on public.price_history(offer_id);
create index if not exists idx_history_recorded on public.price_history(recorded_at);

-- Segurança (RLS): o app só lê dados públicos com a chave "anon".
-- Habilitamos a proteção e liberamos apenas LEITURA pública nas 4 tabelas.
-- Escrita ficará a cargo da coleta (com chave de serviço), em marco futuro.
alter table public.stores        enable row level security;
alter table public.products      enable row level security;
alter table public.offers        enable row level security;
alter table public.price_history enable row level security;

drop policy if exists "leitura publica stores" on public.stores;
drop policy if exists "leitura publica products" on public.products;
drop policy if exists "leitura publica offers" on public.offers;
drop policy if exists "leitura publica price_history" on public.price_history;

create policy "leitura publica stores"        on public.stores        for select using (true);
create policy "leitura publica products"      on public.products      for select using (true);
create policy "leitura publica offers"        on public.offers        for select using (true);
create policy "leitura publica price_history" on public.price_history for select using (true);
