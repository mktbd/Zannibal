import { requireAdmin } from "@/lib/auth/admin";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const metadata = { title: "New Analysis · mktbd admin" };

export default async function AdminNewAnalysisPage() {
  await requireAdmin();

  return (
    <ModulePlaceholder
      title="New Analysis"
      description="The Analysis editor is not available yet."
      plannedFeatures={[
        "Title, slug, publication date and optional LinkedIn URL",
        "Carousel slide upload and ordering",
        "Tags, saved as Draft until published",
      ]}
    />
  );
}
