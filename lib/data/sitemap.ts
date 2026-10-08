import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { mediaPublicUrl } from "@/lib/media";
import { coverSlidePath } from "@/lib/analysis-cover";
import type { SitemapRow } from "@/lib/sitemap-entries";

/**
 * Published rows for the sitemap: slug, updated_at and one image each --
 * three small queries, no bodies or slide lists. Read with the anonymous
 * client, so RLS only returns published content (the status filters repeat
 * that). A failed read throws, so a database blip yields an error response
 * that crawlers retry, never a sitemap that silently drops every page.
 */
export async function getSitemapContent(): Promise<{
  analyses: SitemapRow[];
  articles: SitemapRow[];
  caseStudies: SitemapRow[];
}> {
  const supabase = createPublicClient();
  const cover = (path: string | null) => (path && path.trim() !== "" ? mediaPublicUrl(path) : null);
  const [analyses, articles, caseStudies] = await Promise.all([
    supabase
      .from("analyses")
      .select("slug, updated_at, analysis_slides(position, storage_path)")
      .eq("status", "published")
      .order("publication_date", { ascending: false })
      .order("slug", { ascending: true })
      .order("position", { referencedTable: "analysis_slides", ascending: true })
      .limit(1, { referencedTable: "analysis_slides" })
      .overrideTypes<{ slug: string; updated_at: string; analysis_slides: { position: number; storage_path: string }[] | null }[], { merge: false }>(),
    supabase
      .from("articles")
      .select("slug, updated_at, cover_image_path")
      .eq("status", "published")
      .order("publication_date", { ascending: false })
      .order("slug", { ascending: true })
      .overrideTypes<{ slug: string; updated_at: string; cover_image_path: string | null }[], { merge: false }>(),
    supabase
      .from("case_studies")
      .select("slug, updated_at, cover_image_path")
      .eq("status", "published")
      .order("publication_date", { ascending: false })
      .order("slug", { ascending: true })
      .overrideTypes<{ slug: string; updated_at: string; cover_image_path: string | null }[], { merge: false }>(),
  ]);
  const failed = analyses.error ?? articles.error ?? caseStudies.error;
  if (failed) throw new Error(`[sitemap] query failed: ${failed.message}`);
  return {
    analyses: analyses.data!.map((row) => ({ slug: row.slug, updatedAt: row.updated_at, image: cover(coverSlidePath(row.analysis_slides)) })),
    articles: articles.data!.map((row) => ({ slug: row.slug, updatedAt: row.updated_at, image: cover(row.cover_image_path) })),
    caseStudies: caseStudies.data!.map((row) => ({ slug: row.slug, updatedAt: row.updated_at, image: cover(row.cover_image_path) })),
  };
}
