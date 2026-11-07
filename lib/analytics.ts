/**
 * Website analytics: Google Tag Manager is the single integration point.
 * GA4, Meta Pixel and the CookieYes consent banner are configured inside the
 * GTM container (docs/MKTBD_SPEC.md, "Analytics (GTM)"), never in this code.
 *
 * - Production only: staging, previews, local builds and tests never load
 *   the container, so they can't send anything to the production properties.
 * - Public pages only: app/(public)/layout.tsx is the one place that renders
 *   it; /admin never does (tests/unit/analytics-isolation.test.mjs).
 * - Consent first: every optional storage type is denied before gtm.js
 *   loads; tags in the container wait for the visitor's CookieYes choice.
 * - Custom HTML tags and Custom JavaScript variables are blocked from here
 *   (gtm.blocklist: customScripts), whatever is published in the container.
 *   Blocklisting any class also blocks custom-template sandboxed JavaScript,
 *   so gtm.allowlist: sandboxedScripts re-enables gallery templates
 *   (CookieYes, Meta Pixel) without restricting any other class. See
 *   https://developers.google.com/tag-platform/tag-manager/web/restrict
 *
 * Import-free, so node:test covers it.
 */

/** The GTM web container. A public identifier, not a secret. */
export const GTM_CONTAINER_ID = "GTM-TWW2NJKP";

/** True only for the production deployment (lib/deployment.ts). */
export function isAnalyticsEnabled(deploymentEnv: string | undefined): boolean {
  return deploymentEnv === "production";
}

/**
 * Inline bootstrap, run once per document before gtm.js: consent defaults,
 * the in-page GTM allowlist and blocklist, then the container loader. Skips /admin as a
 * second line of defence and never runs twice in one document (a second
 * run would reset consent the visitor has already given).
 */
export function gtmBootstrapScript(containerId: string = GTM_CONTAINER_ID): string {
  if (!/^GTM-[A-Z0-9]+$/.test(containerId)) throw new Error("Invalid GTM container ID.");
  return `(function (w, d) {
  var path = w.location.pathname;
  if (path === "/admin" || path.indexOf("/admin/") === 0 || w.__mktbdGtm) return;
  w.__mktbdGtm = true;
  w.dataLayer = w.dataLayer || [];
  w.gtag = w.gtag || function () { w.dataLayer.push(arguments); };
  w.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    functionality_storage: "denied",
    personalization_storage: "denied",
    security_storage: "granted",
    wait_for_update: 500
  });
  w.gtag("set", "ads_data_redaction", true);
  w.dataLayer.push({ "gtm.allowlist": ["sandboxedScripts"], "gtm.blocklist": ["customScripts"] });
  w.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
  var s = d.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtm.js?id=${containerId}";
  d.head.appendChild(s);
})(window, document);`;
}
