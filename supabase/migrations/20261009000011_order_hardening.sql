-- Payment security hardening for the manual bKash order flow (Stage 5E-A;
-- docs/MKTBD_SPEC.md section 7, "Payment security (Stage 5E-A)").
--
-- Additive only: no column, table or row is dropped or rewritten, and every
-- existing order keeps its values and status. The whole file runs in one
-- transaction, so if existing data conflicts with a new index or constraint
-- (see supabase/checks/20261009000011_order_hardening_preflight.sql) the
-- migration fails and changes nothing.
--
-- 1. One bKash Transaction ID pays for at most one order, enforced by the
--    database: a unique index on the normalised ID (trimmed, upper-case),
--    across every status. Simultaneous submissions on different server
--    instances can no longer both insert; the loser gets a unique violation
--    (23505), which POST /api/orders turns into the usual resubmission /
--    duplicate answer. Existing rows are indexed as stored, never rewritten.
-- 2. Length limits on the customer fields (the API's limits; the API stays
--    the authority for format), as defence in depth.
-- 3. Signed-in users may update only an order's status (the CMS's only
--    order mutation); the orders_update_admin policy still decides who.
--    anon/authenticated lose the table privileges they never use here
--    (INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER); SELECT stays, still
--    filtered by orders_select_admin.
-- 4. Shared rate limiting for POST /api/orders: an order_rate_limits table
--    and an atomic consume function, both reachable by the service role
--    only.

-- ---------------------------------------------------------------- 1
create unique index orders_bkash_transaction_number_key
  on public.orders (upper(btrim(bkash_transaction_number)));

comment on index public.orders_bkash_transaction_number_key is
  'One order per bKash Transaction ID, compared trimmed and case-insensitively, whatever the order status.';

-- ---------------------------------------------------------------- 2
-- Added NOT VALID, then validated: same result as a plain ADD CONSTRAINT,
-- with the existing-row check as a separate, clearly named step.
alter table public.orders
  add constraint orders_customer_name_length check (char_length(customer_name) <= 120) not valid,
  add constraint orders_customer_email_length check (char_length(customer_email) <= 254) not valid,
  add constraint orders_bkash_number_length check (char_length(bkash_number) <= 32) not valid,
  add constraint orders_bkash_transaction_number_length check (char_length(bkash_transaction_number) <= 40) not valid;

alter table public.orders validate constraint orders_customer_name_length;
alter table public.orders validate constraint orders_customer_email_length;
alter table public.orders validate constraint orders_bkash_number_length;
alter table public.orders validate constraint orders_bkash_transaction_number_length;

-- ---------------------------------------------------------------- 3
revoke insert, update, delete, truncate, references, trigger on table public.orders from anon, authenticated;
grant update (status) on table public.orders to authenticated;

-- ---------------------------------------------------------------- 4
-- One row per (bucket, fixed window). bucket is 'global' or 'ip:' plus the
-- HMAC-SHA256 (hex) of the client IP -- raw IPs are never stored. Only the
-- current and previous windows are needed; older rows are deleted by the
-- function below, so the table holds at most about two windows of data.
create table public.order_rate_limits (
  bucket text not null check (bucket = 'global' or bucket ~ '^ip:[0-9a-f]{64}$'),
  window_start timestamptz not null,
  hits integer not null check (hits >= 0),
  primary key (bucket, window_start)
);

create index order_rate_limits_window_start_idx on public.order_rate_limits (window_start);

comment on table public.order_rate_limits is
  'POST /api/orders rate-limit counters (hashed client IPs + a global bucket). Service role only; rows older than the previous window are purged by consume_order_rate_limit().';

alter table public.order_rate_limits enable row level security;
-- No policies: nothing but the table owner (and the SECURITY DEFINER
-- function it owns) can read or write it. Privileges are revoked as well.
revoke all on table public.order_rate_limits from public, anon, authenticated, service_role;

-- Counts one order submission and says whether it may proceed.
--
-- Sliding-window counter over fixed windows of p_window_seconds: the
-- estimate is the current window's count plus the previous window's count
-- weighted by how much of it still overlaps the sliding window.
--
-- Atomic under concurrency: each counter is incremented with a single
-- INSERT ... ON CONFLICT DO UPDATE, which takes the row lock, so
-- simultaneous calls are serialised per bucket and each sees a distinct
-- count -- no two requests can both take the last slot.
--
-- The client bucket is checked first; a request it refuses is not counted
-- against the global bucket, so one noisy client can't use up everyone's
-- global allowance. Counters are capped at limit + 1, so a client that
-- keeps retrying while blocked recovers as the window slides instead of
-- being locked out indefinitely.
create function public.consume_order_rate_limit(
  p_client text,
  p_client_limit integer,
  p_global_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
set lock_timeout = '2s'
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_epoch double precision := extract(epoch from statement_timestamp());
  v_window timestamptz;
  v_overlap double precision;
  v_retry integer;
  v_bucket text;
  v_curr integer;
  v_prev integer;
begin
  if p_client is null or p_client !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid client key' using errcode = '22023';
  end if;
  if p_client_limit is null or p_client_limit not between 1 and 10000
     or p_global_limit is null or p_global_limit not between 1 and 1000000
     or p_window_seconds is null or p_window_seconds not between 60 and 86400 then
    raise exception 'invalid rate limit settings' using errcode = '22023';
  end if;

  v_window := to_timestamp(floor(v_epoch / p_window_seconds) * p_window_seconds);
  v_overlap := 1 - (v_epoch - extract(epoch from v_window)) / p_window_seconds;
  v_retry := greatest(1, ceil(extract(epoch from v_window) + p_window_seconds - v_epoch)::integer);
  v_bucket := 'ip:' || p_client;

  insert into public.order_rate_limits as r (bucket, window_start, hits)
  values (v_bucket, v_window, 1)
  on conflict (bucket, window_start)
    do update set hits = least(r.hits + 1, p_client_limit + 1)
  returning r.hits into v_curr;

  -- First request from this client in this window: purge expired rows
  -- (anything older than the previous window, for any bucket).
  if v_curr = 1 then
    delete from public.order_rate_limits
    where window_start < v_window - make_interval(secs => p_window_seconds);
  end if;

  select r.hits into v_prev from public.order_rate_limits r
  where r.bucket = v_bucket and r.window_start = v_window - make_interval(secs => p_window_seconds);
  if v_curr + coalesce(v_prev, 0) * v_overlap > p_client_limit then
    return query select false, v_retry;
    return;
  end if;

  insert into public.order_rate_limits as r (bucket, window_start, hits)
  values ('global', v_window, 1)
  on conflict (bucket, window_start)
    do update set hits = least(r.hits + 1, p_global_limit + 1)
  returning r.hits into v_curr;

  select r.hits into v_prev from public.order_rate_limits r
  where r.bucket = 'global' and r.window_start = v_window - make_interval(secs => p_window_seconds);
  if v_curr + coalesce(v_prev, 0) * v_overlap > p_global_limit then
    return query select false, v_retry;
    return;
  end if;

  return query select true, 0;
end;
$$;

comment on function public.consume_order_rate_limit(text, integer, integer, integer) is
  'Atomically counts one POST /api/orders submission for a hashed client IP and the global bucket; returns whether it may proceed. Service role only.';

-- New functions in public are executable by anon/authenticated by default
-- (Supabase default privileges): take that away explicitly.
revoke all on function public.consume_order_rate_limit(text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_order_rate_limit(text, integer, integer, integer) to service_role;
