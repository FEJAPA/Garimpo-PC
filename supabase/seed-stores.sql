-- Reputação das lojas de exemplo (V2, pacote C). Rode depois do schema-stores.sql,
-- do seed.sql e do seed-extras.sql (que cria a "promocenter").
--
-- ############################################################################
-- #  SÓ PARA DEMONSTRAÇÃO. NÃO RODE EM UM BANCO COM DADOS REAIS.             #
-- #  As notas do Reclame Aqui e os anos de mercado abaixo são INVENTADOS:    #
-- #  não foram coletados do site do Reclame Aqui nem das lojas. Com eles, a  #
-- #  tela mostraria "Reclame Aqui 8,2" e "22 anos de mercado" como se fossem #
-- #  fatos, o que fere a regra "dado ilustrativo nunca vira fato no modo     #
-- #  real" (AGENTS.md). Em produção, preencha reclame_aqui_score,            #
-- #  years_active e blocked só com dados conferidos.                         #
-- ############################################################################
--
-- TODO(V2-C): trocar por dados reais.

update public.stores set reclame_aqui_score = 8.2, years_active = 22, blocked = false where id = 'kabum';
update public.stores set reclame_aqui_score = 7.6, years_active = 15, blocked = false where id = 'pichau';
update public.stores set reclame_aqui_score = 7.9, years_active = 18, blocked = false where id = 'terabyte';
update public.stores set reclame_aqui_score = 4.9, years_active = 1,  blocked = false where id = 'promocenter';
