-- Popularidade das peças: visitas reais + marcação de "destaque" manual.
-- Rode no SQL Editor depois do schema.sql principal.

-- 1) Coluna "featured" (destaque manual/curadoria) na tabela de peças.
alter table public.products
  add column if not exists featured boolean not null default false;

-- 2) Registro de visitas a uma peça (uma linha por visita). Usado para calcular
--    as "mais procuradas" de verdade conforme o site recebe tráfego.
create table if not exists public.product_views (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  viewed_at   timestamptz not null default now()
);

create index if not exists idx_views_product on public.product_views(product_id);
create index if not exists idx_views_when on public.product_views(viewed_at);

-- Segurança: qualquer um pode LER a contagem; a inserção de visita é feita pelo
-- servidor (chave de serviço), então não liberamos insert público aqui.
alter table public.product_views enable row level security;

drop policy if exists "leitura publica product_views" on public.product_views;
create policy "leitura publica product_views" on public.product_views
  for select using (true);

-- 3) View que resume a popularidade dos últimos 30 dias por peça.
--    (uma "view" no banco é uma consulta salva, fácil de reutilizar.)
create or replace view public.popular_products as
select
  p.id as product_id,
  count(v.id) as views_30d
from public.products p
left join public.product_views v
  on v.product_id = p.id
  and v.viewed_at >= now() - interval '30 days'
group by p.id;
