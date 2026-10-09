import { test } from "node:test";
import assert from "node:assert/strict";
import { contentSecurityPolicy, securityHeaders } from "../../lib/security-headers.ts";

const prod = { supabaseUrl: "https://abc.supabase.co", development: false, productionHttps: true };
const directives = (csp) => Object.fromEntries(csp.split("; ").map((d) => { const [k, ...v] = d.split(" "); return [k, v]; }));

test("production CSP: self + the Supabase origin only; no eval, objects, framing or wildcards", () => {
  const d = directives(contentSecurityPolicy(prod));
  assert.deepEqual(d["default-src"], ["'self'"]);
  assert.deepEqual(d["script-src"], ["'self'", "'unsafe-inline'"]);
  assert.ok(d["img-src"].includes("https://abc.supabase.co") && d["connect-src"].includes("https://abc.supabase.co"));
  assert.deepEqual(d["object-src"], ["'none'"]);
  assert.deepEqual(d["frame-ancestors"], ["'none'"]);
  assert.deepEqual(d["base-uri"], ["'self'"]);
  assert.deepEqual(d["form-action"], ["'self'"]);
  assert.ok("upgrade-insecure-requests" in d);
  assert.equal(/\*|https:(\s|;|$)|'unsafe-eval'/.test(contentSecurityPolicy(prod)), false, "no wildcard, bare scheme or eval");
});

test("development adds eval + websockets; a local http Supabase is allowed without upgrade-insecure-requests", () => {
  const dev = contentSecurityPolicy({ supabaseUrl: "http://127.0.0.1:54321", development: true, productionHttps: false });
  assert.ok(dev.includes("'unsafe-eval'") && dev.includes("ws:") && dev.includes("http://127.0.0.1:54321"));
  assert.equal(dev.includes("upgrade-insecure-requests"), false);
  const localProd = contentSecurityPolicy({ supabaseUrl: "http://127.0.0.1:54321", development: false, productionHttps: false });
  assert.equal(localProd.includes("upgrade-insecure-requests"), false);
  assert.equal(localProd.includes("'unsafe-eval'"), false);
});

test("a missing or invalid Supabase URL never widens the policy", () => {
  for (const supabaseUrl of [undefined, "", "not a url"]) {
    const d = directives(contentSecurityPolicy({ supabaseUrl, development: false, productionHttps: false }));
    assert.deepEqual(d["connect-src"], ["'self'"]);
  }
});

test("header set: nosniff, referrer, permissions, frame denial, COOP; HSTS only on production", () => {
  const keys = (h) => Object.fromEntries(h.map((x) => [x.key, x.value]));
  const p = keys(securityHeaders(prod));
  assert.equal(p["X-Content-Type-Options"], "nosniff");
  assert.equal(p["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(p["X-Frame-Options"], "DENY");
  assert.equal(p["Cross-Origin-Opener-Policy"], "same-origin");
  assert.match(p["Permissions-Policy"], /camera=\(\).*microphone=\(\).*geolocation=\(\)/);
  assert.equal(p["Strict-Transport-Security"], "max-age=63072000");
  assert.equal("Strict-Transport-Security" in keys(securityHeaders({ ...prod, productionHttps: false })), false);
});
