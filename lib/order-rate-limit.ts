import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  hashClientKey,
  normalizeClientIp,
  parseLimitSetting,
  ORDER_RATE_LIMIT_DEFAULTS,
  ORDER_RATE_WINDOW_SECONDS,
  UNKNOWN_CLIENT,
} from "@/lib/order-rate-limit-core";

/**
 * Shared rate limit for POST /api/orders (Stage 5E-A), enforced by the
 * database function public.consume_order_rate_limit (migration 11), so it
 * holds across every serverless instance: per trusted client IP and a
 * global ceiling, over a one-hour sliding window.
 *
 * Fails closed: if the limit can't be checked (database error, timeout,
 * missing service-role key) the caller must refuse the order with 503.
 */

/** Longest we wait for the database before treating the check as failed. */
const TIMEOUT_MS = 3000;

export type RateLimitDecision =
  | { kind: "allowed" }
  | { kind: "limited"; retryAfterSeconds: number }
  | { kind: "error" };

/**
 * The client address to rate-limit, from headers only a trusted proxy can
 * set. On Vercel (VERCEL=1) the platform overwrites X-Real-IP and
 * X-Forwarded-For with the connecting client's address, so they can't be
 * spoofed. Anywhere else these headers are client-controlled and are used
 * only when ORDER_RATE_LIMIT_TRUST_PROXY=true (behind a proxy that
 * overwrites them); otherwise every request shares one "unknown" bucket --
 * strict, but never bypassable.
 */
export function clientAddress(headers: Headers): string {
  const trusted = process.env.VERCEL === "1" || process.env.ORDER_RATE_LIMIT_TRUST_PROXY === "true";
  if (!trusted) return UNKNOWN_CLIENT;
  return normalizeClientIp(headers.get("x-real-ip")) ?? normalizeClientIp(headers.get("x-forwarded-for")) ?? UNKNOWN_CLIENT;
}

const warn = (message: string) => console.error(`[orders] ${message}`);

export async function consumeOrderRateLimit(headers: Headers): Promise<RateLimitDecision> {
  try {
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) {
      console.error("[orders] rate limit unavailable (no service-role key)");
      return { kind: "error" };
    }
    const { data, error } = await createAdminClient()
      .rpc("consume_order_rate_limit", {
        p_client: hashClientKey(clientAddress(headers), secret),
        p_client_limit: parseLimitSetting(process.env.ORDER_RATE_LIMIT_PER_IP, ORDER_RATE_LIMIT_DEFAULTS.perClient, 10000, warn),
        p_global_limit: parseLimitSetting(process.env.ORDER_RATE_LIMIT_GLOBAL, ORDER_RATE_LIMIT_DEFAULTS.global, 1000000, warn),
        p_window_seconds: ORDER_RATE_WINDOW_SECONDS,
      })
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS))
      .single<{ allowed: boolean; retry_after_seconds: number }>();
    if (error || !data) {
      console.error(`[orders] rate limit check failed (${error?.code || "no result"})`);
      return { kind: "error" };
    }
    return data.allowed
      ? { kind: "allowed" }
      : { kind: "limited", retryAfterSeconds: Math.max(1, Math.min(ORDER_RATE_WINDOW_SECONDS, Math.ceil(data.retry_after_seconds))) };
  } catch (error) {
    console.error(`[orders] rate limit check failed (${error instanceof Error ? error.name : "unknown"})`);
    return { kind: "error" };
  }
}
