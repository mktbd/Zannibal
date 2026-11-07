import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as events from "../../lib/analytics-events.ts";
import { ROUTE_CHANGE_EVENT, cleanPath, createRouteTracker } from "../../lib/analytics-events.ts";

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

test("route: the site pushes only mktbd_route_change (no consent logic in site code)", () => {
  assert.deepEqual(Object.keys(events).sort(), ["ROUTE_CHANGE_EVENT", "cleanPath", "createRouteTracker", "isPublicPath"]);
  const component = readFileSync(new URL("../../components/site/analytics-events.tsx", import.meta.url), "utf8");
  assert.equal(/cookieyes|consent|setTimeout|setInterval|addEventListener/i.test(component), false);
});

// --- GTM template: docs/gtm/mktbd-consent-ready.tpl ------------------------

const tpl = readFileSync(new URL("../../docs/gtm/mktbd-consent-ready.tpl", import.meta.url), "utf8");
const section = (name) => tpl.split(`___${name}___`)[1].split(/\n___[A-Z_]+___\n/)[0].trim();
const js = section("SANDBOXED_JS_FOR_WEB_TEMPLATE");
const code = js.replace(/^\s*\/\/.*$/gm, "");
const permissions = JSON.parse(section("WEB_PERMISSIONS"));

test("template: a sandboxed TAG with no parameters, using only the consent, queue and callLater APIs", () => {
  const info = JSON.parse(section("INFO"));
  assert.equal(info.type, "TAG");
  assert.deepEqual(info.containerContexts, ["WEB"]);
  assert.deepEqual(JSON.parse(section("TEMPLATE_PARAMETERS")), []);
  const apis = [...code.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(apis, ["addConsentListener", "callLater", "createQueue"]);
  assert.match(code, /createQueue\('dataLayer'\)/);
  assert.match(code, /data\.gtmOnSuccess\(\);\s*$/);
});

test("template: listens to analytics_storage, ad_storage and ad_user_data; pushes only on grant", () => {
  const listened = [...code.matchAll(/addConsentListener\('([a-z_]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(listened, ["ad_storage", "ad_user_data", "analytics_storage"]);
  assert.match(code, /if \(!granted \|\| scheduled\) return;/);
});

/** Runs the template body with fake APIs (sandboxed JS is plain JS here). */
function runTemplate() {
  const listeners = {};
  const later = [];
  const pushed = [];
  const apis = {
    addConsentListener: (type, fn) => (listeners[type] = fn),
    callLater: (fn) => later.push(fn),
    createQueue: (key) => (assert.equal(key, "dataLayer"), (entry) => pushed.push(entry)),
  };
  const data = { gtmOnSuccess() { data.ok = true; } };
  new Function("require", "data", code)((name) => apis[name], data);
  assert.equal(data.ok, true);
  const change = (types, granted) => types.forEach((t) => listeners[t](t, granted)); // one consent update
  const flush = () => later.splice(0).forEach((fn) => fn()); // after the current code returns
  return { listeners, change, flush, pushed };
}

test("template: Accept All (several types in one update) sends exactly one mktbd_consent_ready", () => {
  const t = runTemplate();
  assert.deepEqual(Object.keys(t.listeners).sort(), ["ad_storage", "ad_user_data", "analytics_storage"], "registered at once, before any update");
  t.change(["analytics_storage", "ad_storage", "ad_user_data"], true);
  assert.deepEqual(t.pushed, [], "not inside the consent change itself");
  t.flush();
  assert.deepEqual(t.pushed, [{ event: "mktbd_consent_ready" }]);
});

test("template: partial consent — a later, separate grant sends a second event; withdrawal sends none", () => {
  const t = runTemplate();
  t.change(["analytics_storage"], true); // analytics only
  t.flush();
  t.change(["ad_storage", "ad_user_data"], true); // advertising later
  t.flush();
  t.change(["analytics_storage", "ad_storage", "ad_user_data"], false); // withdrawal
  t.flush();
  assert.deepEqual(t.pushed, [{ event: "mktbd_consent_ready" }, { event: "mktbd_consent_ready" }]);
});

test("template permissions: read-only consent for the three types; dataLayer read+write, no execute; nothing else", () => {
  assert.deepEqual(permissions.map((p) => p.instance.key.publicId).sort(), ["access_consent", "access_globals"]);
  const values = (p) => p.instance.param[0].value.listItem.map((item) => Object.fromEntries(item.mapKey.map((k, i) => [k.string, item.mapValue[i].string ?? item.mapValue[i].boolean])));
  const consent = values(permissions.find((p) => p.instance.key.publicId === "access_consent"));
  assert.deepEqual(consent.sort((a, b) => a.consentType.localeCompare(b.consentType)), [
    { consentType: "ad_storage", read: true, write: false },
    { consentType: "ad_user_data", read: true, write: false },
    { consentType: "analytics_storage", read: true, write: false },
  ]);
  const globals = values(permissions.find((p) => p.instance.key.publicId === "access_globals"));
  assert.deepEqual(globals, [{ key: "dataLayer", read: true, write: true, execute: false }]);
  assert.equal(/injectScript|sendPixel|setCookie|getCookieValues|callInWindow|copyFromWindow|setInWindow|updateConsentState|setDefaultConsentState/.test(code), false);
});

// --- Meta purchase-page exclusion (docs/MKTBD_SPEC.md, GTM setup) ---------

test("Meta purchase-page exclusion: the documented regex matches exactly the buy pages, and route events carry a matching page_path", () => {
  const spec = readFileSync(new URL("../../docs/MKTBD_SPEC.md", import.meta.url), "utf8");
  const pattern = "^/case-studies/[^/]+/buy/?$";
  assert.ok(spec.includes(`Page Path** matches RegEx \`${pattern}\``), "Page Path exception documented");
  assert.ok(spec.includes("Data Layer Variable **`page_path`** matches the same RegEx"), "route-event exception documented");
  const metaRows = spec.split("\n").filter((line) => /^\| Meta (Pixel|`PageView`)/.test(line));
  assert.equal(metaRows.length, 2);
  for (const row of metaRows) assert.match(row, /both purchase-page exceptions/);
  const buy = new RegExp(pattern);
  for (const path of ["/case-studies/acme/buy", "/case-studies/acme/buy/"]) assert.ok(buy.test(path), path);
  for (const path of ["/case-studies/acme", "/case-studies/buy", "/case-studies/acme/buy/x", "/case-studies/acme/buyer", "/x/case-studies/a/buy"]) assert.equal(buy.test(path), false, path);
  const routes = createRouteTracker();
  routes.observe("/case-studies/acme", ORIGIN, "t");
  assert.ok(buy.test(routes.observe("/case-studies/acme/buy?ref=x", ORIGIN, "t").page_path), "query removed, so the DLV exception still matches");
});
