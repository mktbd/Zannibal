import { getPublishedAnalysisViewer } from "@/lib/data/analysis";

export const dynamic = "force-dynamic";

/**
 * Ordered slides for one published Analysis: GET /api/analysis/[slug]
 *
 * Fetched by the archive when a card opens the viewer, so list responses
 * never carry slide lists. Unknown and unpublished slugs are the same 404.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let analysis;
  try {
    analysis = await getPublishedAnalysisViewer(slug);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!analysis) {
    return Response.json({ error: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(analysis, { headers: { "Cache-Control": "no-store" } });
}
