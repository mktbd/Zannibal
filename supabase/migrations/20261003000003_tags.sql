-- Single shared tag reservoir used by both Analysis and Case Studies
-- (docs/MKTBD_SPEC.md section 7).
--
-- Note: the public (anon) SELECT policy for this table is created later, in
-- 20261003000006_content_tags.sql, because it needs to reference
-- analysis_tags/case_study_tags/analyses/case_studies to decide which tags
-- are "attached to published content" -- and those tables don't exist yet
-- at this point in the migration sequence. Until that policy is added, RLS
-- is enabled with admin-only access, i.e. strictly more restrictive, never
-- less.

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  -- Generated (not app-supplied) so normalization is guaranteed regardless
  -- of which client writes the row: lowercased, leading/trailing space
  -- trimmed, internal runs of whitespace collapsed to one space. This is
  -- enough to stop "Growth Strategy" / "growth strategy" / " Growth
  -- Strategy " from becoming separate tags, without merging phrases that
  -- are only superficially similar (e.g. "F&B" vs "Food & Beverage" stay
  -- distinct, as they should).
  normalized_name text generated always as (
    lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_normalized_name_key unique (normalized_name)
);

comment on column public.tags.normalized_name is
  'Generated from name: trimmed, whitespace-collapsed, lowercased. The
   unique constraint on this column is what actually prevents accidental
   duplicate tag variants -- see MKTBD_SPEC.md section 7.';

create trigger tags_set_updated_at
  before update on public.tags
  for each row execute function public.set_updated_at();

alter table public.tags enable row level security;

-- "for all" covers select/insert/update/delete, so this alone gives admins
-- full read access too -- no separate admin select policy needed.
create policy "tags_admin_write"
  on public.tags for all
  using (public.is_admin())
  with check (public.is_admin());
