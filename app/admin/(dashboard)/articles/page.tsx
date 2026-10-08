import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { listArticles } from "@/lib/data/admin/content";
import { PageHeader } from "@/components/admin/page-header";
import { ListFilters, parseStatusFilter } from "@/components/admin/list-filters";
import { StatusBadge } from "@/components/admin/status-badge";
import { SaveNotice } from "@/components/admin/editor-parts";
import { noticeText, problemText } from "@/components/admin/editor-state";
import { buttonPrimary } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Articles · mktbd admin" };

export default async function AdminArticlesListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; notice?: string; problem?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 200);
  const status = parseStatusFilter(params.status);
  const articles = await listArticles({ query, status });
  const filtered = query !== "" || status !== "all";

  return (
    <>
      <PageHeader
        title="Articles"
        description="Free written business analysis, optionally paired with an Analysis."
        actions={
          <Link href="/admin/articles/new" className={buttonPrimary}>
            New Article
          </Link>
        }
      />
      <SaveNotice notice={noticeText(params.notice)} problem={problemText(params.problem)} />

      <div className="mt-6">
        <ListFilters basePath="/admin/articles" query={query} status={status} label="Articles" />
      </div>

      <section aria-labelledby="articles-list-heading" className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="articles-list-heading" className="text-sm font-semibold">
            {filtered ? "Matching Articles" : "All Articles"}
          </h2>
          <p className="text-xs text-muted">{articles.length} shown</p>
        </div>

        {articles.length === 0 ? (
          <div className="border border-dashed border-light-grey bg-white px-5 py-10 text-center">
            <p className="text-sm font-medium">{filtered ? "No Articles match these filters" : "No Articles yet"}</p>
            <p className="mt-1 text-sm text-muted">
              {filtered ? "Change the search or status filter." : "Create the first one with New Article."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-light-grey border border-light-grey bg-white">
            {articles.map((article) => (
              <li key={article.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/articles/${article.id}/edit`}
                      className="rounded-sm font-medium underline-offset-4 hover:underline"
                    >
                      {article.title}
                    </Link>
                    <StatusBadge status={article.status} />
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDate(article.publicationDate)}
                    {article.hasCover ? "" : " · No cover"}
                    {article.linkedAnalysis ? ` · Linked to “${article.linkedAnalysis.title}”` : ""}
                    {article.tags.length > 0 ? ` · ${article.tags.join(", ")}` : ""}
                  </p>
                </div>
                <Link
                  href={`/admin/articles/${article.id}/edit`}
                  className="self-start rounded-sm text-sm font-medium underline-offset-4 hover:underline sm:self-center"
                  aria-label={`Edit ${article.title}`}
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
