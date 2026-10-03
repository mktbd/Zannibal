import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Analysis } from "@/lib/types/content";

interface AnalysisRow {
  id: string;
  title: string;
  slug: string;
  publication_date: string;
  linkedin_url: string | null;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
  analysis_slides: { id: string; position: number; storage_path: string }[];
  analysis_tags: {
    tags: { id: string; name: string; normalized_name: string } | null;
  }[];
}

function mapAnalysis(row: AnalysisRow): Analysis {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    publicationDate: row.publication_date,
    linkedinUrl: row.linkedin_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    slides: [...row.analysis_slides]
      .sort((a, b) => a.position - b.position)
      .map((slide) => ({
        id: slide.id,
        position: slide.position,
        storagePath: slide.storage_path,
      })),
    tags: row.analysis_tags
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
 * Fetches a single published Analysis by slug, with its slides and tags.
 * Returns null for a missing OR draft Analysis — callers (e.g. a future
 * /analysis/[slug] page) cannot distinguish "doesn't exist" from "exists
 * but isn't published yet", by design: there is no public-facing
 * draft-by-slug lookup (MKTBD_SPEC.md section 17).
 *
 * The explicit .eq("status", "published") is redundant with RLS (which
 * already hides drafts from the anon/authenticated roles this client
 * uses) but documents the intent directly in the query, and keeps this
 * function correct even if it were ever called with a different client.
 */
export async function getPublishedAnalysisBySlug(
  slug: string,
): Promise<Analysis | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("analyses")
    .select(
      `
      id, title, slug, publication_date, linkedin_url, status, created_at, updated_at,
      analysis_slides ( id, position, storage_path ),
      analysis_tags ( tags ( id, name, normalized_name ) )
    `,
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle<AnalysisRow>();

  if (error || !data) {
    return null;
  }

  return mapAnalysis(data);
}
