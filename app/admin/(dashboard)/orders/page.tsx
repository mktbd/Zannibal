import { requireAdmin } from "@/lib/auth/admin";
import { ModulePlaceholder } from "@/components/admin/module-placeholder";

export const metadata = { title: "Orders · mktbd admin" };

export default async function AdminOrdersPage() {
  await requireAdmin();

  return (
    <ModulePlaceholder
      title="Orders"
      description="Manual bKash purchase records for Case Studies."
      plannedFeatures={[
        "Listing of submitted orders with their snapshotted title and price",
        "Order details: customer, bKash number and transaction number",
        "Status review: Pending, Fulfilled or Invalid",
      ]}
    />
  );
}
