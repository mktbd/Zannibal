import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDeploymentEnv, isNonProductionDeployment } from "../../lib/deployment.ts";
import { resolveBkashRecipient, STAGING_NOT_PAYABLE } from "../../lib/payment-recipient.ts";
import { clientIpFromHeaders, UNKNOWN_CLIENT } from "../../lib/order-rate-limit-core.ts";
import { isIndexableDeployment } from "../../lib/seo.ts";

test("deployment env: SITE_ENV first, fails safe, else VERCEL_ENV", () => {
  assert.equal(resolveDeploymentEnv("production", undefined), "production");
  assert.equal(resolveDeploymentEnv("preview", "production"), "preview", "SITE_ENV wins over VERCEL_ENV");
  for (const odd of ["staging", "Production", "prod", "x"]) assert.equal(resolveDeploymentEnv(odd, undefined), "preview", odd);
  assert.equal(resolveDeploymentEnv(undefined, "production"), "production");
  assert.equal(resolveDeploymentEnv("", "preview"), "preview");
  assert.equal(resolveDeploymentEnv(undefined, undefined), undefined, "local builds unchanged");
  assert.equal(isNonProductionDeployment("preview"), true);
  assert.equal(isNonProductionDeployment("production"), false);
  assert.equal(isNonProductionDeployment(undefined), false);
});

test("indexing follows the resolved environment", () => {
  assert.equal(isIndexableDeployment(resolveDeploymentEnv("preview", undefined)), false);
  assert.equal(isIndexableDeployment(resolveDeploymentEnv("typo", undefined)), false);
  assert.equal(isIndexableDeployment(resolveDeploymentEnv("production", undefined)), true);
  assert.equal(isIndexableDeployment(resolveDeploymentEnv(undefined, undefined)), true);
});

test("bKash recipient: production takes only real numbers, staging only the placeholder", () => {
  assert.deepEqual(resolveBkashRecipient("01712-345678", "production"), { ok: true, value: "01712345678", placeholder: false });
  assert.deepEqual(resolveBkashRecipient("01712345678", undefined), { ok: true, value: "01712345678", placeholder: false }, "local unchanged");
  assert.deepEqual(resolveBkashRecipient(STAGING_NOT_PAYABLE, "preview"), { ok: true, value: STAGING_NOT_PAYABLE, placeholder: true });
  assert.equal(resolveBkashRecipient(STAGING_NOT_PAYABLE, "production").ok, false);
  assert.equal(resolveBkashRecipient(STAGING_NOT_PAYABLE, undefined).ok, false, "placeholder refused without a declared non-production env");
  assert.deepEqual(resolveBkashRecipient("01712345678", "preview"), { ok: false, reason: "real-number-outside-production" });
  assert.deepEqual(resolveBkashRecipient("staging-not-payable", "preview"), { ok: false, reason: "invalid" }, "exact literal only");
  assert.deepEqual(resolveBkashRecipient("", "production"), { ok: false, reason: "unset" });
  assert.deepEqual(resolveBkashRecipient(undefined, "preview"), { ok: false, reason: "unset" });
});

test("client IP: CF-Connecting-IP on Cloudflare only; nothing else trusted there", () => {
  const h = (map) => (name) => map[name] ?? null;
  const cf = { platform: "cloudflare", vercel: undefined, trustProxy: undefined };
  assert.equal(clientIpFromHeaders(h({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "10.0.0.1" }), cf), "203.0.113.7");
  assert.equal(clientIpFromHeaders(h({ "x-forwarded-for": "10.0.0.1", "x-real-ip": "10.0.0.2" }), cf), UNKNOWN_CLIENT, "XFF/X-Real-IP ignored on Cloudflare");
  assert.equal(clientIpFromHeaders(h({ "cf-connecting-ip": "2001:db8:1:2::5" }), cf), "2001:0db8:0001:0002::/64");
  assert.equal(clientIpFromHeaders(h({ "cf-connecting-ip": "203.0.113.7" }), { platform: undefined, vercel: undefined, trustProxy: undefined }), UNKNOWN_CLIENT, "CF header not trusted off Cloudflare");
  assert.equal(clientIpFromHeaders(h({ "x-real-ip": "198.51.100.4" }), { platform: undefined, vercel: "1", trustProxy: undefined }), "198.51.100.4", "Vercel unchanged");
  assert.equal(clientIpFromHeaders(h({ "x-forwarded-for": "198.51.100.5, 10.0.0.1" }), { platform: undefined, vercel: undefined, trustProxy: "true" }), "198.51.100.5");
});
