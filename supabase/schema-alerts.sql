-- Alertas da montagem inteira e hora da última leitura de preço (V2, pacote G).
--
-- Ordem: rode DEPOIS de schema.sql, schema-auth.sql e schema-builder.sql
-- (precisa de price_alerts e saved_builds). O script é re-executável.

-- 1) Alerta de montagem: um alerta agora é de UMA peça (product_id) OU de UMA
--    montagem salva (saved_build_id). Apagar a montagem apaga os alertas dela.
alter table public.price_alerts
  add column if not exists saved_build_id uuid references public.saved_builds(id) on delete cascade;

-- Alerta de montagem não tem peça.
alter table public.price_alerts alter column product_id drop not null;

do $$
begin
  -- Exatamente um dos dois alvos (peça ou montagem).
  if not exists (select 1 from pg_constraint where conname = 'price_alerts_um_alvo') then
    alter table public.price_alerts
      add constraint price_alerts_um_alvo check ((product_id is null) <> (saved_build_id is null));
  end if;
  -- SEG-10: preço-alvo positivo e até R$ 1.000.000 (o app confere o mesmo).
  -- "not valid" para não falhar em bancos com alertas antigos fora da faixa;
  -- vale para toda linha nova ou alterada.
  if not exists (select 1 from pg_constraint where conname = 'price_alerts_target_faixa') then
    alter table public.price_alerts
      add constraint price_alerts_target_faixa check (target_price > 0 and target_price <= 1000000) not valid;
  end if;
end $$;

create index if not exists idx_alerts_saved_build on public.price_alerts(saved_build_id) where is_active;
-- A rota /api/check-alerts percorre os pendentes em ordem de id (paginação por chave).
create index if not exists idx_alerts_pendentes on public.price_alerts(id) where is_active and notified_at is null;

-- RLS: a política de schema-auth.sql já limita cada pessoa às suas linhas
-- (user_id = auth.uid()). Ela é recriada aqui para também impedir que alguém
-- crie um alerta apontando para a montagem salva de OUTRA pessoa (a FK sozinha
-- não confere o dono, e o e-mail revelaria o total da montagem alheia).
drop policy if exists "alertas do proprio usuario" on public.price_alerts;
create policy "alertas do proprio usuario" on public.price_alerts
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      saved_build_id is null
      or exists (
        select 1 from public.saved_builds b
        where b.id = price_alerts.saved_build_id and b.user_id = auth.uid()
      )
    )
  );

-- 2) Hora da última leitura de preço por oferta ("preço de hoje às HH:MM", G3).
--    Uma consulta agregada: max(recorded_at) por offer_id. É uma view (e não a
--    sintaxe de agregação do PostgREST) porque a agregação vem desligada por
--    padrão no Supabase. security_invoker: a view respeita a RLS de quem
--    consulta (price_history já tem leitura pública em schema.sql).
create index if not exists idx_history_offer_recorded on public.price_history(offer_id, recorded_at desc);

create or replace view public.offer_last_seen
  with (security_invoker = true) as
  select offer_id, max(recorded_at) as recorded_at
  from public.price_history
  group by offer_id;

grant select on public.offer_last_seen to anon, authenticated;
