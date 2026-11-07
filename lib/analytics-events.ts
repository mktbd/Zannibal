/**
 * The one event the public site pushes to GTM's dataLayer (production only;
 * components/site/analytics-events.tsx): mktbd_route_change.
 *
 * vinext's router keeps its own copy of history.pushState from before GTM
 * loads, so GTM's History Change listener never sees link navigation. This
 * event is pushed once per completed client-side change of path (links,
 * back/forward), never for the first page (the container sends that) and
 * never when the path didn't change.
 *
 * It carries no personal data: the path, the URL without query string or
 * fragment, and the page title. Consent still gates every tag in the
 * container. (Consent-ready is GTM's job: docs/gtm/mktbd-consent-ready.tpl.)
 *
 * Import-free, so node:test covers it.
 */

export const ROUTE_CHANGE_EVENT = "mktbd_route_change";

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
