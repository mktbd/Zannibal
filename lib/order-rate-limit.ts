import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  clientIpFromHeaders,
  hashClientKey,
  parseLimitSetting,
  ORDER_RATE_LIMIT_DEFAULTS,
  ORDER_RATE_WINDOW_SECONDS,
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
 * The client address to rate-limit (lib/order-rate-limit-core.ts
 * clientIpFromHeaders): CF-Connecting-IP on Cloudflare Workers
 * (DEPLOY_PLATFORM=cloudflare), X-Real-IP/X-Forwarded-For on Vercel or
 * behind a trusted proxy, otherwise one shared "unknown" bucket.
 */
export function clientAddress(headers: Headers): string {
  return clientIpFromHeaders((name) => headers.get(name), {
    platform: process.env.DEPLOY_PLATFORM,
    vercel: process.env.VERCEL,
    trustProxy: process.env.ORDER_RATE_LIMIT_TRUST_PROXY,
  });
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
