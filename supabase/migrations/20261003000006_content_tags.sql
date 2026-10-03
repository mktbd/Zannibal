-- Join tables linking the shared tag reservoir to Analysis and Case Study
-- content (docs/MKTBD_SPEC.md section 7), plus the tags SELECT policy that
-- depends on them (deferred from 20261003000003_tags.sql until these
-- tables -- and analyses/case_studies -- exist).
--
-- Deletion rule: ON DELETE RESTRICT from these join tables to tags is what
-- actually enforces "a tag attached to content should not be casually
-- deletable" (MKTBD_SPEC.md section 7) -- Postgres refuses the DELETE on
-- public.tags outright while a referencing row exists, with no risk of the
-- rule being forgotten in application code.

create table public.analysis_tags (
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (analysis_id, tag_id)
);

create index analysis_tags_tag_id_idx on public.analysis_tags (tag_id);

create table public.case_study_tags (
  case_study_id uuid not null references public.case_studies (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (case_study_id, tag_id)
);

create index case_study_tags_tag_id_idx on public.case_study_tags (tag_id);

alter table public.analysis_tags enable row level security;
alter table public.case_study_tags enable row level security;

-- Mirrors analyses_select_published_or_admin: a tag-to-analysis link is
-- only publicly visible if the analysis it points to is published, so a
-- public query joining through this table can never surface a draft.
create policy "analysis_tags_select_published_or_admin"
  on public.analysis_tags for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.analyses a
      where a.id = analysis_tags.analysis_id and a.status = 'published'
    )
  );

create policy "analysis_tags_admin_write"
  on public.analysis_tags for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "case_study_tags_select_published_or_admin"
  on public.case_study_tags for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.case_studies cs
      where cs.id = case_study_tags.case_study_id and cs.status = 'published'
    )
  );

create policy "case_study_tags_admin_write"
  on public.case_study_tags for all
  using (public.is_admin())
  with check (public.is_admin());

-- Deferred from 20261003000003_tags.sql: a tag is publicly visible (for
-- search/filter) only if it is attached to at least one published Analysis
-- or Case Study. A tag drafted for not-yet-published content does not leak
-- through the public tag list.
create policy "tags_select_public_or_admin"
  on public.tags for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.analysis_tags at
      join public.analyses a on a.id = at.analysis_id
      where at.tag_id = tags.id and a.status = 'published'
    )
    or exists (
      select 1 from public.case_study_tags cst
      join public.case_studies cs on cs.id = cst.case_study_id
      where cst.tag_id = tags.id and cs.status = 'published'
    )
  );
