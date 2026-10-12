/**
 * Which kind of deployment this is (Stage 5E-B2A): one explicit setting,
 * SITE_ENV, for hosts that don't announce themselves (Cloudflare Workers),
 * falling back to Vercel's VERCEL_ENV, so behaviour on Vercel and in local
 * builds is unchanged.
 *
 * - SITE_ENV=production -> production.
 * - SITE_ENV set to anything else ("preview", "staging", a typo) ->
 *   non-production. Fails safe: noindex, no HSTS, no payable bKash number.
 * - SITE_ENV unset -> VERCEL_ENV as is ("production", "preview",
 *   "development"), or undefined off Vercel (local builds, tests).
 *
 * Import-free, so node:test covers it and next.config.ts can use it.
 */
export function resolveDeploymentEnv(siteEnv: string | undefined, vercelEnv: string | undefined): string | undefined {
  const site = siteEnv?.trim();
  if (site) return site === "production" ? "production" : "preview";
  const vercel = vercelEnv?.trim();
  return vercel ? vercel : undefined;
}

/** The deployment environment of this process (SITE_ENV, else VERCEL_ENV). */
export function currentDeploymentEnv(): string | undefined {
  return resolveDeploymentEnv(process.env.SITE_ENV, process.env.VERCEL_ENV);
}

/**
 * True for a deployment that has declared itself non-production
 * (preview/staging/development). Undefined (local builds, tests, other
 * hosts without SITE_ENV) is NOT non-production here: those keep today's
 * behaviour.
 */
export function isNonProductionDeployment(env: string | undefined): boolean {
  return env !== undefined && env !== "production";
}
