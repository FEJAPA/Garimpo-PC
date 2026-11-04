-- Reputação das lojas de exemplo (V2, pacote C). Rode depois do schema-stores.sql,
-- do seed.sql e do seed-extras.sql (que cria a "promocenter").
--
-- ATENÇÃO: as notas do Reclame Aqui e os anos de mercado abaixo são ILUSTRATIVOS,
-- não foram coletados do site do Reclame Aqui. TODO(V2-C): trocar por dados reais.

update public.stores set reclame_aqui_score = 8.2, years_active = 22, blocked = false where id = 'kabum';
update public.stores set reclame_aqui_score = 7.6, years_active = 15, blocked = false where id = 'pichau';
update public.stores set reclame_aqui_score = 7.9, years_active = 18, blocked = false where id = 'terabyte';
update public.stores set reclame_aqui_score = 4.9, years_active = 1,  blocked = false where id = 'promocenter';
