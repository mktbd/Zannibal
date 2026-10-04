import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { listAnalyses } from "@/lib/data/admin/content";
import { PageHeader } from "@/components/admin/page-header";
import { ListFilters, parseStatusFilter } from "@/components/admin/list-filters";
import { StatusBadge } from "@/components/admin/status-badge";
import { SaveNotice } from "@/components/admin/editor-parts";
import { noticeText, problemText } from "@/components/admin/editor-state";
import { buttonPrimary } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Analysis · mktbd admin" };

export default async function AdminAnalysisListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; notice?: string; problem?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 200);
  const status = parseStatusFilter(params.status);
  const analyses = await listAnalyses({ query, status });
  const filtered = query !== "" || status !== "all";

  return (
    <>
      <PageHeader
        title="Analysis"
        description="Free visual business analyses, published as multi-slide carousels."
        actions={
          <Link href="/admin/analysis/new" className={buttonPrimary}>
            New Analysis
          </Link>
        }
      />
      <SaveNotice notice={noticeText(params.notice)} problem={problemText(params.problem)} />

      <div className="mt-6">
        <ListFilters basePath="/admin/analysis" query={query} status={status} label="Analysis" />
      </div>

      <section aria-labelledby="analysis-list-heading" className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="analysis-list-heading" className="text-sm font-semibold">
            {filtered ? "Matching Analysis" : "All Analysis"}
          </h2>
          <p className="text-xs text-muted">{analyses.length} shown</p>
        </div>

        {analyses.length === 0 ? (
          <div className="border border-dashed border-light-grey bg-white px-5 py-10 text-center">
            <p className="text-sm font-medium">{filtered ? "No Analysis matches these filters" : "No Analysis yet"}</p>
            <p className="mt-1 text-sm text-muted">
              {filtered ? "Change the search or status filter." : "Create the first one with New Analysis."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-light-grey border border-light-grey bg-white">
            {analyses.map((analysis) => (
              <li key={analysis.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/analysis/${analysis.id}/edit`}
                      className="rounded-sm font-medium underline-offset-4 hover:underline"
                    >
                      {analysis.title}
                    </Link>
                    <StatusBadge status={analysis.status} />
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDate(analysis.publicationDate)} · {analysis.slideCount}{" "}
                    {analysis.slideCount === 1 ? "slide" : "slides"}
                    {analysis.tags.length > 0 ? ` · ${analysis.tags.join(", ")}` : ""}
                  </p>
                </div>
                <Link
                  href={`/admin/analysis/${analysis.id}/edit`}
                  className="self-start rounded-sm text-sm font-medium underline-offset-4 hover:underline sm:self-center"
                  aria-label={`Edit ${analysis.title}`}
                >
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
