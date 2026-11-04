-- Juros por loja (V2, pacote E): fator sobre o preço do Pix por número de parcelas.
-- Rode no SQL Editor depois do schema.sql principal (precisa da tabela stores).
--
-- Como ler: cada linha é uma faixa. Pix × factor da menor faixa com count >= n
-- dá o total em n parcelas, MAS o Montador nunca cobra menos que o preço a prazo
-- da oferta (price_installment): total = max(preço a prazo, Pix × factor). No
-- Brasil, "10x sem juros" é sobre o preço a prazo, que já é maior que o Pix.
-- Ex.: (kabum, 10, 1.1000) e (kabum, 12, 1.1600) = "até 10x pelo preço a prazo
-- (~10% acima do Pix); 11x e 12x custam Pix + 16%".
-- A loja parcela até o maior count dela (no máximo 24x). Sem linhas para a loja,
-- o Montador usa o preço parcelado da própria oferta (comportamento V1).

create table if not exists public.store_installments (
  store_id  text     not null references public.stores(id) on delete cascade,
  count     smallint not null check (count between 1 and 24),
  factor    numeric(6,4) not null check (factor >= 1),  -- 1.0000 = mesmo preço do Pix
  primary key (store_id, count)
);

-- Bancos criados antes do teto de 24x (LOG-12): troca a checagem antiga.
alter table public.store_installments drop constraint if exists store_installments_count_check;
alter table public.store_installments add constraint store_installments_count_check
  check (count between 1 and 24);

-- Segurança: qualquer um pode LER (são condições públicas das lojas); a escrita
-- fica com o servidor (chave de serviço), então não liberamos insert/update.
alter table public.store_installments enable row level security;

drop policy if exists "leitura publica store_installments" on public.store_installments;
create policy "leitura publica store_installments" on public.store_installments
  for select using (true);
