import { test } from "node:test";
import assert from "node:assert/strict";
import { coverSlidePath } from "../../lib/analysis-cover.ts";

test("the cover is the slide with the lowest position, regardless of order", () => {
  assert.equal(coverSlidePath([{ position: 2, storage_path: "c" }, { position: 0, storage_path: "a" }, { position: 1, storage_path: "b" }]), "a");
});

test("no slides or unusable slides -> null (typographic cover)", () => {
  assert.equal(coverSlidePath([]), null);
  assert.equal(coverSlidePath(null), null);
  assert.equal(coverSlidePath(undefined), null);
  assert.equal(coverSlidePath([{ position: 0, storage_path: "  " }]), null);
  assert.equal(coverSlidePath([{ position: 0, storage_path: null }, { position: 3, storage_path: "d" }]), "d");
});
