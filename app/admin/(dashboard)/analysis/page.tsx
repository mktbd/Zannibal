import { requireAdmin } from "@/lib/auth/admin";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const metadata = { title: "Analysis · mktbd admin" };

export default async function AdminAnalysisPage() {
  await requireAdmin();

  return (
    <ModulePlaceholder
      title="Analysis"
      description="Free visual business analyses, published as multi-slide carousels."
      plannedFeatures={[
        "Listing of every Analysis, draft and published",
        "Create, edit, preview, publish, unpublish and delete",
        "Carousel slide upload with drag-and-drop ordering",
        "Tagging from the shared tag reservoir",
      ]}
    />
  );
}
