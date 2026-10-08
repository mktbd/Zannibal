import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface DashboardCounts {
  analysis: { total: number; published: number; draft: number };
  articles: { total: number; published: number; draft: number };
  caseStudies: { total: number; published: number; draft: number };
  tags: number;
  pendingOrders: number;
}

/**
 * Live counts for the Admin Dashboard, read with the signed-in admin's own
 * session (anon key + cookies), so every number is whatever RLS lets that
 * user see -- never the service-role client.
 *
 * Throws if any count fails rather than showing a misleading 0; the
 * (dashboard) error boundary renders the failure.
 */
export async function getDashboardCounts(): Promise<DashboardCounts> {
  const supabase = await createClient();

  const count = async (
    table: "analyses" | "articles" | "case_studies" | "tags" | "orders",
    filter?: { column: "status"; value: string },
  ) => {
    let query = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) {
      query = query.eq(filter.column, filter.value);
    }
    const { count, error } = await query;
    if (error || count === null) {
      throw new Error(
        `Could not count ${table}${filter ? ` (${filter.value})` : ""}: ${error?.message ?? "no count returned"}`,
      );
    }
    return count;
  };

  const [
    analysisTotal,
    analysisPublished,
    analysisDraft,
    articlesTotal,
    articlesPublished,
    articlesDraft,
    caseStudiesTotal,
    caseStudiesPublished,
    caseStudiesDraft,
    tags,
    pendingOrders,
  ] = await Promise.all([
    count("analyses"),
    count("analyses", { column: "status", value: "published" }),
    count("analyses", { column: "status", value: "draft" }),
    count("articles"),
    count("articles", { column: "status", value: "published" }),
    count("articles", { column: "status", value: "draft" }),
    count("case_studies"),
    count("case_studies", { column: "status", value: "published" }),
    count("case_studies", { column: "status", value: "draft" }),
    count("tags"),
    count("orders", { column: "status", value: "pending" }),
  ]);

  return {
    analysis: {
      total: analysisTotal,
      published: analysisPublished,
      draft: analysisDraft,
    },
    articles: {
      total: articlesTotal,
      published: articlesPublished,
      draft: articlesDraft,
    },
    caseStudies: {
      total: caseStudiesTotal,
      published: caseStudiesPublished,
      draft: caseStudiesDraft,
    },
    tags,
    pendingOrders,
  };
}
