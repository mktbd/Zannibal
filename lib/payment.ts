import "server-only";
import { parseBkashNumber } from "@/lib/order-input";

/**
 * mktbd's receiving bKash number for the manual purchase flow, from the
 * server-only BKASH_PAYMENT_NUMBER environment variable. It is shown to
 * customers on the purchase page, so it is not a secret -- but it is read
 * and rendered on the server (not NEXT_PUBLIC_), so changing it needs no
 * rebuild and the purchase page and order endpoint always agree on it.
 *
 * Returns the normalised 11-digit number, or null when it is unset or not
 * a valid Bangladesh mobile number -- in which case purchasing is paused
 * (the page says so and POST /api/orders refuses new orders).
 */
export function getBkashPaymentNumber(): string | null {
  const configured = process.env.BKASH_PAYMENT_NUMBER;
  if (!configured) return null;
  const parsed = parseBkashNumber(configured);
  if (!parsed.ok) {
    console.error("[payment] BKASH_PAYMENT_NUMBER is not a valid Bangladesh mobile number; purchasing is paused.");
    return null;
  }
  return parsed.value;
}
