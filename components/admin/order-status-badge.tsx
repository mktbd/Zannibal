import { ORDER_STATUS_LABELS } from "@/lib/orders";
import type { OrderStatus } from "@/lib/types/content";

/**
 * Pending is the work-queue signal and carries the single yellow accent
 * (as on the Dashboard); Fulfilled is neutral; Invalid is muted.
 */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border border-black px-1.5 py-0.5 text-xs font-semibold">
        <span aria-hidden="true" className="inline-block size-2 bg-accent-yellow ring-1 ring-black" />
        {ORDER_STATUS_LABELS.pending}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-xs font-medium ${
        status === "fulfilled" ? "border-black text-black" : "border-light-grey text-muted"
      }`}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
