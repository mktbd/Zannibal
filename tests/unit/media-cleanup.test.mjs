import { test } from "node:test";
import assert from "node:assert/strict";
import { selectStaleMedia } from "../../lib/media-cleanup.ts";
import { isArticleCoverPath, isArticleImagePath } from "../../lib/media.ts";

const ID = "11111111-2222-4333-8444-555555555555";
const U = (n) => `aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, "0")}`;
const cover = (n) => `articles/${ID}/cover-${U(n)}.jpg`;
const image = (n) => `articles/${ID}/image-${U(n)}.png`;
const NOW = Date.parse("2026-10-08T12:00:00Z");
const ago = (minutes) => new Date(NOW - minutes * 60_000).toISOString();
const owned = (path) => isArticleCoverPath(ID, path) || isArticleImagePath(ID, path);
const opts = (previouslyReferenced = []) => ({ isOwnedPath: owned, minAgeMs: 60 * 60_000, previouslyReferenced });

test("referenced objects are never selected", () => {
  const objects = [{ path: cover(1), createdAt: ago(600) }, { path: image(2), createdAt: ago(600) }];
  assert.deepEqual(selectStaleMedia(objects, [cover(1), image(2)], opts([cover(1), image(2)]), NOW), []);
});

test("replaced cover and removed image (referenced before this save) go immediately, even if fresh", () => {
  const objects = [
    { path: cover(1), createdAt: ago(1) }, // old cover, replaced
    { path: cover(3), createdAt: ago(1) }, // new cover, kept
    { path: image(2), createdAt: ago(1) }, // removed from the body
  ];
  assert.deepEqual(selectStaleMedia(objects, [cover(3)], opts([cover(1), image(2)]), NOW).sort(), [cover(1), image(2)].sort());
});

test("never-saved uploads: kept while fresh (another editor may still save them), swept once old", () => {
  const objects = [{ path: image(5), createdAt: ago(10) }, { path: image(6), createdAt: ago(61) }, { path: image(7), createdAt: null }];
  assert.deepEqual(selectStaleMedia(objects, [], opts(), NOW), [image(6)]);
});

test("only this Article's own cover-/image- names can be deleted", () => {
  const OTHER = "99999999-2222-4333-8444-555555555555";
  const objects = [
    { path: `articles/${OTHER}/image-${U(1)}.png`, createdAt: ago(600) },
    { path: `analysis/${ID}/${U(1)}.png`, createdAt: ago(600) },
    { path: `case-studies/${ID}/cover-${U(1)}.png`, createdAt: ago(600) },
    { path: `articles/${ID}/notes.txt`, createdAt: ago(600) },
    { path: image(9), createdAt: ago(600) },
  ];
  assert.deepEqual(selectStaleMedia(objects, [], opts(), NOW), [image(9)]);
});

test("without options the behaviour is unchanged (Analysis / Case Study cleanup)", () => {
  const objects = [{ path: "analysis/x/a.png", createdAt: ago(0) }, { path: "analysis/x/b.png", createdAt: null }];
  assert.deepEqual(selectStaleMedia(objects, ["analysis/x/a.png"]), ["analysis/x/b.png"]);
});
