import "server-only";
import { createClient } from "@/lib/supabase/server";
import { type StatusFilter } from "@/components/admin/list-filters";
import { likePattern } from "@/lib/search";
import type { ContentStatus } from "@/lib/types/content";
import type { TagOption } from "@/components/admin/tag-selector";

/**
 * Admin-side reads for Analysis, Articles and Case Studies. All use the admin's own
 * session, so drafts are visible only because RLS (is_admin()) allows it
 * for this user -- nothing here widens public access.
 */

function fail(what: string, message: string): never {
  throw new Error(`Could not load ${what}: ${message}`);
}

type TagLinkRow = { tags: { id: string; name: string } | null };

function tagNames(links: TagLinkRow[]): string[] {
  return links
    .map((link) => link.tags?.name)
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

type LinkRow = { article_id: string; read_article_enabled: boolean };

// analysis_article_links is keyed by analysis_id and UNIQUE on article_id,
// so PostgREST embeds it as a single object from either side; tolerate the
// array form too.
function one<T>(raw: T | T[] | null | undefined): T | null {
  return Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
}

function tagIds(links: TagLinkRow[]): string[] {
  return links.map((link) => link.tags?.id).filter((id): id is string => !!id);
}

export async function getTagOptions(): Promise<TagOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tags")
    .select("id, name")
    .order("normalized_name")
    .overrideTypes<TagOption[], { merge: false }>();
  if (error) fail("tags", error.message);
  return data;
}

// ---------------------------------------------------------------- Analysis

export interface AnalysisListItem {
  id: string;
  title: string;
  slug: string;
  publicationDate: string;
  status: ContentStatus;
  slideCount: number;
  tags: string[];
}

export async function listAnalyses(filter: { query: string; status: StatusFilter }): Promise<AnalysisListItem[]> {
  const supabase = await createClient();
  let request = supabase
    .from("analyses")
    .select("id, title, slug, publication_date, status, analysis_slides(count), analysis_tags(tags(id, name))")
    .order("publication_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (filter.query) request = request.ilike("title", likePattern(filter.query));
  if (filter.status !== "all") request = request.eq("status", filter.status);

  const { data, error } = await request.overrideTypes<
    {
      id: string;
      title: string;
      slug: string;
      publication_date: string;
      status: ContentStatus;
      analysis_slides: { count: number }[];
      analysis_tags: TagLinkRow[];
    }[],
    { merge: false }
  >();
  if (error) fail("analyses", error.message);

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    publicationDate: row.publication_date,
    status: row.status,
    slideCount: row.analysis_slides[0]?.count ?? 0,
    tags: tagNames(row.analysis_tags),
  }));
}

export interface AnalysisForEdit {
  id: string;
  title: string;
  slug: string;
  publicationDate: string;
  linkedinUrl: string | null;
  status: ContentStatus;
  updatedAt: string;
  /** The accompanying Article (kept even while the toggle is off). */
  linkedArticleId: string | null;
  readArticleEnabled: boolean;
  slides: { id: string; storagePath: string; position: number }[];
  tagIds: string[];
  tags: string[];
}

export async function getAnalysis(id: string): Promise<AnalysisForEdit | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analyses")
    .select(
      "id, title, slug, publication_date, linkedin_url, status, updated_at, analysis_article_links(article_id, read_article_enabled), analysis_slides(id, storage_path, position), analysis_tags(tags(id, name))",
    )
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<
      {
        id: string;
        title: string;
        slug: string;
        publication_date: string;
        linkedin_url: string | null;
        status: ContentStatus;
        updated_at: string;
        analysis_article_links: LinkRow | LinkRow[] | null;
        analysis_slides: { id: string; storage_path: string; position: number }[];
        analysis_tags: TagLinkRow[];
      } | null,
      { merge: false }
    >();
  if (error) fail("the analysis", error.message);
  if (!data) return null;

  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
    publicationDate: data.publication_date,
    linkedinUrl: data.linkedin_url,
    status: data.status,
    updatedAt: data.updated_at,
    linkedArticleId: one(data.analysis_article_links)?.article_id ?? null,
    readArticleEnabled: one(data.analysis_article_links)?.read_article_enabled ?? false,
    slides: [...data.analysis_slides]
      .sort((a, b) => a.position - b.position)
      .map((slide) => ({ id: slide.id, storagePath: slide.storage_path, position: slide.position })),
    tagIds: tagIds(data.analysis_tags),
    tags: tagNames(data.analysis_tags),
  };
}

// ---------------------------------------------------------------- Articles

/** The Analysis that links to an Article (the link lives on analyses). */
export interface LinkedAnalysis {
  id: string;
  title: string;
  status: ContentStatus;
  readArticleEnabled: boolean;
}

type LinkedAnalysisRow = {
  read_article_enabled: boolean;
  analyses: { id: string; title: string; status: ContentStatus } | null;
};

function linkedAnalysis(raw: LinkedAnalysisRow | LinkedAnalysisRow[] | null): LinkedAnalysis | null {
  const link = one(raw);
  const analysis = link ? one(link.analyses) : null;
  return link && analysis
    ? { id: analysis.id, title: analysis.title, status: analysis.status, readArticleEnabled: link.read_article_enabled }
    : null;
}

// The Analysis an Article belongs to, through the one-to-one link row.
const LINKED_ANALYSIS_EMBED = "analysis_article_links(read_article_enabled, analyses(id, title, status))";

export interface ArticleListItem {
  id: string;
  title: string;
  slug: string;
  publicationDate: string;
  status: ContentStatus;
  hasCover: boolean;
  tags: string[];
  linkedAnalysis: LinkedAnalysis | null;
}

export async function listArticles(filter: { query: string; status: StatusFilter }): Promise<ArticleListItem[]> {
  const supabase = await createClient();
  let request = supabase
    .from("articles")
    .select(`id, title, slug, publication_date, status, cover_image_path, article_tags(tags(id, name)), ${LINKED_ANALYSIS_EMBED}`)
    .order("publication_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (filter.query) request = request.ilike("title", likePattern(filter.query));
  if (filter.status !== "all") request = request.eq("status", filter.status);

  const { data, error } = await request.overrideTypes<
    {
      id: string;
      title: string;
      slug: string;
      publication_date: string;
      status: ContentStatus;
      cover_image_path: string | null;
      article_tags: TagLinkRow[];
      analysis_article_links: LinkedAnalysisRow | LinkedAnalysisRow[] | null;
    }[],
    { merge: false }
  >();
  if (error) fail("articles", error.message);

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    publicationDate: row.publication_date,
    status: row.status,
    hasCover: row.cover_image_path !== null,
    tags: tagNames(row.article_tags),
    linkedAnalysis: linkedAnalysis(row.analysis_article_links),
  }));
}

export interface ArticleForEdit {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  coverImagePath: string | null;
  /** Raw stored JSON; re-validated (readStoredArticleBody) before use. */
  body: unknown;
  publicationDate: string;
  status: ContentStatus;
  updatedAt: string;
  tagIds: string[];
  tags: string[];
  linkedAnalysis: LinkedAnalysis | null;
}

export async function getArticle(id: string): Promise<ArticleForEdit | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select(
      `id, title, slug, short_description, cover_image_path, body, publication_date, status, updated_at, article_tags(tags(id, name)), ${LINKED_ANALYSIS_EMBED}`,
    )
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<
      {
        id: string;
        title: string;
        slug: string;
        short_description: string | null;
        cover_image_path: string | null;
        body: unknown;
        publication_date: string;
        status: ContentStatus;
        updated_at: string;
        article_tags: TagLinkRow[];
        analysis_article_links: LinkedAnalysisRow | LinkedAnalysisRow[] | null;
      } | null,
      { merge: false }
    >();
  if (error) fail("the article", error.message);
  if (!data) return null;

  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
    shortDescription: data.short_description,
    coverImagePath: data.cover_image_path,
    body: data.body,
    publicationDate: data.publication_date,
    status: data.status,
    updatedAt: data.updated_at,
    tagIds: tagIds(data.article_tags),
    tags: tagNames(data.article_tags),
    linkedAnalysis: linkedAnalysis(data.analysis_article_links),
  };
}

export interface ArticleOption {
  id: string;
  title: string;
  status: ContentStatus;
  /** The Analysis already linked to this Article, if any. */
  linkedAnalysisId: string | null;
  linkedAnalysisTitle: string | null;
}

/** Every Article (drafts included) for the Analysis editor's selector. */
export async function listArticleOptions(): Promise<ArticleOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select(`id, title, status, ${LINKED_ANALYSIS_EMBED}`)
    .order("publication_date", { ascending: false })
    .order("created_at", { ascending: false })
    .overrideTypes<
      { id: string; title: string; status: ContentStatus; analysis_article_links: LinkedAnalysisRow | LinkedAnalysisRow[] | null }[],
      { merge: false }
    >();
  if (error) fail("articles", error.message);
  return data.map((row) => {
    const linked = linkedAnalysis(row.analysis_article_links);
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      linkedAnalysisId: linked?.id ?? null,
      linkedAnalysisTitle: linked?.title ?? null,
    };
  });
}

// ------------------------------------------------------------ Case Studies

export interface CaseStudyListItem {
  id: string;
  title: string;
  slug: string;
  publicationDate: string;
  status: ContentStatus;
  priceBdt: number;
  industry: string | null;
  tags: string[];
}

export async function listCaseStudies(filter: { query: string; status: StatusFilter }): Promise<CaseStudyListItem[]> {
  const supabase = await createClient();
  let request = supabase
    .from("case_studies")
    .select("id, title, slug, publication_date, status, price_bdt, industry, case_study_tags(tags(id, name))")
    .order("publication_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (filter.query) request = request.ilike("title", likePattern(filter.query));
  if (filter.status !== "all") request = request.eq("status", filter.status);

  const { data, error } = await request.overrideTypes<
    {
      id: string;
      title: string;
      slug: string;
      publication_date: string;
      status: ContentStatus;
      price_bdt: number | string;
      industry: string | null;
      case_study_tags: TagLinkRow[];
    }[],
    { merge: false }
  >();
  if (error) fail("case studies", error.message);

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    publicationDate: row.publication_date,
    status: row.status,
    priceBdt: Number(row.price_bdt),
    industry: row.industry,
    tags: tagNames(row.case_study_tags),
  }));
}

export interface CaseStudyForEdit {
  id: string;
  title: string;
  slug: string;
  coverImagePath: string | null;
  shortDescription: string | null;
  productDescription: string | null;
  priceBdt: number;
  industry: string | null;
  pageCount: number | null;
  publicationDate: string;
  format: "PDF";
  status: ContentStatus;
  updatedAt: string;
  tagIds: string[];
  tags: string[];
  /** Orders that reference this Case Study (kept, with snapshots, on delete). */
  orderCount: number;
}

export async function getCaseStudy(id: string): Promise<CaseStudyForEdit | null> {
  const supabase = await createClient();
  const [{ data, error }, orders] = await Promise.all([
    supabase
      .from("case_studies")
      .select(
        "id, title, slug, cover_image_path, short_description, product_description, price_bdt, industry, page_count, publication_date, format, status, updated_at, case_study_tags(tags(id, name))",
      )
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<
        {
          id: string;
          title: string;
          slug: string;
          cover_image_path: string | null;
          short_description: string | null;
          product_description: string | null;
          price_bdt: number | string;
          industry: string | null;
          page_count: number | null;
          publication_date: string;
          format: "PDF";
          status: ContentStatus;
          updated_at: string;
          case_study_tags: TagLinkRow[];
        } | null,
        { merge: false }
      >(),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("case_study_id", id),
  ]);
  if (error) fail("the case study", error.message);
  if (orders.error) fail("orders for the case study", orders.error.message);
  if (!data) return null;

  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
    coverImagePath: data.cover_image_path,
    shortDescription: data.short_description,
    productDescription: data.product_description,
    priceBdt: Number(data.price_bdt),
    industry: data.industry,
    pageCount: data.page_count,
    publicationDate: data.publication_date,
    format: data.format,
    status: data.status,
    updatedAt: data.updated_at,
    tagIds: tagIds(data.case_study_tags),
    tags: tagNames(data.case_study_tags),
    orderCount: orders.count ?? 0,
  };
}
