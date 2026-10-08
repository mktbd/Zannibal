import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getDashboardCounts } from "@/lib/data/admin/dashboard";
import { PageHeader } from "@/components/admin/page-header";
import { buttonPrimary, buttonSecondary } from "@/components/admin/ui";

export const metadata = { title: "Dashboard · mktbd admin" };

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className="px-4 py-3">
      <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
        {emphasis ? (
          <span aria-hidden="true" className="inline-block size-2 bg-accent-yellow ring-1 ring-black" />
        ) : null}
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function StatGroup({
  id,
  title,
  href,
  linkLabel,
  columns,
  children,
}: {
  id: string;
  title: string;
  href: string;
  linkLabel: string;
  columns: 1 | 3;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="border border-light-grey bg-white">
      <div className="flex items-baseline justify-between border-b border-light-grey px-4 py-2.5">
        <h2 id={`${id}-heading`} className="text-sm font-semibold">
          {title}
        </h2>
        <Link
          href={href}
          className="rounded-sm text-xs font-medium text-muted underline-offset-4 hover:text-black hover:underline"
        >
          {linkLabel}
        </Link>
      </div>
      <dl className={columns === 3 ? "grid grid-cols-3 divide-x divide-light-grey" : undefined}>
        {children}
      </dl>
    </section>
  );
}

export default async function AdminDashboardPage() {
  await requireAdmin();
  const counts = await getDashboardCounts();

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live counts from the content and order database."
        actions={
          <>
            <Link href="/admin/analysis/new" className={buttonPrimary}>
              New Analysis
            </Link>
            <Link href="/admin/articles/new" className={buttonSecondary}>
              New Article
            </Link>
            <Link href="/admin/case-studies/new" className={buttonSecondary}>
              New Case Study
            </Link>
          </>
        }
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <StatGroup id="analysis" title="Analysis" href="/admin/analysis" linkLabel="Open" columns={3}>
          <Stat label="Total" value={counts.analysis.total} />
          <Stat label="Published" value={counts.analysis.published} />
          <Stat label="Draft" value={counts.analysis.draft} />
        </StatGroup>

        <StatGroup id="articles" title="Articles" href="/admin/articles" linkLabel="Open" columns={3}>
          <Stat label="Total" value={counts.articles.total} />
          <Stat label="Published" value={counts.articles.published} />
          <Stat label="Draft" value={counts.articles.draft} />
        </StatGroup>

        <StatGroup id="case-studies" title="Case Studies" href="/admin/case-studies" linkLabel="Open" columns={3}>
          <Stat label="Total" value={counts.caseStudies.total} />
          <Stat label="Published" value={counts.caseStudies.published} />
          <Stat label="Draft" value={counts.caseStudies.draft} />
        </StatGroup>

        <StatGroup id="tags" title="Tags" href="/admin/tags" linkLabel="Manage" columns={1}>
          <Stat label="Total" value={counts.tags} />
        </StatGroup>

        <StatGroup id="orders" title="Orders" href="/admin/orders?status=pending" linkLabel="Review pending" columns={1}>
          <Stat
            label="Pending"
            value={counts.pendingOrders}
            emphasis={counts.pendingOrders > 0}
          />
        </StatGroup>
      </div>

      {counts.analysis.total === 0 && counts.articles.total === 0 && counts.caseStudies.total === 0 ? (
        <p className="mt-6 text-sm text-muted">
          No content has been created yet. Start with a new Analysis, Article
          or Case Study.
        </p>
      ) : null}
    </>
  );
}
