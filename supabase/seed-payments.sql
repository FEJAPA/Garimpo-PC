-- ============================================================================
-- SÓ PARA DEMONSTRAÇÃO. NÃO RODE EM PRODUÇÃO.
-- Os fatores abaixo são INVENTADOS (ilustrativos), iguais ao mock de
-- src/models/installment-tables.ts; não são as condições reais das lojas.
-- Num banco com ofertas reais, juros inventados virariam "fato" na tela
-- (regra do AGENTS.md: dado ilustrativo nunca vira fato no modo real).
-- Em produção, preencha store_installments só com condições conferidas na loja.
-- ============================================================================
--
-- Juros por loja (V2, pacote E). Rode depois de schema-payments.sql e dos seeds
-- das lojas (seed.sql cria kabum/pichau/terabyte; seed-extras.sql cria
-- promocenter). Só insere faixas de lojas que existem, e pode ser rodado de novo.
--
-- Premissa: "10x sem juros" no Brasil é sobre o preço A PRAZO, que já é ~10%
-- maior que o Pix. O Montador cobra o preço a prazo da oferta até o número de
-- parcelas que ela anuncia; acima disso, max(preço a prazo da oferta, Pix × factor).
-- Fator ~1,10 = "sem acréscimo" (vale o preço a prazo anunciado); acima disso,
-- juros de verdade. A loja parcela até o maior `count` dela.

insert into public.store_installments (store_id, count, factor)
select v.store_id, v.count, v.factor
from (values
  ('kabum',       10::smallint, 1.1000::numeric(6,4)),  -- até 10x pelo preço a prazo
  ('kabum',       12::smallint, 1.1600::numeric(6,4)),  -- 11x e 12x: Pix + 16%
  ('pichau',      12::smallint, 1.1000::numeric(6,4)),  -- até 12x pelo preço a prazo
  ('terabyte',    10::smallint, 1.1000::numeric(6,4)),  -- até 10x pelo preço a prazo
  ('terabyte',    12::smallint, 1.1500::numeric(6,4)),  -- 11x e 12x: Pix + 15%
  ('promocenter', 12::smallint, 1.1500::numeric(6,4))   -- marketplace: Pix + 15% (acima do anunciado)
) as v(store_id, count, factor)
where exists (select 1 from public.stores s where s.id = v.store_id)
on conflict (store_id, count) do update set factor = excluded.factor;

-- A faixa de 6x que este seed criava para a Terabyte (até a rodada final) sai:
-- com a regra nova ela não muda nada e confunde quem lê a tabela. Só apaga a
-- linha de demonstração (mesmo fator); uma faixa conferida à mão fica.
delete from public.store_installments
where store_id = 'terabyte' and count = 6 and factor = 1.1000;

