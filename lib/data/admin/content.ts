import "server-only";
import { createClient } from "@/lib/supabase/server";
import { likePattern, type StatusFilter } from "@/components/admin/list-filters";
import type { ContentStatus } from "@/lib/types/content";
import type { TagOption } from "@/components/admin/tag-selector";

/**
 * Admin-side reads for Analysis and Case Studies. All use the admin's own
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
  slides: { id: string; storagePath: string; position: number }[];
  tagIds: string[];
  tags: string[];
}

export async function getAnalysis(id: string): Promise<AnalysisForEdit | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analyses")
    .select(
      "id, title, slug, publication_date, linkedin_url, status, updated_at, analysis_slides(id, storage_path, position), analysis_tags(tags(id, name))",
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
    slides: [...data.analysis_slides]
      .sort((a, b) => a.position - b.position)
      .map((slide) => ({ id: slide.id, storagePath: slide.storage_path, position: slide.position })),
    tagIds: tagIds(data.analysis_tags),
    tags: tagNames(data.analysis_tags),
  };
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
