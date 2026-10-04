import type { OrderStatus } from "@/lib/types/content";

/**
 * The order_status enum from supabase/migrations/20261003000001_foundations.sql.
 * V1 has exactly these three states; there is deliberately no other.
 */
export const ORDER_STATUSES = ["pending", "fulfilled", "invalid"] as const satisfies readonly OrderStatus[];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  fulfilled: "Fulfilled",
  invalid: "Invalid",
};

export const ORDER_STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  pending: "Payment submitted; needs manual verification.",
  fulfilled: "Payment accepted and the PDF was sent to the customer.",
  invalid: "Submission or payment was rejected.",
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export type OrderStatusFilter = "all" | OrderStatus;

export function parseOrderStatusFilter(value: string | undefined): OrderStatusFilter {
  return isOrderStatus(value) ? value : "all";
}

/** Columns the Orders list search looks in. */
export const ORDER_SEARCH_COLUMNS = ["order_number", "customer_name", "customer_email", "bkash_transaction_number"] as const;
