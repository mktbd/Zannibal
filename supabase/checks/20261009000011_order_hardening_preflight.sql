-- Read-only preflight for migration 20261009000011_order_hardening.sql.
--
-- Reports, as aggregate counts only, whether existing orders would stop
-- the migration: Transaction IDs that collide after the migration's
-- normalisation (upper(btrim(...))), and values over the new length
-- limits. It never returns a Transaction ID, name, email, phone number or
-- any other row data. duplicate_transaction_groups,
-- orders_with_duplicate_transaction and the four *_over_* counts must be 0
-- before the migration is applied; otherwise the migration would fail
-- (changing nothing) -- and its error message would print the conflicting
-- value -- so the conflicting rows need an admin decision first.
-- orders_not_yet_normalised is informational (old rows are not rewritten;
-- the index compares them normalised). The *_already_present counts should
-- be 0 (migration not yet applied).
--
-- One SELECT statement: it cannot modify anything. Run by the "preflight"
-- mode of .github/workflows/supabase-migrate.yml (separate approval).
with normalized as (
  select upper(btrim(bkash_transaction_number)) as transaction_key
  from public.orders
),
collisions as (
  select count(*) as orders_in_group
  from normalized
  group by transaction_key
  having count(*) > 1
)
select
  (select count(*) from public.orders) as total_orders,
  (select count(*) from collisions) as duplicate_transaction_groups,
  (select coalesce(sum(orders_in_group), 0)::bigint from collisions) as orders_with_duplicate_transaction,
  (select count(*) from public.orders where bkash_transaction_number <> upper(btrim(bkash_transaction_number))) as orders_not_yet_normalised,
  (select count(*) from public.orders where char_length(customer_name) > 120) as customer_name_over_120,
  (select count(*) from public.orders where char_length(customer_email) > 254) as customer_email_over_254,
  (select count(*) from public.orders where char_length(bkash_number) > 32) as bkash_number_over_32,
  (select count(*) from public.orders where char_length(bkash_transaction_number) > 40) as transaction_number_over_40,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'orders_bkash_transaction_number_key') as unique_index_already_present,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'order_rate_limits') as rate_limit_table_already_present;
