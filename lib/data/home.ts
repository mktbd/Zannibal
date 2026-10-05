import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { coverSlidePath } from "@/lib/analysis-cover";
import { mediaPublicUrl } from "@/lib/media";

export interface LatestAnalysis {
  id: string;
  title: string;
  slug: string;
  /** Public URL of the first slide, or null when it has none. */
  coverUrl: string | null;
}

/**
 * The newest published Analysis for the homepage, newest publication date
 * first (created_at breaks ties), with only the first slide embedded.
 *
 * Reads with the anonymous public client, so RLS already hides drafts; the
 * explicit status filter keeps that true even if this were ever called with
 * another client. On a read error the homepage shows its empty state rather
 * than failing to render.
 */
export async function getLatestAnalyses(limit = 3): Promise<LatestAnalysis[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("id, title, slug, analysis_slides(position, storage_path)")
    .eq("status", "published")
    .order("publication_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("position", { referencedTable: "analysis_slides", ascending: true })
    .limit(1, { referencedTable: "analysis_slides" })
    .limit(limit)
    .overrideTypes<
      { id: string; title: string; slug: string; analysis_slides: { position: number; storage_path: string }[] | null }[],
      { merge: false }
    >();

  if (error) {
    console.error("[home] latest analyses query failed:", error.message);
    return [];
  }

  return data.map((row) => {
    const path = coverSlidePath(row.analysis_slides);
    return { id: row.id, title: row.title, slug: row.slug, coverUrl: path ? mediaPublicUrl(path) : null };
  });
}
