import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, validateSlug, SLUG_PATTERN } from "../../lib/slug.ts";

test("slugify produces the database slug format", () => {
  assert.equal(slugify("How bKash Won Bangladesh"), "how-bkash-won-bangladesh");
  assert.equal(slugify("Grameenphone's Rural Bet"), "grameenphones-rural-bet");
  assert.equal(slugify("  F&B  in   Dhaka!! "), "f-and-b-in-dhaka");
  assert.equal(slugify("Café — Señor"), "cafe-senor");
  assert.equal(slugify("---"), "");
  for (const input of ["A  B", "x/y\\z", "2026: The Year", "émoji 🚀 test"]) {
    const slug = slugify(input);
    assert.match(slug, SLUG_PATTERN, `${input} -> ${slug}`);
  }
});

test("slugify caps length without a trailing hyphen", () => {
  const slug = slugify("word ".repeat(40));
  assert.ok(slug.length <= 80);
  assert.ok(!slug.endsWith("-"));
});

test("validateSlug mirrors analyses_slug_format", () => {
  assert.equal(validateSlug("valid-slug-2026"), null);
  assert.notEqual(validateSlug(""), null);
  assert.notEqual(validateSlug("Bad-Slug"), null);
  assert.notEqual(validateSlug("double--hyphen"), null);
  assert.notEqual(validateSlug("-leading"), null);
});
