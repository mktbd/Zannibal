import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ORDER_BODY_BYTES,
  ORDER_FIELD_LIMITS,
  formatMobileNumber,
  parseBkashNumber,
  parseCustomerName,
  parseEmail,
  parseOrderRequest,
  parseTransactionNumber,
  samePrice,
  validateOrderField,
} from "../../lib/order-input.ts";

const ok = (result) => (result.ok ? result.value : `ERR: ${result.error}`);

test("customer name: trimmed, inner whitespace collapsed; empty or letterless rejected; length capped", () => {
  assert.equal(ok(parseCustomerName("  Nusrat   Jahan \n")), "Nusrat Jahan");
  assert.equal(ok(parseCustomerName("নুসরাত জাহান")), "নুসরাত জাহান");
  for (const bad of ["", "   ", "-", "...", "1", "12345", "A"]) assert.equal(parseCustomerName(bad).ok, false, bad);
  assert.equal(parseCustomerName("a".repeat(ORDER_FIELD_LIMITS.customerName)).ok, true);
  assert.equal(parseCustomerName("a".repeat(ORDER_FIELD_LIMITS.customerName + 1)).ok, false);
  assert.equal(ok(parseCustomerName("<b>Rahim</b>")), "<b>Rahim</b>", "stored as plain text, never interpreted");
});

test("email: reasonable structure; trimmed; spaces, missing domain or TLD rejected", () => {
  assert.equal(ok(parseEmail("  reader@example.com ")), "reader@example.com");
  assert.equal(ok(parseEmail("first.last+tag@mail.example.com.bd")), "first.last+tag@mail.example.com.bd");
  for (const bad of ["", "reader", "reader@", "@example.com", "reader@example", "reader@example.c", "rea der@example.com", "a@b@c.com", "reader@.com", "reader@example..com"])
    assert.equal(parseEmail(bad).ok, false, bad);
  assert.equal(parseEmail(`${"a".repeat(250)}@x.com`).ok, false);
});

test("bKash number: Bangladesh mobile conventions normalised to 01XXXXXXXXX", () => {
  for (const [input, expected] of [
    ["01712345678", "01712345678"],
    [" 01712-345678 ", "01712345678"],
    ["017 1234 5678", "01712345678"],
    ["+8801712345678", "01712345678"],
    ["+880 1712-345678", "01712345678"],
    ["8801912345678", "01912345678"],
    ["(017) 1234-5678", "01712345678"],
    ["০১৭১২৩৪৫৬৭৮", "01712345678"],
  ])
    assert.equal(ok(parseBkashNumber(input)), expected, input);
  for (const bad of ["", "1712345678", "0171234567", "017123456789", "01212345678", "02712345678", "+1 415 555 0100", "01712abc678", "0".repeat(40)])
    assert.equal(parseBkashNumber(bad).ok, false, bad);
});

test("transaction ID: trimmed, letters and digits only, 6-30", () => {
  assert.equal(ok(parseTransactionNumber("  9F6A2B7C1D \t")), "9F6A2B7C1D");
  assert.equal(ok(parseTransactionNumber("abc123")), "ABC123", "upper-cased, like the unique index");
  assert.equal(ok(parseTransactionNumber(" 9f6A2b7C1d ")), "9F6A2B7C1D");
  assert.equal(ok(parseTransactionNumber("৯F৬A২B৭C১D")), "9F6A2B7C1D", "Bangla digits");
  for (const bad of ["", "   ", "ABC12", "9F6A 2B7C1D", "9F6A-2B7C1D", "<script>", "%_%_%_", "A".repeat(31), "abcﬁ12", "ÄBC123"])
    assert.equal(parseTransactionNumber(bad).ok, false, bad);
});

const good = {
  slug: "pathao-super-app",
  expectedPriceBdt: 999,
  customerName: " Test Reader ",
  email: "reader@example.com",
  bkashNumber: "+880 1712-345678",
  transactionNumber: " 9F6A2B7C1D ",
};

test("order request: exact shape required; values normalised", () => {
  const parsed = parseOrderRequest(good);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.value, {
    slug: "pathao-super-app",
    expectedPriceBdt: 999,
    customerName: "Test Reader",
    email: "reader@example.com",
    bkashNumber: "01712345678",
    transactionNumber: "9F6A2B7C1D",
  });
});

test("order request: privileged/unexpected fields, missing fields and wrong types are malformed", () => {
  for (const extra of [{ status: "fulfilled" }, { price_bdt_snapshot: 1 }, { caseStudyTitle: "x" }, { orderNumber: "MKT-1" }, { id: "x" }])
    assert.deepEqual(parseOrderRequest({ ...good, ...extra }), { ok: false, reason: "malformed" }, JSON.stringify(extra));
  const missing = { ...good };
  delete missing.email;
  assert.deepEqual(parseOrderRequest(missing), { ok: false, reason: "malformed" });
  for (const body of [null, "x", 42, [], [good], { ...good, email: 5 }, { ...good, expectedPriceBdt: "999" }, { ...good, expectedPriceBdt: -1 }, { ...good, expectedPriceBdt: Infinity }, { ...good, slug: 3 }, { ...good, customerName: "a".repeat(10_000) }])
    assert.deepEqual(parseOrderRequest(body), { ok: false, reason: "malformed" });
});

test("order request: invalid customer values come back per field without echoing them", () => {
  const parsed = parseOrderRequest({ ...good, customerName: "  ", email: "nope", bkashNumber: "123", transactionNumber: "x y" });
  assert.equal(parsed.ok, false);
  assert.equal(parsed.reason, "invalid");
  assert.deepEqual(Object.keys(parsed.fieldErrors).sort(), ["bkashNumber", "customerName", "email", "transactionNumber"]);
  for (const message of Object.values(parsed.fieldErrors)) assert.ok(!/nope|x y|\b123\b/.test(message), message);
});

test("validateOrderField mirrors the parsers; helpers", () => {
  assert.equal(validateOrderField("email", "reader@example.com"), null);
  assert.match(validateOrderField("email", "x"), /valid email/);
  assert.ok(samePrice(1250.5, 1250.5) && samePrice(999, 999.0) && !samePrice(999, 1000) && !samePrice(1250.5, 1250.51));
  assert.equal(formatMobileNumber("01712345678"), "01712 345678");
  assert.equal(formatMobileNumber("not-a-number"), "not-a-number");
  assert.ok(MAX_ORDER_BODY_BYTES >= 1024 && MAX_ORDER_BODY_BYTES <= 8192);
});
