import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { GTM_CONTAINER_ID, gtmBootstrapScript, isAnalyticsEnabled } from "../../lib/analytics.ts";
import { ANALYTICS_CSP_SOURCES, contentSecurityPolicy } from "../../lib/security-headers.ts";

/** Runs the bootstrap against a fake window/document; returns what it did. */
function run(pathname, { times = 1, existing } = {}) {
  const appended = [];
  const window = { location: { pathname }, ...(existing ? { dataLayer: existing } : {}) };
  const document = { createElement: () => ({}), head: { appendChild: (el) => appended.push(el) } };
  const context = vm.createContext({ window, document, Date });
  for (let i = 0; i < times; i++) vm.runInContext(gtmBootstrapScript(), context);
  // Plain values from the sandbox's realm (arguments objects -> arrays).
  const dataLayer = JSON.parse(JSON.stringify((window.dataLayer ?? []).map((entry) => (typeof entry.length === "number" ? Array.from(entry) : entry))));
  return { window, dataLayer, appended };
}

test("GTM runs only on the production deployment", () => {
  assert.equal(isAnalyticsEnabled("production"), true);
  for (const env of [undefined, "", "preview", "staging", "development", "Production"]) assert.equal(isAnalyticsEnabled(env), false, String(env));
});

test("bootstrap: consent defaults (all optional storage denied) and the allowlist/blocklist come before gtm.js", () => {
  const { dataLayer, appended } = run("/");
  const [consent, redaction, restrictions, start] = dataLayer;
  assert.deepEqual(consent.slice(0, 2), ["consent", "default"]);
  for (const type of ["ad_storage", "ad_user_data", "ad_personalization", "analytics_storage", "functionality_storage", "personalization_storage"]) {
    assert.equal(consent[2][type], "denied", type);
  }
  assert.equal(consent[2].security_storage, "granted");
  assert.equal(consent[2].wait_for_update, 500);
  assert.deepEqual(redaction, ["set", "ads_data_redaction", true]);
  // Custom HTML / Custom JS stay blocked; only sandboxed template JS is re-enabled (no other class allowlisted).
  assert.deepEqual(restrictions, { "gtm.allowlist": ["sandboxedScripts"], "gtm.blocklist": ["customScripts"] });
  assert.equal(start.event, "gtm.js");
  assert.equal(dataLayer.length, 4, "nothing else is pushed: no page_view, no config");
  assert.equal(appended.length, 1);
  assert.equal(appended[0].src, `https://www.googletagmanager.com/gtm.js?id=${GTM_CONTAINER_ID}`);
  assert.equal(appended[0].async, true);
});

test("bootstrap: never on /admin, and only once per document", () => {
  for (const path of ["/admin", "/admin/", "/admin/login", "/admin/analysis/x/edit"]) {
    const { dataLayer, appended } = run(path);
    assert.equal(dataLayer.length, 0, path);
    assert.equal(appended.length, 0, path);
  }
  // Public paths that merely start with "admin" text are still public.
  assert.equal(run("/administration").appended.length, 1);
  const twice = run("/analysis", { times: 2 });
  assert.equal(twice.appended.length, 1);
  assert.equal(twice.dataLayer.filter((e) => Array.isArray(e) && e[0] === "consent").length, 1, "consent defaults never reset");
});

test("bootstrap keeps an existing dataLayer and contains no GA4 or Meta identifiers", () => {
  const { dataLayer } = run("/", { existing: [{ prior: true }] });
  assert.deepEqual(dataLayer[0], { prior: true });
  const script = gtmBootstrapScript();
  assert.equal(/G-[A-Z0-9]{6,}|fbq|connect\.facebook|4751937931792975/.test(script), false);
  assert.throws(() => gtmBootstrapScript('GTM-X"; alert(1)//'));
});

test("analytics CSP: exact sources, wildcards only for GA4 collection, nothing for Preview", () => {
  const prod = { supabaseUrl: "https://abc.supabase.co", development: false, productionHttps: true };
  const d = (csp) => Object.fromEntries(csp.split("; ").map((x) => { const [k, ...v] = x.split(" "); return [k, v]; }));
  const withTags = d(contentSecurityPolicy({ ...prod, analytics: true }));
  const without = d(contentSecurityPolicy(prod));
  const added = (name) => withTags[name].filter((s) => !without[name].includes(s));
  assert.deepEqual(added("script-src"), [...ANALYTICS_CSP_SOURCES.script]);
  assert.deepEqual(added("connect-src"), [...ANALYTICS_CSP_SOURCES.connect]);
  assert.deepEqual(added("img-src"), [...ANALYTICS_CSP_SOURCES.img]);
  assert.equal(withTags["script-src"].some((s) => s.includes("*")), false, "no wildcard script source");
  assert.deepEqual(
    [...added("connect-src"), ...added("img-src")].filter((s) => s.includes("*")).sort(),
    ["https://*.analytics.google.com", "https://*.google-analytics.com", "https://*.google-analytics.com"].sort(),
  );
  for (const name of ["default-src", "style-src", "font-src", "object-src", "frame-src", "base-uri", "form-action", "frame-ancestors"]) {
    assert.deepEqual(withTags[name], without[name], `${name} unchanged`);
  }
  const all = contentSecurityPolicy({ ...prod, analytics: true });
  assert.equal(all.includes("'unsafe-eval'"), false);
  assert.equal(/tagassistant|tagmanager\.google\.com|gstatic|fonts\.googleapis/.test(all), false, "no Preview/debug origins");
});
