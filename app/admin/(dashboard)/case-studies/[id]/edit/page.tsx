import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getCaseStudy, getTagOptions } from "@/lib/data/admin/content";
import { UUID_PATTERN } from "@/lib/validation";
import { PageHeader } from "@/components/admin/page-header";
import { DeleteSection, SaveNotice } from "@/components/admin/editor-parts";
import { noticeText, problemText } from "@/components/admin/editor-state";
import { linkButton } from "@/components/admin/ui";
import { CaseStudyEditor } from "../../case-study-editor";
import { deleteCaseStudy } from "../../actions";

export const metadata = { title: "Edit Case Study · mktbd admin" };

export default async function AdminEditCaseStudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; problem?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const [caseStudy, allTags, query] = await Promise.all([getCaseStudy(id), getTagOptions(), searchParams]);
  if (!caseStudy) notFound();

  const orders =
    caseStudy.orderCount === 0
      ? "No orders reference it."
      : `${caseStudy.orderCount} ${caseStudy.orderCount === 1 ? "order references" : "orders reference"} it; ${
          caseStudy.orderCount === 1 ? "that order is" : "those orders are"
        } kept with their recorded title and price.`;

  return (
    <>
      <PageHeader
        title={caseStudy.title}
        description="Edit Case Study"
        actions={
          <Link href="/admin/case-studies" className={linkButton}>
            Back to Case Studies
          </Link>
        }
      />
      <SaveNotice notice={noticeText(query.notice)} problem={problemText(query.problem)} />
      {/* Keyed on updated_at: after every save the editor remounts with exactly what was stored. */}
      <CaseStudyEditor
        key={caseStudy.updatedAt}
        allTags={allTags}
        values={{
          id: caseStudy.id,
          title: caseStudy.title,
          slug: caseStudy.slug,
          coverImagePath: caseStudy.coverImagePath,
          shortDescription: caseStudy.shortDescription ?? "",
          productDescription: caseStudy.productDescription ?? "",
          priceBdt: caseStudy.priceBdt > 0 ? String(caseStudy.priceBdt) : "",
          industry: caseStudy.industry ?? "",
          pageCount: caseStudy.pageCount ? String(caseStudy.pageCount) : "",
          publicationDate: caseStudy.publicationDate,
          status: caseStudy.status,
          tagIds: caseStudy.tagIds,
        }}
      />
      <DeleteSection
        id={caseStudy.id}
        label="Case Study"
        consequence={`Removes the Case Study, its tag links and its cover image. ${orders}`}
        action={deleteCaseStudy}
      />
    </>
  );
}
