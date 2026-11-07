/**
 * The two events the public site pushes to GTM's dataLayer (production only;
 * components/site/analytics-events.tsx). GTM can't see either moment by
 * itself (docs/MKTBD_SPEC.md, "Analytics (GTM)"):
 *
 * - mktbd_route_change: vinext's router keeps its own copy of
 *   history.pushState from before GTM loads, so GTM's History Change
 *   listener never sees link navigation. Pushed once per completed
 *   client-side change of path (links, back/forward), never for the first
 *   page (the container sends that) or when the path didn't change.
 * - mktbd_consent_ready: CookieYes announces cookie_consent_update before
 *   GTM applies the visitor's grant, so tags triggered by it are still
 *   denied. Pushed after CookieYes's cookie_consent_update for the same
 *   choice is in the dataLayer queue: GTM applies a consent update before
 *   any item queued after it, so tags see the new state.
 *
 * Neither carries personal data: an event name, and for route changes the
 * path, the URL without query or fragment, and the page title. Consent still
 * gates every tag in the container.
 *
 * Import-free, so node:test covers it.
 */

export const ROUTE_CHANGE_EVENT = "mktbd_route_change";
export const CONSENT_READY_EVENT = "mktbd_consent_ready";
/** CookieYes's browser event for a consent choice (detail: { accepted, rejected }). */
export const COOKIEYES_BROWSER_EVENT = "cookieyes_consent_update";
/** CookieYes's dataLayer event for the same choice. */
export const COOKIEYES_DATALAYER_EVENT = "cookie_consent_update";

/** CookieYes categories that unlock a measurement tag (GA4: analytics; Meta: advertisement). */
const MEASUREMENT_CATEGORIES = ["analytics", "advertisement"];

export type RouteChangeEvent = {
  event: typeof ROUTE_CHANGE_EVENT;
  page_path: string;
  page_location: string;
  page_title: string;
};

/** The path alone: no query string or fragment, which can carry personal data. */
export function cleanPath(path: string): string {
  const cut = path.search(/[?#]/);
  const bare = cut === -1 ? path : path.slice(0, cut);
  return bare.startsWith("/") ? bare : `/${bare}`;
}

/** /admin never loads GTM; this is a second line of defence. */
export function isPublicPath(path: string): boolean {
  return path !== "/admin" && !path.startsWith("/admin/");
}

/**
 * Remembers the path of the page on screen. observe() is called after each
 * committed render; it returns an event only for a real change of path.
 */
export function createRouteTracker() {
  let current: string | null = null;
  return {
    observe(pathname: string, origin: string, title: string): RouteChangeEvent | null {
      const path = cleanPath(pathname);
      if (current === null) {
        current = path; // first page: the container's own page view
        return null;
      }
      if (path === current) return null; // re-render, query or fragment change
      current = path;
      if (!isPublicPath(path)) return null;
      return { event: ROUTE_CHANGE_EVENT, page_path: path, page_location: `${origin}${path}`, page_title: title };
    },
  };
}

/** True when the CookieYes choice accepts a category that a measurement tag needs. */
export function grantsMeasurement(detail: unknown): boolean {
  const accepted = (detail as { accepted?: unknown } | null | undefined)?.accepted;
  return Array.isArray(accepted) && accepted.some((c) => MEASUREMENT_CATEGORIES.includes(String(c)));
}

/** How many cookie_consent_update events CookieYes has pushed so far. */
export function countCookieYesUpdates(dataLayer: readonly unknown[] | undefined): number {
  if (!Array.isArray(dataLayer)) return 0;
  let n = 0;
  for (const entry of dataLayer) {
    if (entry && typeof entry === "object" && (entry as { event?: unknown }).event === COOKIEYES_DATALAYER_EVENT) n++;
  }
  return n;
}

export type ConsentBridgeDeps = {
  dataLayer(): readonly unknown[] | undefined;
  push(entry: { event: typeof CONSENT_READY_EVENT }): void;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(id: unknown): void;
};

/**
 * Pairs each CookieYes browser event with CookieYes's dataLayer event for
 * the same choice (the n-th of each), waits until that dataLayer event is
 * queued, then pushes mktbd_consent_ready behind it, if the choice grants
 * measurement. If the dataLayer event doesn't arrive within timeoutMs,
 * nothing is pushed (the page view then comes from the next page load, as
 * before) and the pairing restarts from what is in the dataLayer.
 */
export function createConsentReadyBridge(deps: ConsentBridgeDeps, { pollMs = 50, timeoutMs = 3000 } = {}) {
  let paired = countCookieYesUpdates(deps.dataLayer());
  const timers = new Set<unknown>();

  return {
    onConsentUpdate(detail: unknown): void {
      const target = ++paired;
      const grants = grantsMeasurement(detail);
      let waited = 0;
      const check = () => {
        if (countCookieYesUpdates(deps.dataLayer()) >= target) {
          if (grants) deps.push({ event: CONSENT_READY_EVENT });
          return;
        }
        if (waited >= timeoutMs) {
          paired = countCookieYesUpdates(deps.dataLayer());
          return;
        }
        waited += pollMs;
        const id = deps.setTimer(() => {
          timers.delete(id);
          check();
        }, pollMs);
        timers.add(id);
      };
      check();
    },
    dispose(): void {
      for (const id of timers) deps.clearTimer(id);
      timers.clear();
    },
  };
}
