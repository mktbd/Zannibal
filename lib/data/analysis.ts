import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { mediaPublicUrl } from "@/lib/media";
import { isValidSlug, orderedSlideUrls, toArchiveEntry, type ArchiveEntry, type ArchiveRow } from "@/lib/analysis-archive";
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

export type ArchiveIndexResult = { ok: true; entries: ArchiveEntry[] } | { ok: false; entries: [] };

/**
 * The server-side archive index: every published Analysis with just what a
 * card and search need -- title, slug, tags and the first slide (lowest
 * position; the query embeds only that one slide). Newest publication date
 * first; created_at, then id, break ties so paging is deterministic.
 *
 * Never sent to the browser as a whole: /analysis renders the first batch
 * from it and /api/analysis serves later batches and search/topic results
 * filtered from it. Read with the cookie-less anonymous client, so RLS
 * only returns published analyses, their slides and their tags; the
 * explicit status filter keeps that true with any client. Not cached
 * across requests -- always as fresh as the database -- but cache() shares
 * one read within a request.
 */
export const getArchiveIndex = cache(async (): Promise<ArchiveIndexResult> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("id, title, slug, analysis_slides(position, storage_path), analysis_tags(tags(id, name))")
    .eq("status", "published")
    .order("publication_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .order("position", { referencedTable: "analysis_slides", ascending: true })
    .limit(1, { referencedTable: "analysis_slides" })
    .overrideTypes<ArchiveRow[], { merge: false }>();

  if (error) {
    console.error("[analysis] archive index query failed:", error.message);
    return { ok: false, entries: [] };
  }
  return { ok: true, entries: data.map((row) => toArchiveEntry(row, mediaPublicUrl)) };
});

export interface AnalysisViewerData {
  id: string;
  title: string;
  slug: string;
  /** Every slide's public URL, in position order. */
  slides: string[];
}

/**
 * One published Analysis with its full ordered slide list, for the viewer
 * (direct /analysis/[slug] visits, metadata, and /api/analysis/[slug] when
 * a card is opened in the archive). Null when the slug doesn't exist or
 * isn't published -- the two are indistinguishable by design. Throws on a
 * failed read.
 */
export const getPublishedAnalysisViewer = cache(async (slug: string): Promise<AnalysisViewerData | null> => {
  if (!isValidSlug(slug)) return null;
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("id, title, slug, analysis_slides(position, storage_path)")
    .eq("slug", slug)
    .eq("status", "published")
    .order("position", { referencedTable: "analysis_slides", ascending: true })
    .maybeSingle<Pick<ArchiveRow, "id" | "title" | "slug" | "analysis_slides">>();

  // A failed read is an error, never "not found": a valid shared link must
  // not 404 because the database was briefly unreachable.
  if (error) throw new Error(`[analysis] viewer query failed: ${error.message}`);
  if (!data) return null;
  return { id: data.id, title: data.title, slug: data.slug, slides: orderedSlideUrls(data.analysis_slides, mediaPublicUrl) };
});
