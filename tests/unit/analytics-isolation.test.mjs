import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// GTM stays loaded for the life of a document, so /admin must never be
// reached from a public page by client-side navigation (same document).
// These guards keep the invariants the analytics setup relies on.

const ROOT = new URL("../../", import.meta.url).pathname;
const files = (dir) =>
  readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(ROOT, dir, name);
    if (statSync(path).isDirectory()) return files(relative(ROOT, path));
    return /\.(ts|tsx)$/.test(name) ? [relative(ROOT, path)] : [];
  });
const isAdminCode = (file) => /^(app\/admin|components\/admin|lib\/auth|lib\/data\/admin)\//.test(file);
const source = [...files("app"), ...files("components"), ...files("lib")];

test("only the public layout renders GoogleTagManager", () => {
  const users = source.filter((f) => f !== "components/site/google-tag-manager.tsx" && /<GoogleTagManager\b/.test(readFileSync(join(ROOT, f), "utf8")));
  assert.deepEqual(users, ["app/(public)/layout.tsx"]);
});

test("only GoogleTagManager (production-gated) renders AnalyticsEvents, and only the bridge pushes to the dataLayer", () => {
  const users = source.filter((f) => f !== "components/site/analytics-events.tsx" && /<AnalyticsEvents\b/.test(readFileSync(join(ROOT, f), "utf8")));
  assert.deepEqual(users, ["components/site/google-tag-manager.tsx"]);
  const gtm = readFileSync(join(ROOT, "components/site/google-tag-manager.tsx"), "utf8");
  assert.match(gtm, /if \(!isAnalyticsEnabled\(currentDeploymentEnv\(\)\)\) return null;[\s\S]*<AnalyticsEvents \/>/);
  const pushers = source.filter((f) => /dataLayer\(\)\.push|dataLayer\.push/.test(readFileSync(join(ROOT, f), "utf8")));
  assert.deepEqual(pushers.sort(), ["components/site/analytics-events.tsx", "lib/analytics.ts"]);
});

test("no code outside the admin area links or navigates to /admin", () => {
  const offenders = [];
  for (const f of source.filter((f) => !isAdminCode(f) && f !== "app/robots.ts")) {
    const lines = readFileSync(join(ROOT, f), "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return; // comments
      if (/(href|push|replace|redirect|location)\W[^\n]*["'`]\/admin(["'`/?#])/.test(line)) offenders.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});

test("analytics code never configures GA4 or Meta directly", () => {
  const offenders = source.filter((f) => /googletagmanager\.com\/gtag|gtag\(\s*["']config|fbq\(|fbevents\.js|G-HVTBNTC92D|4751937931792975/.test(readFileSync(join(ROOT, f), "utf8")));
  assert.deepEqual(offenders, []);
});
