import "server-only";
import { currentDeploymentEnv } from "@/lib/deployment";
import { resolveBkashRecipient, STAGING_NOT_PAYABLE } from "@/lib/payment-recipient";

export { STAGING_NOT_PAYABLE };

const REFUSED: Record<string, string> = {
  invalid: "BKASH_PAYMENT_NUMBER is not a valid Bangladesh mobile number; purchasing is paused.",
  "placeholder-in-production": "BKASH_PAYMENT_NUMBER is the staging placeholder in a production deployment; purchasing is paused.",
  "real-number-outside-production": "BKASH_PAYMENT_NUMBER is a real-looking number in a non-production deployment; purchasing is paused (staging may only use the placeholder).",
};

/**
 * mktbd's receiving bKash number for the manual purchase flow, from the
 * server-only BKASH_PAYMENT_NUMBER environment variable. It is shown to
 * customers on the purchase page, so it is not a secret -- but it is read
 * and rendered on the server (not NEXT_PUBLIC_), so changing it needs no
 * rebuild and the purchase page and order endpoint always agree on it.
 *
 * Returns the normalised 11-digit number -- or, on a non-production
 * deployment only, the literal STAGING_NOT_PAYABLE placeholder (see
 * lib/payment-recipient.ts) -- or null when unset or refused, in which case
 * purchasing is paused (the page says so and POST /api/orders refuses new
 * orders). The configured value is never logged.
 */
export function getBkashPaymentNumber(): string | null {
  const result = resolveBkashRecipient(process.env.BKASH_PAYMENT_NUMBER, currentDeploymentEnv());
  if (result.ok) return result.value;
  if (result.reason !== "unset") console.error(`[payment] ${REFUSED[result.reason]}`);
  return null;
}
