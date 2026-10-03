-- Case Study content model (docs/MKTBD_SPEC.md sections 6 and 8). Tag
-- relationships are added later, in 20261003000006_content_tags.sql.
--
-- Fields the Admin UI will typically fill in progressively while a Case
-- Study is still a draft (cover_image_path, descriptions, industry,
-- page_count) are nullable; title/slug/price/status are required from
-- creation.

create table public.case_studies (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> ''),
  slug text not null,
  cover_image_path text,
  short_description text,
  product_description text,
  price_bdt numeric(10, 2) not null default 0 check (price_bdt >= 0),
  industry text,
  page_count integer check (page_count is null or page_count > 0),
  publication_date date not null default current_date,
  -- PDF is the only V1 format (MKTBD_SPEC.md section 6). A plain CHECK
  -- rather than an enum type: extending an allowed-values list later is a
  -- one-line constraint change, no ALTER TYPE ADD VALUE transaction
  -- restrictions to work around.
  format text not null default 'PDF' check (format = 'PDF'),
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_studies_slug_key unique (slug),
  constraint case_studies_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index case_studies_status_idx on public.case_studies (status);

create trigger case_studies_set_updated_at
  before update on public.case_studies
  for each row execute function public.set_updated_at();

alter table public.case_studies enable row level security;

create policy "case_studies_select_published_or_admin"
  on public.case_studies for select
  using (status = 'published' or public.is_admin());

create policy "case_studies_admin_write"
  on public.case_studies for all
  using (public.is_admin())
  with check (public.is_admin());
