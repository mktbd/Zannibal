import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface TagWithUsage {
  id: string;
  name: string;
  normalizedName: string;
  analysisCount: number;
  caseStudyCount: number;
  totalCount: number;
}

interface TagUsageRow {
  id: string;
  name: string;
  normalized_name: string;
  analysis_tags: { count: number }[];
  case_study_tags: { count: number }[];
}

/**
 * Every tag, alphabetically (case-insensitive, via normalized_name), with
 * how many Analysis and Case Study entries reference it. Uses PostgREST
 * embedded counts over the two join tables in a single query, under the
 * signed-in admin's session -- the counts include drafts because RLS lets
 * an admin see every join row.
 */
export async function getTagsWithUsage(): Promise<TagWithUsage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tags")
    .select(
      "id, name, normalized_name, analysis_tags(count), case_study_tags(count)",
    )
    .order("normalized_name", { ascending: true })
    .overrideTypes<TagUsageRow[], { merge: false }>();

  if (error) {
    throw new Error(`Could not load tags: ${error.message}`);
  }

  return data.map((row) => {
    const analysisCount = row.analysis_tags[0]?.count ?? 0;
    const caseStudyCount = row.case_study_tags[0]?.count ?? 0;
    return {
      id: row.id,
      name: row.name,
      normalizedName: row.normalized_name,
      analysisCount,
      caseStudyCount,
      totalCount: analysisCount + caseStudyCount,
    };
  });
}
