import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getCaseStudy } from "@/lib/data/admin/content";
import { mediaPublicUrl } from "@/lib/media";
import { formatBdt, formatDate } from "@/lib/format";
import { UUID_PATTERN } from "@/lib/validation";
import { StatusBadge } from "@/components/admin/status-badge";
import { linkButton } from "@/components/admin/ui";

export const metadata = { title: "Preview Case Study · mktbd admin" };

function Missing({ children }: { children: React.ReactNode }) {
  return <span className="italic text-muted">{children}</span>;
}

/**
 * Admin-only approximation of the future /case-studies/[slug] page. Reads
 * through the admin's session (drafts visible to admins only). No purchase
 * flow -- the button is inert.
 */
export default async function AdminCaseStudyPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const caseStudy = await getCaseStudy(id);
  if (!caseStudy) notFound();

  const paragraphs = (caseStudy.productDescription ?? "").split(/\n{2,}/).filter((p) => p.trim() !== "");

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-light-grey pb-3 text-sm">
        <p className="flex items-center gap-2">
          <span className="font-semibold">Preview</span>
          <StatusBadge status={caseStudy.status} />
          {caseStudy.status === "draft" ? <span className="text-muted">Only admins can see this.</span> : null}
        </p>
        <Link href={`/admin/case-studies/${caseStudy.id}/edit`} className={linkButton}>
          Back to editor
        </Link>
      </div>

      <article className="mt-6 bg-white p-5 sm:p-8">
        <div className="grid gap-8 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <div className="flex aspect-[3/4] items-center justify-center bg-off-white">
            {caseStudy.coverImagePath ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin preview of the uploaded cover, uncropped
              <img
                src={mediaPublicUrl(caseStudy.coverImagePath)}
                alt={`Cover of ${caseStudy.title}`}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <Missing>No cover yet</Missing>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">Case Study</p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight">{caseStudy.title}</h1>
            {caseStudy.shortDescription ? (
              <p className="mt-3 text-muted">{caseStudy.shortDescription}</p>
            ) : (
              <p className="mt-3">
                <Missing>No short description yet</Missing>
              </p>
            )}
            <p className="mt-5 text-2xl font-bold tabular-nums">
              {caseStudy.priceBdt > 0 ? formatBdt(caseStudy.priceBdt) : <Missing>No price yet</Missing>}
            </p>
            <span
              aria-disabled="true"
              className="mt-4 inline-flex cursor-not-allowed items-center rounded-sm bg-black px-4 py-2 text-sm font-medium text-white opacity-60"
            >
              Buy Case Study
            </span>
            <p className="mt-1 text-xs text-muted">Purchasing is not part of the preview.</p>

            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-light-grey pt-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted">Industry</dt>
                <dd className="font-medium">{caseStudy.industry ?? <Missing>—</Missing>}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Pages</dt>
                <dd className="font-medium tabular-nums">{caseStudy.pageCount ?? <Missing>—</Missing>}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Published</dt>
                <dd className="font-medium">{formatDate(caseStudy.publicationDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Format</dt>
                <dd className="font-medium">{caseStudy.format}</dd>
              </div>
            </dl>
          </div>
        </div>

        <section aria-labelledby="product-description" className="mt-10 max-w-prose">
          <h2 id="product-description" className="text-lg font-bold">
            Product Description
          </h2>
          {paragraphs.length > 0 ? (
            paragraphs.map((paragraph, index) => (
              <p key={index} className="mt-3 whitespace-pre-line leading-relaxed">
                {paragraph}
              </p>
            ))
          ) : (
            <p className="mt-3">
              <Missing>No product description yet</Missing>
            </p>
          )}
        </section>

        <section aria-labelledby="related-topics" className="mt-8">
          <h2 id="related-topics" className="text-lg font-bold">
            Related Topics
          </h2>
          {caseStudy.tags.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {caseStudy.tags.map((tag) => (
                <li key={tag} className="rounded-sm border border-light-grey px-2 py-0.5 text-sm">
                  {tag}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3">
              <Missing>No tags yet</Missing>
            </p>
          )}
        </section>
      </article>
    </>
  );
}
