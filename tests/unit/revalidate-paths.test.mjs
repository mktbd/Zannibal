import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Every revalidatePath() call with a route pattern must name a real route file, route groups
// included, and must invalidate that route's cached pages under vinext (the cache tags are built
// from the route pattern, groups included; Next 16 documents the same rule). Without the group the
// call is silently a no-op: CMS edits to Analysis, Article and Case Study detail pages stayed stale
// until the ISR window expired (Stage 05E-B2, staging run #17).
const root = fileURLToPath(new URL("../../", import.meta.url));
const app = join(root, "app");
// vinext is pinned exactly; this internal module builds the tags a cached App Router page carries.
const { buildAppPageTags } = await import(new URL("../../node_modules/vinext/dist/server/implicit-tags.js", import.meta.url));
const { encodeCacheTag } = await import(new URL("../../node_modules/vinext/dist/utils/encode-cache-tag.js", import.meta.url));

// Known no-op calls on dynamic admin pages (never cached, so harmless). Listed so new ones fail;
// fixing these is an application change awaiting separate approval.
const KNOWN_NOOP = new Set([
  'app/admin/(dashboard)/analysis/actions.ts revalidatePath("/admin/articles/[id]/edit", "page")',
  'app/admin/(dashboard)/articles/actions.ts revalidatePath("/admin/analysis/[id]/edit", "page")',
]);

const files = [];
const walk = (dir) => { for (const name of readdirSync(dir)) { const p = join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(name)) files.push(p); } };
walk(app);
const calls = files.flatMap((file) => [...readFileSync(file, "utf8").matchAll(/revalidatePath\(\s*"([^"]+)"\s*(?:,\s*"(page|layout)"\s*)?\)/g)].map((m) => ({ file: relative(root, file), path: m[1], type: m[2] })));
const label = (c) => `${c.file} revalidatePath("${c.path}"${c.type ? `, "${c.type}"` : ""})`;
const routeFile = (p, type) => ["tsx", "ts", "jsx", "js"].map((ext) => join(app, p, `${type}.${ext}`)).find(existsSync);
// Public URL of a route file path: route groups and parallel-route slots are not URL segments.
const urlOf = (segments) => "/" + segments.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith("@")).join("/");
const routes = files.filter((f) => /\/(page|route)\.(t|j)sx?$/.test(f)).map((f) => relative(app, f).split("/").slice(0, -1));

test("the scan finds the CMS revalidation calls", () => {
  assert.ok(calls.filter((c) => c.type).length >= 5, "expected the route-pattern calls of the CMS actions");
});

test("every route-pattern revalidatePath names a real route file (route groups included)", () => {
  const bad = calls.filter((c) => c.type && !KNOWN_NOOP.has(label(c)) && !routeFile(c.path, c.type));
  assert.deepEqual(bad.map(label), []);
});

test("every route-pattern page revalidation invalidates that route's cached pages under vinext", () => {
  for (const c of calls.filter((x) => x.type === "page" && !KNOWN_NOOP.has(label(x)))) {
    const segments = c.path.split("/").filter(Boolean);
    const concrete = urlOf(segments.map((s) => s.replace(/^\[+\.*([^\]]+)\]+$/, "sample-$1")));
    const pageTags = buildAppPageTags(concrete, [], segments);
    assert.ok(pageTags.includes(encodeCacheTag(`_N_T_${c.path}/page`)), `${label(c)} does not match the tags of ${concrete}`);
  }
});

test("every literal revalidatePath names an existing route", () => {
  const urls = new Set(routes.map(urlOf).map((u) => (u === "/" ? "/" : u.replace(/\/$/, ""))));
  // Metadata routes (app/sitemap.ts -> /sitemap.xml, app/robots.ts -> /robots.txt).
  for (const f of readdirSync(app)) { const m = f.match(/^(sitemap|robots)\.(t|j)s$/); if (m) urls.add(m[1] === "sitemap" ? "/sitemap.xml" : "/robots.txt"); }
  const bad = calls.filter((c) => !c.type && !urls.has(c.path));
  assert.deepEqual(bad.map(label), []);
});

test("the known no-op list only holds calls that still exist", () => {
  const present = new Set(calls.map(label));
  for (const k of KNOWN_NOOP) assert.ok(present.has(k), `stale KNOWN_NOOP entry: ${k}`);
});
