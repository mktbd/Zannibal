import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ORDER_SEARCH_COLUMNS, type OrderStatusFilter } from "@/lib/orders";
import { ilikeAnyFilter } from "@/lib/search";
import type { OrderStatus } from "@/lib/types/content";

/**
 * Admin-side reads for Orders. Orders hold customer and payment details,
 * so they are readable only through RLS's orders_select_admin policy for
 * the signed-in admin -- this module never uses the service-role client.
 *
 * Title and price always come from the order's own snapshot columns, never
 * from the current Case Study, which may since have changed or been deleted.
 */

/** The list is a work queue; very old history can be reached by search. */
export const ORDER_LIST_LIMIT = 200;

export interface OrderListItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  bkashTransactionNumber: string;
  caseStudyTitleSnapshot: string;
  priceBdtSnapshot: number;
  status: OrderStatus;
  submittedAt: string;
}

export async function listOrders(filter: {
  query: string;
  status: OrderStatusFilter;
}): Promise<{ orders: OrderListItem[]; truncated: boolean }> {
  const supabase = await createClient();
  let request = supabase
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_email, bkash_transaction_number, case_study_title_snapshot, price_bdt_snapshot, status, submitted_at",
    )
    .order("submitted_at", { ascending: false })
    .order("order_number", { ascending: false })
    .limit(ORDER_LIST_LIMIT + 1);
  if (filter.query) request = request.or(ilikeAnyFilter(ORDER_SEARCH_COLUMNS, filter.query));
  if (filter.status !== "all") request = request.eq("status", filter.status);

  const { data, error } = await request.overrideTypes<
    {
      id: string;
      order_number: string;
      customer_name: string;
      customer_email: string;
      bkash_transaction_number: string;
      case_study_title_snapshot: string;
      price_bdt_snapshot: number | string;
      status: OrderStatus;
      submitted_at: string;
    }[],
    { merge: false }
  >();
  if (error) throw new Error(`Could not load orders: ${error.message}`);

  return {
    truncated: data.length > ORDER_LIST_LIMIT,
    orders: data.slice(0, ORDER_LIST_LIMIT).map((row) => ({
      id: row.id,
      orderNumber: row.order_number,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      bkashTransactionNumber: row.bkash_transaction_number,
      caseStudyTitleSnapshot: row.case_study_title_snapshot,
      priceBdtSnapshot: Number(row.price_bdt_snapshot),
      status: row.status,
      submittedAt: row.submitted_at,
    })),
  };
}

export interface OrderDetail extends OrderListItem {
  bkashNumber: string;
  updatedAt: string;
  /** Set while the purchased Case Study still exists (FK is ON DELETE SET NULL). */
  caseStudy: { id: string; title: string; status: "draft" | "published" } | null;
}

export async function getOrder(id: string): Promise<OrderDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_email, bkash_number, bkash_transaction_number, case_study_id, case_study_title_snapshot, price_bdt_snapshot, status, submitted_at, updated_at, case_studies(id, title, status)",
    )
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<
      {
        id: string;
        order_number: string;
        customer_name: string;
        customer_email: string;
        bkash_number: string;
        bkash_transaction_number: string;
        case_study_id: string | null;
        case_study_title_snapshot: string;
        price_bdt_snapshot: number | string;
        status: OrderStatus;
        submitted_at: string;
        updated_at: string;
        case_studies: { id: string; title: string; status: "draft" | "published" } | null;
      } | null,
      { merge: false }
    >();
  if (error) throw new Error(`Could not load the order: ${error.message}`);
  if (!data) return null;

  return {
    id: data.id,
    orderNumber: data.order_number,
    customerName: data.customer_name,
    customerEmail: data.customer_email,
    bkashNumber: data.bkash_number,
    bkashTransactionNumber: data.bkash_transaction_number,
    caseStudyTitleSnapshot: data.case_study_title_snapshot,
    priceBdtSnapshot: Number(data.price_bdt_snapshot),
    status: data.status,
    submittedAt: data.submitted_at,
    updatedAt: data.updated_at,
    caseStudy: data.case_study_id && data.case_studies ? data.case_studies : null,
  };
}
