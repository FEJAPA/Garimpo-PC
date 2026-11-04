-- Dados de EXEMPLO dos juros por loja (V2, pacote E). Valores ILUSTRATIVOS,
-- iguais ao mock de src/models/installment-tables.ts; não são as condições
-- reais das lojas. Rode depois de schema-payments.sql e dos seeds das lojas
-- (seed.sql cria kabum/pichau/terabyte; seed-extras.sql cria promocenter).
-- Só insere faixas de lojas que existem, e pode ser rodado de novo.

insert into public.store_installments (store_id, count, factor)
select v.store_id, v.count, v.factor
from (values
  ('kabum',       10::smallint, 1.0000::numeric(6,4)),  -- até 10x sem juros
  ('kabum',       12::smallint, 1.0600::numeric(6,4)),  -- 11x e 12x: +6%
  ('pichau',      12::smallint, 1.0000::numeric(6,4)),  -- até 12x sem juros
  ('terabyte',    10::smallint, 1.0500::numeric(6,4)),  -- qualquer parcelamento: +5%
  ('promocenter', 12::smallint, 1.1500::numeric(6,4))   -- marketplace: +15%
) as v(store_id, count, factor)
where exists (select 1 from public.stores s where s.id = v.store_id)
on conflict (store_id, count) do update set factor = excluded.factor;
