-- Tabelas ligadas ao USUÁRIO logado: favoritos e alertas de preço.
-- Cada linha pertence a um usuário (auth.uid()) e só ele pode ver/mexer.
-- Rode no SQL Editor DEPOIS do schema.sql principal. O script é re-executável.

-- Favoritos: peças que o usuário quer acompanhar.
create table if not exists public.favorites (
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- Alertas de preço: avisar o usuário quando o preço cair até o alvo.
create table if not exists public.price_alerts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  target_price numeric(10,2) not null,   -- avisa quando o preço PIX <= este valor
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  notified_at  timestamptz               -- quando o último aviso foi enviado
);

create index if not exists idx_alerts_product on public.price_alerts(product_id) where is_active;

-- Segurança: cada usuário só enxerga e mexe nas SUAS linhas.
alter table public.favorites    enable row level security;
alter table public.price_alerts enable row level security;

drop policy if exists "favoritos do proprio usuario" on public.favorites;
create policy "favoritos do proprio usuario" on public.favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- schema-alerts.sql reforça esta política: além do dono do alerta, confere o
-- dono da montagem salva (saved_build_id). Por isso aqui ela só é criada se
-- ainda não existir (S-18): rodar este arquivo de novo depois do
-- schema-alerts.sql não pode trocar a versão forte por esta, mais fraca (com a
-- fraca, alguém poderia apontar um alerta para a montagem de outra pessoa, e o
-- e-mail revelaria o total dela).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'price_alerts'
      and policyname = 'alertas do proprio usuario'
  ) then
    create policy "alertas do proprio usuario" on public.price_alerts
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end
$$;
