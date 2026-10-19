-- STAGING ONLY (Stage 05E-B2A). Not a migration; never run against production.
-- Run by the cloudflare-staging workflow (migrate-staging) right after migrations
-- 1-11, with psql -v ref=<confirmed staging ref>. Writes the identity marker that
-- every staging script checks, and an anon-callable function that returns it, so
-- the deploy job can prove its Supabase URL + anon key are the staging project
-- without holding database credentials. The function exposes only this constant.
\set ON_ERROR_STOP on
begin;
create schema if not exists staging_disposable;
comment on schema staging_disposable is 'Disposable mktbd staging database (Stage 05E-B2A). Never production.';
create table if not exists staging_disposable.identity (ref text primary key check (ref ~ '^[a-z0-9]{20}$'));
-- A marker naming a different project means the wrong database: stop
-- (leaving psql mid-transaction rolls everything back).
select count(*) = 0 as marker_ok from staging_disposable.identity where ref <> :'ref' \gset
\if :marker_ok
\else
  -- Raising an error makes psql (ON_ERROR_STOP) exit non-zero and roll back.
  do $$ begin raise exception 'REFUSED: staging marker names a different project'; end $$;
\endif
insert into staging_disposable.identity (ref) values (:'ref') on conflict do nothing;
revoke all on schema staging_disposable from public, anon, authenticated;
revoke all on table staging_disposable.identity from public, anon, authenticated;

create or replace function public.staging_identity()
returns text
language sql
stable
security definer
set search_path = ''
as $$ select 'mktbd-staging:' || ref from staging_disposable.identity limit 1 $$;
revoke all on function public.staging_identity() from public;
grant execute on function public.staging_identity() to anon, authenticated, service_role;
commit;
