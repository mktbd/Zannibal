import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getAnalysis, getTagOptions, listArticleOptions } from "@/lib/data/admin/content";
import { UUID_PATTERN } from "@/lib/validation";
import { PageHeader } from "@/components/admin/page-header";
import { DeleteSection, SaveNotice } from "@/components/admin/editor-parts";
import { noticeText, problemText } from "@/components/admin/editor-state";
import { linkButton } from "@/components/admin/ui";
import { AnalysisEditor } from "../../analysis-editor";
import { deleteAnalysis } from "../../actions";

export const metadata = { title: "Edit Analysis · mktbd admin" };

export default async function AdminEditAnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; problem?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const [analysis, allTags, articleOptions, query] = await Promise.all([
    getAnalysis(id),
    getTagOptions(),
    listArticleOptions(),
    searchParams,
  ]);
  if (!analysis) notFound();

  return (
    <>
      <PageHeader
        title={analysis.title}
        description="Edit Analysis"
        actions={
          <Link href="/admin/analysis" className={linkButton}>
            Back to Analysis
          </Link>
        }
      />
      <SaveNotice notice={noticeText(query.notice)} problem={problemText(query.problem)} />
      {/* Keyed on updated_at: after every save the editor remounts with exactly what was stored. */}
      <AnalysisEditor
        key={analysis.updatedAt}
        allTags={allTags}
        articleOptions={articleOptions}
        values={{
          id: analysis.id,
          title: analysis.title,
          slug: analysis.slug,
          publicationDate: analysis.publicationDate,
          linkedinUrl: analysis.linkedinUrl ?? "",
          status: analysis.status,
          tagIds: analysis.tagIds,
          slides: analysis.slides,
          linkedArticleId: analysis.linkedArticleId,
          readArticleEnabled: analysis.readArticleEnabled,
        }}
      />
      <DeleteSection
        id={analysis.id}
        label="Analysis"
        consequence="Removes the Analysis, its slides and tag links, and its uploaded slide images. Tags and any linked Article are kept."
        action={deleteAnalysis}
      />
    </>
  );
}
