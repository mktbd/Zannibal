import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONSENT_READY_EVENT,
  COOKIEYES_DATALAYER_EVENT,
  ROUTE_CHANGE_EVENT,
  cleanPath,
  countCookieYesUpdates,
  createConsentReadyBridge,
  createRouteTracker,
  grantsMeasurement,
} from "../../lib/analytics-events.ts";

const ORIGIN = "https://mktbd.co";

// --- Route changes ---------------------------------------------------------

test("route: the first page never produces an event (the container sends that page view)", () => {
  const routes = createRouteTracker();
  assert.equal(routes.observe("/", ORIGIN, "mktbd"), null);
  assert.equal(routes.observe("/", ORIGIN, "mktbd"), null, "re-render of the same page");
});

test("route: one event per completed client-side navigation, with path, clean URL and title only", () => {
  const routes = createRouteTracker();
  routes.observe("/", ORIGIN, "mktbd");
  const event = routes.observe("/analysis", ORIGIN, "Analysis | mktbd");
  assert.deepEqual(event, { event: ROUTE_CHANGE_EVENT, page_path: "/analysis", page_location: "https://mktbd.co/analysis", page_title: "Analysis | mktbd" });
  assert.deepEqual(Object.keys(event).sort(), ["event", "page_location", "page_path", "page_title"]);
  assert.equal(routes.observe("/analysis", ORIGIN, "Analysis | mktbd"), null, "no duplicate for the same path");
});

test("route: browser back and forward produce one event each; a query or fragment change produces none", () => {
  const routes = createRouteTracker();
  const seen = [];
  for (const path of ["/", "/analysis", "/analysis/some-slug", "/analysis", "/analysis/some-slug", "/analysis/some-slug#section", "/analysis/some-slug?x=1"]) {
    const event = routes.observe(path, ORIGIN, "t");
    if (event) seen.push(event.page_path);
  }
  // link, link, back, forward; then a fragment and a query change on the same page
  assert.deepEqual(seen, ["/analysis", "/analysis/some-slug", "/analysis", "/analysis/some-slug"]);
});

test("route: query strings and fragments never reach the event; /admin never produces one", () => {
  assert.equal(cleanPath("/case-studies/x?email=a@b.c#top"), "/case-studies/x");
  const routes = createRouteTracker();
  routes.observe("/", ORIGIN, "t");
  const event = routes.observe("/case-studies/x?ref=mail", ORIGIN, "t");
  assert.equal(event.page_location, "https://mktbd.co/case-studies/x");
  assert.equal(routes.observe("/admin", ORIGIN, "t"), null);
  assert.equal(routes.observe("/admin/orders", ORIGIN, "t"), null);
  assert.equal(routes.observe("/administration", ORIGIN, "t").page_path, "/administration", "only the /admin area is excluded");
});

// --- Consent ready ---------------------------------------------------------

/** A fake clock and dataLayer the bridge polls. */
function harness({ dataLayer = [], timeoutMs = 3000 } = {}) {
  let now = 0;
  const timers = [];
  const deps = {
    dataLayer: () => dataLayer,
    push: (entry) => dataLayer.push(entry),
    setTimer: (fn, ms) => {
      const t = { at: now + ms, fn, cleared: false };
      timers.push(t);
      return t;
    },
    clearTimer: (t) => {
      t.cleared = true;
    },
  };
  const advance = (ms) => {
    const end = now + ms;
    for (;;) {
      const next = timers.filter((t) => !t.cleared && t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      next.cleared = true;
      now = next.at;
      next.fn();
    }
    now = end;
  };
  const bridge = createConsentReadyBridge(deps, { pollMs: 50, timeoutMs });
  const readyAt = () => dataLayer.flatMap((e, i) => (e?.event === CONSENT_READY_EVENT ? [i] : []));
  const cookieYesAt = () => dataLayer.flatMap((e, i) => (e?.event === COOKIEYES_DATALAYER_EVENT ? [i] : []));
  return { dataLayer, bridge, advance, readyAt, cookieYesAt, pending: () => timers.filter((t) => !t.cleared).length };
}

const ACCEPT = { accepted: ["necessary", "functional", "analytics", "performance", "advertisement"], rejected: [] };
const REJECT = { accepted: ["necessary"], rejected: ["functional", "analytics", "performance", "advertisement"] };

test("consent: waits for CookieYes's dataLayer event, then pushes mktbd_consent_ready behind it (browser event first)", () => {
  const h = harness();
  h.bridge.onConsentUpdate(ACCEPT);
  h.advance(500);
  assert.deepEqual(h.readyAt(), [], "nothing before CookieYes's dataLayer event is queued");
  h.dataLayer.push({ event: COOKIEYES_DATALAYER_EVENT });
  h.advance(50);
  assert.equal(h.readyAt().length, 1);
  assert.ok(h.readyAt()[0] > h.cookieYesAt()[0], "queued after CookieYes's event");
  h.advance(5000);
  assert.equal(h.readyAt().length, 1, "exactly once");
  assert.equal(h.pending(), 0);
});

test("consent: pushes at once when CookieYes's dataLayer event is already queued (dataLayer event first)", () => {
  // The bridge starts at hydration, before CookieYes loads; CookieYes then pushes, then dispatches.
  const live = harness();
  live.dataLayer.push({ event: COOKIEYES_DATALAYER_EVENT });
  live.bridge.onConsentUpdate(ACCEPT);
  assert.equal(live.readyAt().length, 1);
  assert.ok(live.readyAt()[0] > live.cookieYesAt()[0]);
  assert.equal(live.pending(), 0, "no polling needed");
});

test("consent: a choice that grants nothing measurable pushes nothing, and still consumes its own CookieYes event", () => {
  const h = harness();
  // Page load: CookieYes reports the stored state (nothing granted) ...
  h.bridge.onConsentUpdate(REJECT);
  h.dataLayer.push({ event: COOKIEYES_DATALAYER_EVENT });
  h.advance(100);
  assert.deepEqual(h.readyAt(), []);
  // ... then the visitor accepts: wait for the SECOND CookieYes event, not the first.
  h.bridge.onConsentUpdate(ACCEPT);
  h.advance(200);
  assert.deepEqual(h.readyAt(), [], "the earlier event does not count for this choice");
  h.dataLayer.push({ event: COOKIEYES_DATALAYER_EVENT });
  h.advance(50);
  assert.equal(h.readyAt().length, 1);
  assert.ok(h.readyAt()[0] > h.cookieYesAt()[1]);
});

test("consent: analytics-only or advertising-only choices count; necessary/functional/performance alone don't", () => {
  assert.equal(grantsMeasurement({ accepted: ["necessary", "analytics"] }), true);
  assert.equal(grantsMeasurement({ accepted: ["necessary", "advertisement"] }), true);
  assert.equal(grantsMeasurement({ accepted: ["necessary", "functional", "performance"] }), false);
  for (const bad of [undefined, null, {}, { accepted: "analytics" }]) assert.equal(grantsMeasurement(bad), false);
});

test("consent: if CookieYes's dataLayer event never comes, nothing is pushed and the pairing resyncs", () => {
  const h = harness({ timeoutMs: 300 });
  h.bridge.onConsentUpdate(ACCEPT);
  h.advance(1000);
  assert.deepEqual(h.readyAt(), []);
  assert.equal(h.pending(), 0, "polling stopped");
  // A later, normal pair still works.
  h.bridge.onConsentUpdate(ACCEPT);
  h.dataLayer.push({ event: COOKIEYES_DATALAYER_EVENT });
  h.advance(50);
  assert.equal(h.readyAt().length, 1);
});

test("consent: dispose stops any pending wait", () => {
  const h = harness();
  h.bridge.onConsentUpdate(ACCEPT);
  h.bridge.dispose();
  h.dataLayer.push({ event: COOKIEYES_DATALAYER_EVENT });
  h.advance(1000);
  assert.deepEqual(h.readyAt(), []);
});

test("consent: the pushed event carries nothing but its name", () => {
  const h = harness();
  h.dataLayer.push({ event: COOKIEYES_DATALAYER_EVENT });
  h.bridge.onConsentUpdate(ACCEPT);
  assert.deepEqual(h.dataLayer.at(-1), { event: CONSENT_READY_EVENT });
  assert.equal(countCookieYesUpdates(undefined), 0);
});

/**
 * A model of GTM's documented processing order: dataLayer messages are
 * processed in order, and a consent update a template requests while an
 * event is processed is applied before any item queued after it.
 * (Tag Manager template API, updateConsentState / gtagSet.)
 */
test("consent: under GTM's documented ordering, a tag on mktbd_consent_ready sees the granted state; one on cookie_consent_update doesn't", () => {
  const consent = { analytics_storage: "denied" };
  const pendingUpdates = [];
  const firedWith = {};
  const process = (entry) => {
    while (pendingUpdates.length) Object.assign(consent, pendingUpdates.shift()); // applied before the next queued item
    if (entry?.event) firedWith[entry.event] = consent.analytics_storage;
    if (entry?.event === COOKIEYES_DATALAYER_EVENT) pendingUpdates.push({ analytics_storage: "granted" }); // CookieYes template, mid-event
  };
  const dataLayer = [];
  const gtmPush = (entry) => {
    dataLayer.push(entry);
    process(entry);
  };
  const bridge = createConsentReadyBridge({ dataLayer: () => dataLayer, push: gtmPush, setTimer: (fn) => (fn(), 0), clearTimer: () => {} });
  gtmPush({ event: COOKIEYES_DATALAYER_EVENT });
  bridge.onConsentUpdate(ACCEPT);
  assert.equal(firedWith[COOKIEYES_DATALAYER_EVENT], "denied", "the current problem: same-event tags are still denied");
  assert.equal(firedWith[CONSENT_READY_EVENT], "granted");
});
