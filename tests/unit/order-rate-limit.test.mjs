import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashClientKey,
  normalizeClientIp,
  parseLimitSetting,
  ORDER_RATE_LIMIT_DEFAULTS,
  ORDER_RATE_WINDOW_SECONDS,
} from "../../lib/order-rate-limit-core.ts";

test("defaults: 5 per client and a global ceiling per hour", () => {
  assert.equal(ORDER_RATE_WINDOW_SECONDS, 3600);
  assert.equal(ORDER_RATE_LIMIT_DEFAULTS.perClient, 5);
  assert.ok(ORDER_RATE_LIMIT_DEFAULTS.global > ORDER_RATE_LIMIT_DEFAULTS.perClient);
});

test("limit settings: whole numbers in range, otherwise the default", () => {
  const warnings = [];
  const warn = (m) => warnings.push(m);
  assert.equal(parseLimitSetting(undefined, 5, 100, warn), 5);
  assert.equal(parseLimitSetting("", 5, 100, warn), 5);
  assert.equal(parseLimitSetting(" 12 ", 5, 100, warn), 12);
  for (const bad of ["0", "-1", "1.5", "abc", "101", "1e9", "Infinity"]) assert.equal(parseLimitSetting(bad, 5, 100, warn), 5, bad);
  assert.equal(warnings.length, 7);
  assert.ok(warnings.every((w) => !/\d{3,}/.test(w)), "warnings don't echo the raw value");
});

test("client IP: IPv4, first forwarded entry, ports stripped", () => {
  assert.equal(normalizeClientIp("203.0.113.7"), "203.0.113.7");
  assert.equal(normalizeClientIp(" 203.0.113.7 , 10.0.0.1"), "203.0.113.7");
  assert.equal(normalizeClientIp("203.0.113.7:51234"), "203.0.113.7");
  assert.equal(normalizeClientIp("::ffff:203.0.113.7"), "203.0.113.7", "IPv4-mapped IPv6");
});

test("client IP: IPv6 reduced to its /64", () => {
  assert.equal(normalizeClientIp("2001:db8:1:2:3:4:5:6"), "2001:0db8:0001:0002::/64");
  assert.equal(normalizeClientIp("2001:DB8:1:2::abcd"), "2001:0db8:0001:0002::/64", "same /64, other host");
  assert.equal(normalizeClientIp("[2001:db8:1:2::1]:443"), "2001:0db8:0001:0002::/64");
  assert.equal(normalizeClientIp("2001:db8::1"), "2001:0db8:0000:0000::/64");
  assert.equal(normalizeClientIp("fe80::1%eth0"), "fe80:0000:0000:0000::/64");
  assert.equal(normalizeClientIp("::1"), "0000:0000:0000:0000::/64");
  assert.equal(normalizeClientIp("64:ff9b::192.0.2.1"), "0064:ff9b:0000:0000::/64");
});

test("client IP: absent or not an address -> null", () => {
  for (const bad of [null, undefined, "", "unknown", "example.com", "1.2.3", "999.1.1.1", "2001:db8:::1", "<script>", "1.2.3.4.5"])
    assert.equal(normalizeClientIp(bad), null, String(bad));
});

test("client key: keyed hash, 64 hex, stable, secret-dependent, never the raw IP", () => {
  const a = hashClientKey("203.0.113.7", "secret-one");
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(hashClientKey("203.0.113.7", "secret-one"), a);
  assert.notEqual(hashClientKey("203.0.113.8", "secret-one"), a);
  assert.notEqual(hashClientKey("203.0.113.7", "secret-two"), a);
  assert.ok(!a.includes("203"));
});
