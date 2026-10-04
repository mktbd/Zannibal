import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getAnalysis } from "@/lib/data/admin/content";
import { mediaPublicUrl } from "@/lib/media";
import { formatDate } from "@/lib/format";
import { UUID_PATTERN } from "@/lib/validation";
import { StatusBadge } from "@/components/admin/status-badge";
import { PreviewCarousel } from "@/components/admin/preview-carousel";
import { linkButton } from "@/components/admin/ui";

export const metadata = { title: "Preview Analysis · mktbd admin" };

/**
 * Admin-only preview. Reads through the admin's session (RLS lets admins
 * see drafts); nothing about public access changes.
 */
export default async function AdminAnalysisPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const analysis = await getAnalysis(id);
  if (!analysis) notFound();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-light-grey pb-3 text-sm">
        <p className="flex items-center gap-2">
          <span className="font-semibold">Preview</span>
          <StatusBadge status={analysis.status} />
          {analysis.status === "draft" ? <span className="text-muted">Only admins can see this.</span> : null}
        </p>
        <Link href={`/admin/analysis/${analysis.id}/edit`} className={linkButton}>
          Back to editor
        </Link>
      </div>

      <article className="mt-6">
        <header className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Analysis</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{analysis.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {formatDate(analysis.publicationDate)}
            {analysis.tags.length > 0 ? ` · ${analysis.tags.join(", ")}` : ""}
          </p>
        </header>
        <PreviewCarousel title={analysis.title} slides={analysis.slides.map((slide) => mediaPublicUrl(slide.storagePath))} />
        {analysis.linkedinUrl ? (
          <p className="mt-3 text-sm">
            <a href={analysis.linkedinUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              View on LinkedIn
            </a>
          </p>
        ) : null}
      </article>
    </>
  );
}
