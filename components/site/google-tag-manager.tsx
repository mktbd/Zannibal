import Script from "next/script";
import { currentDeploymentEnv } from "@/lib/deployment";
import { gtmBootstrapScript, isAnalyticsEnabled } from "@/lib/analytics";

/**
 * Loads the Google Tag Manager container on the production public site
 * (lib/analytics.ts). Renders nothing on staging, previews and local builds.
 * After hydration, so it never delays the page; once per document, so
 * client-side navigation between public pages doesn't reload it.
 */
export function GoogleTagManager() {
  if (!isAnalyticsEnabled(currentDeploymentEnv())) return null;
  return <Script id="gtm-bootstrap" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: gtmBootstrapScript() }} />;
}
