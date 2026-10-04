import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDate,
  parseOptionalUrl,
  parsePriceBdt,
  parseOptionalPositiveInt,
  parseRequiredText,
  cleanMultiline,
} from "../../lib/validation.ts";

test("parseDate accepts real calendar dates only", () => {
  assert.deepEqual(parseDate("2026-10-04"), { ok: true, value: "2026-10-04" });
  assert.equal(parseDate("2026-02-30").ok, false);
  assert.equal(parseDate("04/10/2026").ok, false);
  assert.equal(parseDate("").ok, false);
});

test("parseOptionalUrl matches the linkedin_url check", () => {
  assert.deepEqual(parseOptionalUrl(""), { ok: true, value: null });
  assert.equal(parseOptionalUrl("https://www.linkedin.com/posts/x").ok, true);
  assert.equal(parseOptionalUrl("javascript:alert(1)").ok, false);
  assert.equal(parseOptionalUrl("linkedin.com/x").ok, false);
});

test("parsePriceBdt fits numeric(10,2) and treats blank as unset (0)", () => {
  assert.deepEqual(parsePriceBdt(""), { ok: true, value: 0 });
  assert.deepEqual(parsePriceBdt("1,500"), { ok: true, value: 1500 });
  assert.deepEqual(parsePriceBdt("1500.5"), { ok: true, value: 1500.5 });
  assert.equal(parsePriceBdt("1500.555").ok, false);
  assert.equal(parsePriceBdt("-1").ok, false);
  assert.equal(parsePriceBdt("123456789").ok, false);
  assert.equal(parsePriceBdt("abc").ok, false);
});

test("parseOptionalPositiveInt matches page_count > 0", () => {
  assert.deepEqual(parseOptionalPositiveInt("", "page count", 5000), { ok: true, value: null });
  assert.deepEqual(parseOptionalPositiveInt("42", "page count", 5000), { ok: true, value: 42 });
  assert.equal(parseOptionalPositiveInt("0", "page count", 5000).ok, false);
  assert.equal(parseOptionalPositiveInt("4.5", "page count", 5000).ok, false);
});

test("text cleaning", () => {
  assert.deepEqual(parseRequiredText("  Two   spaces ", "title", 200), { ok: true, value: "Two spaces" });
  assert.equal(parseRequiredText("   ", "title", 200).ok, false);
  assert.equal(cleanMultiline("a  \r\n\r\nb\t\n"), "a\n\nb");
});
