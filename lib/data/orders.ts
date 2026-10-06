import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidSlug } from "@/lib/archive-core";
import type { OrderCustomerInput } from "@/lib/order-input";
import { resolveTransactionReuse, type ExistingTransactionOrder } from "@/lib/order-reuse";

/**
 * Server-side data access for public order submission (Stage 4E).
 *
 * Trust boundary: the Case Study is read with the cookie-less anonymous
 * client, so RLS itself guarantees only a *published* Case Study can be
 * ordered; its title and price come from that read, never from the
 * browser. The service-role client is used for exactly two narrow
 * operations after validation -- the duplicate-transaction lookup and the
 * INSERT of a Pending order -- because orders deliberately have no public
 * SELECT or INSERT policy. Nothing here ever updates or deletes an order.
 */

export interface OrderableCaseStudy {
  id: string;
  title: string;
  priceBdt: number;
}

/** A published Case Study that can be ordered, or null (unknown, draft or deleted). Throws on read failure. */
export async function getOrderableCaseStudy(slug: string): Promise<OrderableCaseStudy | null> {
  if (!isValidSlug(slug)) return null;
  const { data, error } = await createPublicClient()
    .from("case_studies")
    .select("id, title, price_bdt")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle<{ id: string; title: string; price_bdt: number | string }>();
  if (error) throw new Error(`orderable case study read failed (${error.code})`);
  return data ? { id: data.id, title: data.title, priceBdt: Number(data.price_bdt) } : null;
}

export interface CreatedOrder {
  orderNumber: string;
  caseStudyTitle: string;
  priceBdt: number;
}

export type CreateOrderResult =
  | { ok: true; order: CreatedOrder; replayed: boolean }
  | { ok: false; reason: "duplicate_transaction" | "unavailable" | "error" };

const RETURNED_COLUMNS = "order_number, case_study_title_snapshot, price_bdt_snapshot";
type ReturnedRow = { order_number: string; case_study_title_snapshot: string; price_bdt_snapshot: number | string };
const toCreated = (row: ReturnedRow): CreatedOrder => ({
  orderNumber: row.order_number,
  caseStudyTitle: row.case_study_title_snapshot,
  priceBdt: Number(row.price_bdt_snapshot),
});

/**
 * Identical submissions that arrive while the first is still being written
 * (double clicks, retries) share one promise in this server instance,
 * so they produce one order and the same answer.
 */
const inFlight = new Map<string, Promise<CreateOrderResult>>();

/**
 * Creates a Pending order with server-derived snapshots, or recognises a
 * repeat (see lib/order-reuse.ts):
 * - the same Transaction ID on a still-PENDING order for this Case Study
 *   and email -> that order is returned (a resubmission, not a new order);
 * - the same Transaction ID anywhere else -- another Case Study or email,
 *   or an order already Fulfilled or Invalid -> rejected (one bKash
 *   payment can't pay for two orders), revealing nothing about it.
 * Separate purchases by the same email or bKash number are never blocked.
 */
export function createPendingOrder(caseStudy: OrderableCaseStudy, customer: OrderCustomerInput): Promise<CreateOrderResult> {
  const key = `${caseStudy.id}|${customer.transactionNumber.toLowerCase()}|${customer.email.toLowerCase()}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const attempt = insertOrder(caseStudy, customer).finally(() => inFlight.delete(key));
  inFlight.set(key, attempt);
  return attempt;
}

async function insertOrder(caseStudy: OrderableCaseStudy, customer: OrderCustomerInput): Promise<CreateOrderResult> {
  const admin = createAdminClient();

  // Transaction IDs are letters and digits only (validated), so an
  // un-wildcarded ILIKE is an exact, case-insensitive comparison.
  const { data: existing, error: lookupError } = await admin
    .from("orders")
    .select(`case_study_id, customer_email, status, ${RETURNED_COLUMNS}`)
    .ilike("bkash_transaction_number", customer.transactionNumber)
    .order("submitted_at", { ascending: true })
    .limit(10)
    .overrideTypes<(ReturnedRow & ExistingTransactionOrder)[], { merge: false }>();
  if (lookupError) {
    console.error(`[orders] duplicate lookup failed (${lookupError.code})`);
    return { ok: false, reason: "error" };
  }
  const reuse = resolveTransactionReuse(existing, caseStudy.id, customer.email);
  if (reuse.kind === "resubmission") return { ok: true, order: toCreated(reuse.order), replayed: true };
  if (reuse.kind === "reused") return { ok: false, reason: "duplicate_transaction" };

  // order_number (sequence), submitted_at and updated_at are set by the
  // database; status is always Pending.
  const { data, error } = await admin
    .from("orders")
    .insert({
      customer_name: customer.customerName,
      customer_email: customer.email,
      bkash_number: customer.bkashNumber,
      bkash_transaction_number: customer.transactionNumber,
      case_study_id: caseStudy.id,
      case_study_title_snapshot: caseStudy.title,
      price_bdt_snapshot: caseStudy.priceBdt,
      status: "pending",
    })
    .select(RETURNED_COLUMNS)
    .single<ReturnedRow>();
  if (error) {
    // 23503: the Case Study was deleted between the read and the insert.
    if (error.code === "23503") return { ok: false, reason: "unavailable" };
    console.error(`[orders] insert failed (${error.code})`);
    return { ok: false, reason: "error" };
  }
  return { ok: true, order: toCreated(data), replayed: false };
}
