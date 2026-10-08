-- Articles: free, written business analysis (docs/MKTBD_SPEC.md section 8,
-- "Articles"), their links to the shared tag reservoir, and the optional
-- one-to-one link from an Analysis to the Article that accompanies it.
--
-- PROPOSED (Stage 5A) -- applied to the local test stack only. Do not push
-- to production until it has been reviewed and approved.
--
-- Design notes
-- - articles mirrors analyses / case_studies: content_status, published-only
--   public reads, admin-only writes, a database-enforced unique URL-safe slug.
-- - body is the article's rich text as a ProseMirror/Tiptap JSON document
--   (never HTML). The database only guarantees it is a JSON object; its
--   allowed structure (node types, marks, link protocols, image paths) is
--   enforced by the server before every write (lib/article-body.ts) and the
--   public renderer never interprets HTML.
-- - Cover and inline images live in the existing editorial-media bucket under
--   articles/{article_id}/ (cover-{uuid}.ext, image-{uuid}.ext); the bucket's
--   admin-only write policies already cover these paths, so Storage policies
--   are unchanged.
-- - The Analysis <-> Article link lives in its own table,
--   analysis_article_links (one row per linked Analysis), not in columns on
--   analyses: any analyses column is readable wherever the Analysis row is
--   public, which would expose a draft Article's id, or a link the editor
--   turned off. A separate table lets RLS decide per link instead:
--     public  -> only links that are switched on AND whose Analysis and
--                Article are both published
--     admin   -> every link (drafts and switched-off links included)
--   analysis_id is the primary key (an Analysis has at most one Article) and
--   article_id is UNIQUE (an Article belongs to at most one Analysis), so the
--   relationship is one-to-one and stored exactly once; an Article finds
--   "its" Analysis through the same row.
-- - read_article_enabled is the editor's toggle. Turning it off keeps the
--   row (the association) but hides it from the public.
-- - Deleting either the Analysis or the Article deletes the link row
--   (ON DELETE CASCADE); the other record is untouched.

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> '' and char_length(title) <= 200),
  slug text not null,
  short_description text check (short_description is null or char_length(short_description) <= 300),
  cover_image_path text check (cover_image_path is null or btrim(cover_image_path) <> ''),
  body jsonb not null default '{"type":"doc","content":[]}'::jsonb
    check (jsonb_typeof(body) = 'object'),
  publication_date date not null default current_date,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint articles_slug_key unique (slug),
  constraint articles_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index articles_status_idx on public.articles (status);
create index articles_publication_date_idx on public.articles (publication_date desc);

create trigger articles_set_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

alter table public.articles enable row level security;

create policy "articles_select_published_or_admin"
  on public.articles for select
  using (status = 'published' or public.is_admin());

create policy "articles_admin_write"
  on public.articles for all
  using (public.is_admin())
  with check (public.is_admin());

-- Tags: same rules as analysis_tags / case_study_tags (cascade from the
-- content row, RESTRICT on the tag so an attached tag can't be deleted).
create table public.article_tags (
  article_id uuid not null references public.articles (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (article_id, tag_id)
);

create index article_tags_tag_id_idx on public.article_tags (tag_id);

alter table public.article_tags enable row level security;

create policy "article_tags_select_published_or_admin"
  on public.article_tags for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.articles ar
      where ar.id = article_tags.article_id and ar.status = 'published'
    )
  );

create policy "article_tags_admin_write"
  on public.article_tags for all
  using (public.is_admin())
  with check (public.is_admin());

-- A tag is publicly visible if it is attached to at least one published
-- Analysis, Case Study or (now) Article. Same definition as
-- 20261003000006_content_tags.sql plus the Article branch.
drop policy if exists "tags_select_public_or_admin" on public.tags;

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
    or exists (
      select 1 from public.article_tags art
      join public.articles ar on ar.id = art.article_id
      where art.tag_id = tags.id and ar.status = 'published'
    )
  );

-- Analysis <-> Article link (one-to-one, see the header).
create table public.analysis_article_links (
  analysis_id uuid primary key references public.analyses (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  read_article_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analysis_article_links_article_id_key unique (article_id)
);

create trigger analysis_article_links_set_updated_at
  before update on public.analysis_article_links
  for each row execute function public.set_updated_at();

alter table public.analysis_article_links enable row level security;

-- Public: a link is visible only when it is switched on and both sides are
-- published (the "Read Article" / "See Visual Story" rule). The status
-- checks are explicit rather than relying on the analyses/articles policies
-- applied inside the subqueries.
create policy "analysis_article_links_select_public_or_admin"
  on public.analysis_article_links for select
  using (
    public.is_admin()
    or (
      read_article_enabled
      and exists (
        select 1 from public.analyses a
        where a.id = analysis_article_links.analysis_id and a.status = 'published'
      )
      and exists (
        select 1 from public.articles ar
        where ar.id = analysis_article_links.article_id and ar.status = 'published'
      )
    )
  );

create policy "analysis_article_links_admin_write"
  on public.analysis_article_links for all
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.analysis_article_links is
  'Optional one-to-one link from an Analysis to the written Article that accompanies it. Publicly readable only when read_article_enabled is true and both records are published.';
