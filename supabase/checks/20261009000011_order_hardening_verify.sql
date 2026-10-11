-- Read-only post-apply verification for migration 20261009000011_order_hardening.sql.
--
-- Checks the database catalog only -- Postgres system catalogs, privilege
-- functions and the migration-history table. It never reads a row of
-- public.orders (or any other customer or content table) and returns one
-- row of named booleans, nothing else. Every value must be true; the
-- workflow's "verify" mode fails the job otherwise.
--
-- One SELECT statement: it cannot modify anything. Run by the "verify" mode
-- of .github/workflows/supabase-migrate.yml (separate approval). The file
-- must match the SHA-256 pinned in the workflow.
with
order_columns as (
  select a.attname
  from pg_attribute a
  where a.attrelid = to_regclass('public.orders') and a.attnum > 0 and not a.attisdropped
),
public_tables as (
  select c.relname, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
app_policies as (
  select schemaname, tablename, policyname, cmd, permissive, roles::text as roles,
         coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
  from pg_policies
  where schemaname = 'public' or (schemaname = 'storage' and tablename = 'objects' and policyname like 'editorial%')
),
rate_fn as (
  select p.oid, p.prosecdef, p.proconfig, p.proacl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'consume_order_rate_limit'
    and pg_get_function_identity_arguments(p.oid) = 'p_client text, p_client_limit integer, p_global_limit integer, p_window_seconds integer'
)
select
  -- Migration history
  (select count(*) = 1 from supabase_migrations.schema_migrations where version = '20261009000011')
    as migration_11_recorded,

  -- Normalised Transaction ID uniqueness
  (select coalesce(bool_and(i.indisunique and i.indisvalid and i.indisready), false)
     from pg_index i where i.indexrelid = to_regclass('public.orders_bkash_transaction_number_key'))
    as transaction_index_unique_valid,
  (coalesce(pg_get_indexdef(to_regclass('public.orders_bkash_transaction_number_key')), '')
     = 'CREATE UNIQUE INDEX orders_bkash_transaction_number_key ON public.orders USING btree (upper(btrim(bkash_transaction_number)))')
    as transaction_index_normalised,

  -- Order-field length constraints (all four present and validated)
  (select count(*) = 4 from pg_constraint
     where conrelid = to_regclass('public.orders') and contype = 'c' and convalidated
       and conname in ('orders_customer_name_length', 'orders_customer_email_length',
                       'orders_bkash_number_length', 'orders_bkash_transaction_number_length'))
    as order_length_constraints_validated,

  -- Column-level UPDATE: signed-in users may update status only; anon nothing
  (has_column_privilege('authenticated', 'public.orders', 'status', 'UPDATE')
     and not has_table_privilege('authenticated', 'public.orders', 'UPDATE')
     and (select count(*) = 1 from order_columns where has_column_privilege('authenticated', 'public.orders', attname, 'UPDATE'))
     and not has_any_column_privilege('anon', 'public.orders', 'UPDATE'))
    as orders_update_status_only,

  -- Revoked table privileges for anon/authenticated; admin reads still possible
  (not has_table_privilege('anon', 'public.orders', 'INSERT')
     and not has_table_privilege('anon', 'public.orders', 'DELETE')
     and not has_table_privilege('anon', 'public.orders', 'TRUNCATE')
     and not has_table_privilege('anon', 'public.orders', 'REFERENCES')
     and not has_table_privilege('anon', 'public.orders', 'TRIGGER')
     and not has_table_privilege('authenticated', 'public.orders', 'INSERT')
     and not has_table_privilege('authenticated', 'public.orders', 'DELETE')
     and not has_table_privilege('authenticated', 'public.orders', 'TRUNCATE')
     and not has_table_privilege('authenticated', 'public.orders', 'REFERENCES')
     and not has_table_privilege('authenticated', 'public.orders', 'TRIGGER'))
    as orders_write_privileges_revoked,
  has_table_privilege('authenticated', 'public.orders', 'SELECT')
    as orders_admin_read_privilege_kept,

  -- Rate-limit table: present, RLS on, no policies, no client privileges
  (to_regclass('public.order_rate_limits') is not null)
    as rate_limit_table_present,
  (select coalesce(bool_and(relrowsecurity), false) from public_tables where relname = 'order_rate_limits')
    as rate_limit_table_rls_enabled,
  (select count(*) = 0 from pg_policies where schemaname = 'public' and tablename = 'order_rate_limits')
    as rate_limit_table_no_policies,
  (to_regclass('public.order_rate_limits') is not null
     and not has_table_privilege('anon', 'public.order_rate_limits', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
     and not has_table_privilege('authenticated', 'public.order_rate_limits', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
     and not has_table_privilege('service_role', 'public.order_rate_limits', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE'))
    as rate_limit_table_no_client_privileges,

  -- Rate-limit function: present, SECURITY DEFINER, empty search_path, service role only
  (select count(*) = 1 from rate_fn)
    as rate_limit_function_present,
  (select coalesce(bool_and(prosecdef and proconfig @> array['search_path=""']), false) from rate_fn)
    as rate_limit_function_definer_empty_path,
  (select coalesce(bool_and(
       has_function_privilege('service_role', oid, 'EXECUTE')
       and not has_function_privilege('anon', oid, 'EXECUTE')
       and not has_function_privilege('authenticated', oid, 'EXECUTE')
       and not exists (select 1 from aclexplode(proacl) a where a.grantee = 0)), false) from rate_fn)
    as rate_limit_function_service_role_only,

  -- RLS on every application table (the twelve expected ones, and no other)
  ((select string_agg(relname, ',' order by relname) from public_tables)
     = 'analyses,analysis_article_links,analysis_slides,analysis_tags,article_tags,articles,case_studies,case_study_tags,order_rate_limits,orders,profiles,tags')
    as public_tables_expected,
  (select bool_and(relrowsecurity) from public_tables)
    as rls_enabled_on_all_public_tables,

  -- Expected policies (public schema + editorial-media Storage): names, then full definitions
  ((select string_agg(schemaname || '.' || tablename || ':' || policyname, ',' order by schemaname, tablename, policyname) from app_policies)
     = 'public.analyses:analyses_admin_write,public.analyses:analyses_select_published_or_admin,'
       || 'public.analysis_article_links:analysis_article_links_admin_write,public.analysis_article_links:analysis_article_links_select_public_or_admin,'
       || 'public.analysis_slides:analysis_slides_admin_write,public.analysis_slides:analysis_slides_select_published_or_admin,'
       || 'public.analysis_tags:analysis_tags_admin_write,public.analysis_tags:analysis_tags_select_published_or_admin,'
       || 'public.article_tags:article_tags_admin_write,public.article_tags:article_tags_select_published_or_admin,'
       || 'public.articles:articles_admin_write,public.articles:articles_select_published_or_admin,'
       || 'public.case_studies:case_studies_admin_write,public.case_studies:case_studies_select_published_or_admin,'
       || 'public.case_study_tags:case_study_tags_admin_write,public.case_study_tags:case_study_tags_select_published_or_admin,'
       || 'public.orders:orders_select_admin,public.orders:orders_update_admin,'
       || 'public.profiles:profiles_select_self_or_admin,'
       || 'public.tags:tags_admin_write,public.tags:tags_select_public_or_admin,'
       || 'storage.objects:editorial_media_admin_delete,storage.objects:editorial_media_admin_insert,'
       || 'storage.objects:editorial_media_admin_select,storage.objects:editorial_media_admin_update')
    as policy_names_expected,
  ((select md5(string_agg(concat_ws('|', schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check), E'\n'
                order by schemaname, tablename, policyname)) from app_policies)
     = 'fc3e863995a9ab724ec6c531e786ebc0')
    as policy_definitions_expected;
