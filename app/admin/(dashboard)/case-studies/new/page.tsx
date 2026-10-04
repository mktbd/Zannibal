import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getTagOptions } from "@/lib/data/admin/content";
import { todayInDhaka } from "@/lib/validation";
import { PageHeader } from "@/components/admin/page-header";
import { linkButton } from "@/components/admin/ui";
import { CaseStudyEditor } from "../case-study-editor";

export const metadata = { title: "New Case Study · mktbd admin" };

export default async function AdminNewCaseStudyPage() {
  await requireAdmin();
  const allTags = await getTagOptions();

  return (
    <>
      <PageHeader
        title="New Case Study"
        description="Start with the details and save a draft; the cover image is added next."
        actions={
          <Link href="/admin/case-studies" className={linkButton}>
            Back to Case Studies
          </Link>
        }
      />
      <CaseStudyEditor
        allTags={allTags}
        values={{
          id: null,
          title: "",
          slug: "",
          coverImagePath: null,
          shortDescription: "",
          productDescription: "",
          priceBdt: "",
          industry: "",
          pageCount: "",
          publicationDate: todayInDhaka(),
          status: "draft",
          tagIds: [],
        }}
      />
    </>
  );
}
