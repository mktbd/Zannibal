import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Rules for the staging browser tests that timing alone cannot enforce. A server-rendered control
// exists before React hydrates it, and an event fired then is dropped silently: staging run #19 set
// the cover file before hydration, so no upload request was ever sent. Throttled local runs make
// that more likely to show but cannot guarantee it, so the rule is checked in the source.
const src = readFileSync(new URL("../../scripts/staging/browser-round.mjs", import.meta.url), "utf8");
const lines = src.split("\n");

test("the readiness helper waits for React's props on the element (no fixed sleep)", () => {
  const helper = src.slice(src.indexOf("const interactive ="), src.indexOf("\n", src.indexOf("polling:")) + 1);
  assert.match(helper, /__reactProps\$/);
  assert.match(helper, /waitForFunction/);
  assert.doesNotMatch(helper, /sleep|waitForTimeout|setTimeout/);
});

test("every setInputFiles on a client-side control is preceded by the readiness wait for it", () => {
  const uses = lines.map((l, i) => [l, i]).filter(([l]) => /\.setInputFiles\(/.test(l));
  assert.ok(uses.length > 0, "expected at least one file upload in the browser round");
  for (const [line, i] of uses) {
    const selector = line.match(/setInputFiles\(\s*"([^"]+)"/)?.[1];
    assert.ok(selector, `line ${i + 1}: setInputFiles must name its selector literally`);
    const before = lines.slice(Math.max(0, i - 8), i).join("\n");
    assert.ok(before.includes(`interactive(page, "${selector}")`), `line ${i + 1}: setInputFiles("${selector}") without a preceding interactive(page, "${selector}")`);
  }
});

test("the smoke profile sends no order request (it must not use up the full test's rate-limit window)", () => {
  // Every order POST sits in the full-only orders section; the smoke order check only changes status.
  const start = src.indexOf('if (SMOKE) console.log("   (smoke: no order requests');
  const end = src.indexOf("// ---- D0.", start);
  assert.ok(start > 0 && end > start, "orders section guarded by the smoke profile");
  const orderPosts = [...src.matchAll(/api\("\/api\/orders"/g)].map((m) => m.index);
  assert.ok(orderPosts.length >= 2, "expected the order and spoof helpers");
  for (const at of orderPosts) assert.ok(at > start && at < end, "an order POST outside the full-only section");
  const smokeFn = src.slice(src.indexOf("async function smokeOrderStatus"), src.indexOf("\nlet browser = null"));
  assert.doesNotMatch(smokeFn, /\/api\/orders|order\(|spoof\(/, "the smoke order check sends no order request");
  assert.match(smokeFn, /finally \{/, "the smoke status change is restored in a finally block");
  assert.match(smokeFn, /CLEANUP FAILED/);
});

test("the smoke order fixture is written by the seed directly to the database, never via the order API", () => {
  const seed = readFileSync(new URL("../../scripts/staging/seed.mjs", import.meta.url), "utf8");
  assert.match(seed, /insert into public\.orders \(id,[^)]*\)[\s\S]*smoke\.fixture@example\.test[\s\S]*on conflict \(id\) do update set status = 'pending'/);
  const code = seed.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  assert.doesNotMatch(code, /\/api\/orders|fetch\(/, "the seed calls no HTTP order endpoint");
  assert.match(src, /find\("smoke\.fixture@example\.test"\)/, "the smoke check prefers the seeded fixture");
});

test("the round never uses fixed waits for readiness", () => {
  assert.doesNotMatch(src, /waitForTimeout\(/);
});

test("a successful test upload is always followed by a verified deletion", () => {
  assert.match(src, /check\("temporary cover upload deleted from Storage"/);
  assert.match(src, /CLEANUP FAILED/);
  assert.match(src, /public URL now/);
});

test("diagnostics are sanitized: paths without queries, tokens, JWTs and emails redacted", () => {
  const helpers = src.slice(src.indexOf("const redactPath"), src.indexOf("/**", src.indexOf("const redactText")));
  const { redactPath, redactText } = new Function(`${helpers}; return { redactPath, redactText };`)();
  assert.equal(redactPath("/admin/orders/1c1faae7-e935-4c32-a08d-fbe6fd30acbb"), "/admin/orders/<id>");
  const t = redactText("Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZSJ9.c2lnbmF0dXJlc2lnbmF0dXJl for staging-admin@example.test key sb_secret_0123456789abcdefghijklmnopqrstuv"); // qa-secret-scan: allow (fake values)
  assert.doesNotMatch(t, /eyJ|@example\.test|sb_secret_0123/);
  assert.ok(redactText("x".repeat(500)).length <= 120);
});
