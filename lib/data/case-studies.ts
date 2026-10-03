import "server-only";
import { createClient } from "@/lib/supabase/server";
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
