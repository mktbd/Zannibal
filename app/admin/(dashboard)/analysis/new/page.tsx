import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getTagOptions } from "@/lib/data/admin/content";
import { todayInDhaka } from "@/lib/validation";
import { PageHeader } from "@/components/admin/page-header";
import { linkButton } from "@/components/admin/ui";
import { AnalysisEditor } from "../analysis-editor";

export const metadata = { title: "New Analysis · mktbd admin" };

export default async function AdminNewAnalysisPage() {
  await requireAdmin();
  const allTags = await getTagOptions();

  return (
    <>
      <PageHeader
        title="New Analysis"
        description="Start with the details and save a draft; slides are added next."
        actions={
          <Link href="/admin/analysis" className={linkButton}>
            Back to Analysis
          </Link>
        }
      />
      <AnalysisEditor
        allTags={allTags}
        values={{
          id: null,
          title: "",
          slug: "",
          publicationDate: todayInDhaka(),
          linkedinUrl: "",
          status: "draft",
          tagIds: [],
          slides: [],
        }}
      />
    </>
  );
}
