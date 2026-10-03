-- Foundations shared by every later migration: extensions, enum types, and
-- the generic updated_at trigger function.
--
-- Kept in its own file so it only ever needs to change when a genuinely new
-- shared primitive is introduced.

-- gen_random_uuid() ships in modern Postgres, but pgcrypto is enabled
-- defensively/idempotently since some environments still need it.
create extension if not exists pgcrypto;

-- Used by: analyses.status, case_studies.status.
create type public.content_status as enum ('draft', 'published');

-- Used by: orders.status.
create type public.order_status as enum ('pending', 'fulfilled', 'invalid');

-- Generic "bump updated_at on any row update" trigger function, reused by
-- every table below that has an updated_at column. Keeps that bookkeeping
-- out of application code, where it's easy to forget on one mutation path.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Row-level trigger: sets NEW.updated_at = now() on every UPDATE. Attach with:
   create trigger <table>_set_updated_at before update on public.<table>
   for each row execute function public.set_updated_at();';
