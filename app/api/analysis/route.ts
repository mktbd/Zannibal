import { getArchiveIndex } from "@/lib/data/analysis";
import { archivePage, parseFeedParams } from "@/lib/analysis-archive";

// Always answered from the live published index (search and paging must
// reflect the CMS at once); nothing here is cached between requests.
export const dynamic = "force-dynamic";

/**
 * Public archive feed: GET /api/analysis?q=&topic=&offset=
 *
 * Searches and filters the whole published archive on the server (same
 * normalization as everywhere else) and returns one batch of cards plus
 * the total match count. Only card data leaves the server -- no tags, no
 * slide lists. Malformed parameters fall back to safe defaults.
 */
export async function GET(request: Request) {
  const params = parseFeedParams(new URL(request.url).searchParams);
  const index = await getArchiveIndex();
  if (!index.ok) {
    return Response.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(archivePage(index.entries, params), { headers: { "Cache-Control": "no-store" } });
}
