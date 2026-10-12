import { parseBkashNumber } from "./order-input.ts";
import { isNonProductionDeployment } from "./deployment.ts";

/**
 * Which receiving bKash number may be shown and accepted (Stage 5E-B2A),
 * from the configured BKASH_PAYMENT_NUMBER and the deployment environment
 * (lib/deployment.ts). Pure; lib/payment.ts applies it.
 *
 * - Production, or no deployment environment (local builds, tests): only a
 *   valid Bangladesh mobile number. The staging placeholder is refused.
 * - Non-production deployments (staging, previews): only the literal
 *   placeholder STAGING_NOT_PAYABLE, so a test site can exercise the order
 *   flow but can never show a payable recipient. A real-looking number is
 *   refused there.
 *
 * Anything refused yields null: purchasing is paused, as when unset.
 */
export const STAGING_NOT_PAYABLE = "STAGING-NOT-PAYABLE";

export type RecipientResult =
  | { ok: true; value: string; placeholder: boolean }
  | { ok: false; reason: "unset" | "invalid" | "placeholder-in-production" | "real-number-outside-production" };

export function resolveBkashRecipient(configured: string | undefined, deploymentEnv: string | undefined): RecipientResult {
  const raw = configured?.trim();
  if (!raw) return { ok: false, reason: "unset" };
  const nonProduction = isNonProductionDeployment(deploymentEnv);
  if (raw === STAGING_NOT_PAYABLE)
    return nonProduction ? { ok: true, value: STAGING_NOT_PAYABLE, placeholder: true } : { ok: false, reason: "placeholder-in-production" };
  const parsed = parseBkashNumber(raw);
  if (!parsed.ok) return { ok: false, reason: "invalid" };
  if (nonProduction) return { ok: false, reason: "real-number-outside-production" };
  return { ok: true, value: parsed.value, placeholder: false };
}
