import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// vinext's next/image (the Cloudflare build) sets objectFit: "cover" inline on `fill` images, which beats
// an object-contain class and crops the image. Every fill image meant to be shown whole must therefore
// set objectFit: "contain" inline as well. scripts/qa/image-fit-probe.mjs checks the computed result in
// a browser on the Worker; this catches a new component that forgets it.
const root = new URL("../../", import.meta.url);
const files = (dir) =>
  readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(`${dir}${e.name}/`) : e.name.endsWith(".tsx") ? [`${dir}${e.name}`] : [],
  );

test("every fill <Image> drawn with object-contain sets objectFit: contain inline", () => {
  const offenders = [];
  let checked = 0;
  for (const file of [...files("components/"), ...files("app/")]) {
    const src = readFileSync(new URL(file, root), "utf8");
    for (const [element] of src.matchAll(/<Image\b[\s\S]*?\/>/g)) {
      if (!/\bfill\b/.test(element) || !/\bobject-contain\b/.test(element)) continue;
      checked += 1;
      if (!/style=\{\{[^}]*objectFit:\s*"contain"/.test(element)) offenders.push(file);
    }
  }
  assert.ok(checked >= 3, `expected the Analysis viewer, Analysis cover and Case Study cover (found ${checked})`);
  assert.deepEqual(offenders, []);
});

test("Analysis cards use the 4:5 slide frame with the title beneath, not over the image", () => {
  const card = readFileSync(new URL("components/analysis/analysis-card.tsx", root), "utf8");
  assert.match(card, /aspect-\[4\/5\]/);
  assert.doesNotMatch(card, /aspect-\[9\/16\]/);
  assert.doesNotMatch(card, /bg-gradient-to-t/, "no gradient laid over the slide");
  assert.doesNotMatch(card, /<h3[^>]*absolute/, "the title is not positioned over the image");
});
