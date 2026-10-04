import { requireAdmin } from "@/lib/auth/admin";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const metadata = { title: "New Case Study · mktbd admin" };

export default async function AdminNewCaseStudyPage() {
  await requireAdmin();

  return (
    <ModulePlaceholder
      title="New Case Study"
      description="The Case Study editor is not available yet."
      plannedFeatures={[
        "Title, slug, cover image and descriptions",
        "Price in BDT, industry, page count and publication date",
        "Tags, saved as Draft until published",
      ]}
    />
  );
}
