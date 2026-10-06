import { getCaseStudyIndex } from "@/lib/data/case-studies";
import { parseFeedParams } from "@/lib/archive-core";
import { caseStudyPage } from "@/lib/case-study-archive";

// Always answered from the live published index (search and paging must
// reflect the CMS at once); nothing here is cached between requests.
export const dynamic = "force-dynamic";

/**
 * Public catalogue feed: GET /api/case-studies?q=&topic=&offset=
 *
 * Searches (title, short description, topic names) and filters the whole
 * published catalogue on the server and returns one batch of 12 list items
 * plus the total match count. Read-only; no order, customer or PDF data.
 * Malformed parameters fall back to safe defaults.
 */
export async function GET(request: Request) {
  const params = parseFeedParams(new URL(request.url).searchParams);
  const index = await getCaseStudyIndex();
  if (!index.ok) {
    return Response.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(caseStudyPage(index.entries, params), { headers: { "Cache-Control": "no-store" } });
}
