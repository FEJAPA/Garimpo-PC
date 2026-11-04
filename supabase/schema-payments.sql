-- Juros por loja (V2, pacote E): fator sobre o preço do Pix por número de parcelas.
-- Rode no SQL Editor depois do schema.sql principal (precisa da tabela stores).
--
-- Como ler: cada linha é uma faixa. total em n parcelas = preço Pix × factor da
-- menor faixa com count >= n. Ex.: (kabum, 10, 1.0000) e (kabum, 12, 1.0600)
-- = "até 10x sem juros; 11x e 12x custam 6% a mais que o Pix".
-- A loja parcela até o maior count dela. Sem linhas para a loja, o Montador usa
-- o preço parcelado da própria oferta (comportamento V1).

create table if not exists public.store_installments (
  store_id  text     not null references public.stores(id) on delete cascade,
  count     smallint not null check (count >= 1),
  factor    numeric(6,4) not null check (factor >= 1),  -- 1.0000 = sem juros
  primary key (store_id, count)
);

-- Segurança: qualquer um pode LER (são condições públicas das lojas); a escrita
-- fica com o servidor (chave de serviço), então não liberamos insert/update.
alter table public.store_installments enable row level security;

drop policy if exists "leitura publica store_installments" on public.store_installments;
create policy "leitura publica store_installments" on public.store_installments
  for select using (true);
