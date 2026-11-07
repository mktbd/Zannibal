"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { COOKIEYES_BROWSER_EVENT, createConsentReadyBridge, createRouteTracker } from "@/lib/analytics-events";

type DataLayerWindow = Window & { dataLayer?: unknown[] };

const dataLayer = () => ((window as DataLayerWindow).dataLayer ??= []);

// One per document: the public layout persists across client-side
// navigation, and a remount must not count the current page again.
const routes = createRouteTracker();

/**
 * Pushes mktbd_route_change and mktbd_consent_ready (lib/analytics-events.ts).
 * Rendered only by GoogleTagManager, so only where GTM runs: the production
 * public site. Renders nothing.
 */
export function AnalyticsEvents() {
  const pathname = usePathname();

  // After the new route has committed (path and title are the new page's).
  useEffect(() => {
    const event = routes.observe(pathname, window.location.origin, document.title);
    if (event) dataLayer().push(event);
  }, [pathname]);

  useEffect(() => {
    const bridge = createConsentReadyBridge({
      dataLayer: () => (window as DataLayerWindow).dataLayer,
      push: (entry) => dataLayer().push(entry),
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (id) => window.clearTimeout(id as number),
    });
    const onConsentUpdate = (event: Event) => bridge.onConsentUpdate((event as CustomEvent).detail);
    document.addEventListener(COOKIEYES_BROWSER_EVENT, onConsentUpdate);
    return () => {
      document.removeEventListener(COOKIEYES_BROWSER_EVENT, onConsentUpdate);
      bridge.dispose();
    };
  }, []);

  return null;
}
