import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { listCaseStudies } from "@/lib/data/admin/content";
import { PageHeader } from "@/components/admin/page-header";
import { ListFilters, parseStatusFilter } from "@/components/admin/list-filters";
import { StatusBadge } from "@/components/admin/status-badge";
import { SaveNotice } from "@/components/admin/editor-parts";
import { noticeText, problemText } from "@/components/admin/editor-state";
import { buttonPrimary } from "@/components/admin/ui";
import { formatBdt, formatDate } from "@/lib/format";

export const metadata = { title: "Case Studies · mktbd admin" };

export default async function AdminCaseStudiesListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; notice?: string; problem?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 200);
  const status = parseStatusFilter(params.status);
  const caseStudies = await listCaseStudies({ query, status });
  const filtered = query !== "" || status !== "all";

  return (
    <>
      <PageHeader
        title="Case Studies"
        description="Paid, in-depth business case studies, sold as PDFs."
        actions={
          <Link href="/admin/case-studies/new" className={buttonPrimary}>
            New Case Study
          </Link>
        }
      />
      <SaveNotice notice={noticeText(params.notice)} problem={problemText(params.problem)} />

      <div className="mt-6">
        <ListFilters basePath="/admin/case-studies" query={query} status={status} label="Case Studies" />
      </div>

      <section aria-labelledby="case-studies-list-heading" className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="case-studies-list-heading" className="text-sm font-semibold">
            {filtered ? "Matching Case Studies" : "All Case Studies"}
          </h2>
          <p className="text-xs text-muted">{caseStudies.length} shown</p>
        </div>

        {caseStudies.length === 0 ? (
          <div className="border border-dashed border-light-grey bg-white px-5 py-10 text-center">
            <p className="text-sm font-medium">
              {filtered ? "No Case Study matches these filters" : "No Case Studies yet"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {filtered ? "Change the search or status filter." : "Create the first one with New Case Study."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-light-grey border border-light-grey bg-white">
            {caseStudies.map((caseStudy) => (
              <li key={caseStudy.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/case-studies/${caseStudy.id}/edit`}
                      className="rounded-sm font-medium underline-offset-4 hover:underline"
                    >
                      {caseStudy.title}
                    </Link>
                    <StatusBadge status={caseStudy.status} />
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDate(caseStudy.publicationDate)} ·{" "}
                    {caseStudy.priceBdt > 0 ? formatBdt(caseStudy.priceBdt) : "No price"} ·{" "}
                    {caseStudy.industry ?? "No industry"}
                    {caseStudy.tags.length > 0 ? ` · ${caseStudy.tags.join(", ")}` : ""}
                  </p>
                </div>
                <Link
                  href={`/admin/case-studies/${caseStudy.id}/edit`}
                  className="self-start rounded-sm text-sm font-medium underline-offset-4 hover:underline sm:self-center"
                  aria-label={`Edit ${caseStudy.title}`}
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
