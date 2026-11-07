"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createRouteTracker } from "@/lib/analytics-events";

type DataLayerWindow = Window & { dataLayer?: unknown[] };

// One per document: the public layout persists across client-side
// navigation, and a remount must not count the current page again.
const routes = createRouteTracker();

/**
 * Pushes mktbd_route_change (lib/analytics-events.ts). Rendered only by
 * GoogleTagManager, so only where GTM runs: the production public site.
 * Renders nothing.
 */
export function AnalyticsEvents() {
  const pathname = usePathname();

  // Runs after the route's commit, so the path and title are the new page's.
  useEffect(() => {
    const event = routes.observe(pathname, window.location.origin, document.title);
    if (event) ((window as DataLayerWindow).dataLayer ??= []).push(event);
  }, [pathname]);

  return null;
}
