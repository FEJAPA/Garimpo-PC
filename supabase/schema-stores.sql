-- Reputação das lojas (V2, pacote C): Reclame Aqui, tempo de mercado e bloqueio.
-- Rode no SQL Editor depois do schema.sql principal. Pode rodar mais de uma vez.

alter table public.stores
  add column if not exists reclame_aqui_score numeric(3,1)
    check (reclame_aqui_score is null or (reclame_aqui_score >= 0 and reclame_aqui_score <= 10));  -- nota de 0.0 a 10.0

alter table public.stores
  add column if not exists years_active integer
    check (years_active is null or years_active >= 0);  -- anos de mercado

alter table public.stores
  add column if not exists blocked boolean not null default false;  -- loja bloqueada por denúncias: nunca é confiável
