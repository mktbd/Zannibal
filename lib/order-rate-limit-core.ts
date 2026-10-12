import { createHmac } from "node:crypto";
import { isIPv4, isIPv6 } from "node:net";

/**
 * Pure building blocks for the POST /api/orders rate limit (Stage 5E-A):
 * which client address to trust, how it is anonymised, and the limits.
 * No framework or Supabase imports, so node:test covers it directly;
 * lib/order-rate-limit.ts wires it to the request and the database.
 */

/** Sliding window length. The limits below are per this window. */
export const ORDER_RATE_WINDOW_SECONDS = 3600;

export const ORDER_RATE_LIMIT_DEFAULTS = {
  /** Order submissions per client IP per window. */
  perClient: 5,
  /** Order submissions across all clients per window (safety ceiling). */
  global: 100,
} as const;

/**
 * A rate-limit setting from the environment: a whole number within the
 * bounds the database function accepts, or the default (with `warn`
 * called) when unset-but-invalid, so a typo can't silently disable or
 * break the limit.
 */
export function parseLimitSetting(
  raw: string | undefined,
  fallback: number,
  max: number,
  warn: (message: string) => void = () => {},
): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw.trim());
  if (Number.isInteger(value) && value >= 1 && value <= max) return value;
  warn(`ignoring invalid rate limit setting; using ${fallback}`);
  return fallback;
}

/**
 * The client address from proxy headers, normalised to the key that is
 * rate-limited: an IPv4 address as is (IPv4-mapped IPv6 unwrapped), an
 * IPv6 address reduced to its /64 network (one subscriber usually holds a
 * whole /64, so per-address limits would be trivial to dodge). Takes the
 * first entry of a comma-separated list. Null when absent or not an IP.
 *
 * Callers must only pass header values set by a trusted proxy (see
 * lib/order-rate-limit.ts): these headers are client-controlled otherwise.
 */
export function normalizeClientIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.split(",")[0].trim();
  // "[2001:db8::1]:443" / "203.0.113.7:51234"
  const bracketed = value.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) value = bracketed[1];
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(value)) value = value.replace(/:\d+$/, "");
  value = value.replace(/%.*$/, ""); // IPv6 zone id
  if (isIPv4(value)) return value;
  if (!isIPv6(value)) return null;
  const mapped = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped && isIPv4(mapped[1])) return mapped[1];
  const groups = expandIPv6(value);
  return groups ? `${groups.slice(0, 4).join(":")}::/64` : null;
}

/** Eight 4-digit lowercase hex groups, or null. Input must already pass isIPv6. */
function expandIPv6(address: string): string[] | null {
  let text = address.toLowerCase();
  // Embedded IPv4 tail ("64:ff9b::192.0.2.1") -> two hex groups.
  const v4 = text.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) {
    const [a, b, c, d] = v4[1].split(".").map(Number);
    text = text.slice(0, -v4[1].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  return groups.length === 8 ? groups.map((g) => g.padStart(4, "0")) : null;
}

/** Key used when no trusted client address is available: one shared bucket. */
export const UNKNOWN_CLIENT = "unknown";

export interface ClientIpSettings {
  /** DEPLOY_PLATFORM: "cloudflare" on Cloudflare Workers. */
  platform: string | undefined;
  /** VERCEL ("1" on Vercel). */
  vercel: string | undefined;
  /** ORDER_RATE_LIMIT_TRUST_PROXY ("true" behind a proxy that overwrites the headers). */
  trustProxy: string | undefined;
}

/**
 * The client address to rate-limit, from the one header the platform
 * guarantees (Stage 5E-B2A):
 * - Cloudflare Workers (DEPLOY_PLATFORM=cloudflare): CF-Connecting-IP, set
 *   by Cloudflare's edge -- a client-sent value is overwritten. Nothing else
 *   is trusted there (X-Forwarded-For can carry client-supplied entries).
 * - Vercel (VERCEL=1): X-Real-IP / X-Forwarded-For, overwritten by Vercel.
 * - Elsewhere only with ORDER_RATE_LIMIT_TRUST_PROXY=true.
 * Otherwise every request shares UNKNOWN_CLIENT: strict, never bypassable.
 */
export function clientIpFromHeaders(get: (name: string) => string | null, settings: ClientIpSettings): string {
  if (settings.platform === "cloudflare") return normalizeClientIp(get("cf-connecting-ip")) ?? UNKNOWN_CLIENT;
  if (settings.vercel === "1" || settings.trustProxy === "true")
    return normalizeClientIp(get("x-real-ip")) ?? normalizeClientIp(get("x-forwarded-for")) ?? UNKNOWN_CLIENT;
  return UNKNOWN_CLIENT;
}

/**
 * The stored client identifier: HMAC-SHA256 of the normalised address
 * under a key derived from a server secret (the service-role key, with a
 * fixed purpose label), as 64 hex characters. Raw IPs are never stored,
 * and without the secret the hashes can't be reversed by trying every
 * IPv4 address. Rotating the secret only resets the counters.
 */
export function hashClientKey(client: string, secret: string): string {
  const key = createHmac("sha256", secret).update("mktbd/order-rate-limit/v1").digest();
  return createHmac("sha256", key).update(client).digest("hex");
}
