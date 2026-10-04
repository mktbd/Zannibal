import { requireAdmin } from "@/lib/auth/admin";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const metadata = { title: "Case Studies · mktbd admin" };

export default async function AdminCaseStudiesPage() {
  await requireAdmin();

  return (
    <ModulePlaceholder
      title="Case Studies"
      description="Paid, in-depth business case studies sold as PDFs."
      plannedFeatures={[
        "Listing of every Case Study, draft and published",
        "Create, edit, preview, publish, unpublish and delete",
        "Cover image, descriptions, price in BDT, industry and page count",
        "Tagging from the shared tag reservoir",
      ]}
    />
  );
}
