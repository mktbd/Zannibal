import { currentDeploymentEnv, isNonProductionDeployment } from "@/lib/deployment";

/**
 * A visible marker on every page (public and Admin) of a deployment that
 * has declared itself non-production (lib/deployment.ts: SITE_ENV, else
 * VERCEL_ENV) -- e.g. the Cloudflare staging test (Stage 5E-B2A). Renders
 * nothing in production and in local builds without SITE_ENV.
 */
export function StagingBanner() {
  if (!isNonProductionDeployment(currentDeploymentEnv())) return null;
  return (
    <div role="note" aria-label="Test site" className="bg-red-700 px-4 py-2 text-center text-sm font-semibold text-white">
      STAGING — not the live mktbd site. Test data only; no real payments.
    </div>
  );
}
