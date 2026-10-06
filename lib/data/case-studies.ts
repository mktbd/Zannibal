import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { mediaPublicUrl } from "@/lib/media";
import { isValidSlug, type ArchiveTag } from "@/lib/archive-core";
import { toCaseStudyEntry, type CaseStudyEntry, type CaseStudyIndexRow } from "@/lib/case-study-archive";
import type { CaseStudy } from "@/lib/types/content";

interface CaseStudyRow {
  id: string;
  title: string;
  slug: string;
  cover_image_path: string | null;
  short_description: string | null;
  product_description: string | null;
  price_bdt: number;
  industry: string | null;
  page_count: number | null;
  publication_date: string;
  format: "PDF";
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
  case_study_tags: {
    tags: { id: string; name: string; normalized_name: string } | null;
  }[];
}

function mapCaseStudy(row: CaseStudyRow): CaseStudy {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    coverImagePath: row.cover_image_path,
    shortDescription: row.short_description,
    productDescription: row.product_description,
    priceBdt: row.price_bdt,
    industry: row.industry,
    pageCount: row.page_count,
    publicationDate: row.publication_date,
    format: row.format,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: row.case_study_tags
      .map((link) => link.tags)
      .filter((tag): tag is NonNullable<typeof tag> => tag !== null)
      .map((tag) => ({
        id: tag.id,
        name: tag.name,
        normalizedName: tag.normalized_name,
      })),
  };
}

/**
 * Fetches a single published Case Study by slug, with its tags. Same
 * draft-hiding contract as getPublishedAnalysisBySlug — see that function's
 * comment.
 */
export async function getPublishedCaseStudyBySlug(
  slug: string,
): Promise<CaseStudy | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("case_studies")
    .select(
      `
      id, title, slug, cover_image_path, short_description, product_description,
      price_bdt, industry, page_count, publication_date, format, status,
      created_at, updated_at,
      case_study_tags ( tags ( id, name, normalized_name ) )
    `,
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle<CaseStudyRow>();

  if (error || !data) {
    return null;
  }

  return mapCaseStudy(data);
}

export type CaseStudyIndexResult = { ok: true; entries: CaseStudyEntry[] } | { ok: false; entries: [] };

/**
 * The server-side catalogue index: every published Case Study with only
 * what a catalogue row and search need (title, slug, cover path, short
 * description, price, publication date, tags) -- no product description,
 * industry or page count. Newest publication date first; created_at, then
 * id, break ties so paging is deterministic.
 *
 * Never sent to the browser whole: /case-studies renders the first batch
 * and /api/case-studies serves later batches and search/topic results.
 * Read with the cookie-less anonymous client, so RLS returns only
 * published Case Studies and their tags (orders are admin-only and never
 * queried); the explicit status filter keeps that true with any client.
 */
export const getCaseStudyIndex = cache(async (): Promise<CaseStudyIndexResult> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("case_studies")
    .select("id, title, slug, cover_image_path, short_description, price_bdt, publication_date, case_study_tags(tags(id, name))")
    .eq("status", "published")
    .order("publication_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .overrideTypes<CaseStudyIndexRow[], { merge: false }>();

  if (error) {
    console.error("[case-studies] catalogue index query failed:", error.message);
    return { ok: false, entries: [] };
  }
  return { ok: true, entries: data.map((row) => toCaseStudyEntry(row, mediaPublicUrl)) };
});

export interface CaseStudyDetail {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  shortDescription: string | null;
  productDescription: string | null;
  priceBdt: number;
  industry: string | null;
  pageCount: number | null;
  publicationDate: string;
  format: "PDF";
  tags: ArchiveTag[];
}

/**
 * One published Case Study for its public product page (and metadata).
 * Null when the slug doesn't exist or isn't published -- the two are
 * indistinguishable by design. Throws on a failed read, so a database
 * outage is an error page rather than a false 404. cache() shares one read
 * between generateMetadata and the page.
 */
export const getPublishedCaseStudy = cache(async (slug: string): Promise<CaseStudyDetail | null> => {
  if (!isValidSlug(slug)) return null;
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("case_studies")
    .select(
      "id, title, slug, cover_image_path, short_description, product_description, price_bdt, industry, page_count, publication_date, format, case_study_tags(tags(id, name))",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle<
      CaseStudyIndexRow & { product_description: string | null; industry: string | null; page_count: number | null; format: "PDF" }
    >();

  if (error) throw new Error(`[case-studies] product query failed: ${error.message}`);
  if (!data) return null;
  const entry = toCaseStudyEntry(data, mediaPublicUrl);
  const text = (value: string | null) => (value && value.trim() !== "" ? value : null);
  return {
    id: entry.id,
    title: entry.title,
    slug: entry.slug,
    coverUrl: entry.coverUrl,
    shortDescription: entry.shortDescription,
    productDescription: text(data.product_description),
    priceBdt: entry.priceBdt,
    industry: text(data.industry),
    pageCount: data.page_count,
    publicationDate: entry.publicationDate,
    format: data.format,
    tags: entry.tags,
  };
});
