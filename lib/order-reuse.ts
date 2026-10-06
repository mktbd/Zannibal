/**
 * What to do when a submitted bKash Transaction ID is already on record
 * (Stage 4E). A Transaction ID pays for at most one order:
 *
 * - an existing PENDING order for the same Case Study and email (compared
 *   case-insensitively) is the same submission arriving again (double
 *   click, retry after a network drop) -> return that order, insert none;
 * - anything else -- a different Case Study or email, or an order already
 *   Fulfilled or Invalid -> the Transaction ID is reused -> reject.
 *
 * Pure and import-free (unit-tested); lib/data/orders.ts applies it.
 */
export interface ExistingTransactionOrder {
  case_study_id: string | null;
  customer_email: string;
  status: "pending" | "fulfilled" | "invalid";
}

export function resolveTransactionReuse<T extends ExistingTransactionOrder>(
  existing: readonly T[],
  caseStudyId: string,
  email: string,
): { kind: "new" } | { kind: "resubmission"; order: T } | { kind: "reused" } {
  if (existing.length === 0) return { kind: "new" };
  const normalizedEmail = email.toLowerCase();
  const same = existing.find(
    (row) => row.status === "pending" && row.case_study_id === caseStudyId && row.customer_email.toLowerCase() === normalizedEmail,
  );
  return same ? { kind: "resubmission", order: same } : { kind: "reused" };
}
