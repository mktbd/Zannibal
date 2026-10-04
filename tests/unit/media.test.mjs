import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateImageFile,
  newAnalysisSlidePath,
  newCaseStudyCoverPath,
  isAnalysisSlidePath,
  isCaseStudyCoverPath,
  MEDIA_MAX_BYTES,
} from "../../lib/media.ts";

const A = "11111111-2222-4333-8444-555555555555";
const B = "99999999-2222-4333-8444-555555555555";

test("validateImageFile enforces the bucket's types and 5 MB limit", () => {
  assert.equal(validateImageFile({ name: "a.png", type: "image/png", size: 1000 }), null);
  assert.equal(validateImageFile({ name: "a.webp", type: "image/webp", size: MEDIA_MAX_BYTES }), null);
  assert.match(validateImageFile({ name: "a.gif", type: "image/gif", size: 10 }), /not a JPEG, PNG or WebP/);
  assert.match(validateImageFile({ name: "b.jpg", type: "image/jpeg", size: MEDIA_MAX_BYTES + 1 }), /at most 5 MB/);
  assert.match(validateImageFile({ name: "c.jpg", type: "image/jpeg", size: 0 }), /empty/);
});

test("generated paths are collision-resistant and owned by their record", () => {
  const slide = newAnalysisSlidePath(A, "image/png");
  assert.match(slide, new RegExp(`^analysis/${A}/[0-9a-f-]{36}\\.png$`));
  assert.notEqual(slide, newAnalysisSlidePath(A, "image/png"));
  assert.equal(isAnalysisSlidePath(A, slide), true);
  assert.equal(isAnalysisSlidePath(B, slide), false, "another analysis cannot claim it");

  const cover = newCaseStudyCoverPath(A, "image/jpeg");
  assert.match(cover, new RegExp(`^case-studies/${A}/cover-[0-9a-f-]{36}\\.jpg$`));
  assert.equal(isCaseStudyCoverPath(A, cover), true);
  assert.equal(isCaseStudyCoverPath(B, cover), false);
});

test("path checks reject traversal and foreign prefixes", () => {
  assert.equal(isAnalysisSlidePath(A, `analysis/${A}/../${B}/x.png`), false);
  assert.equal(isAnalysisSlidePath(A, `case-studies/${A}/cover-${A}.png`), false);
  assert.equal(isAnalysisSlidePath(A, `analysis/${A}/${A}.gif`), false);
});
