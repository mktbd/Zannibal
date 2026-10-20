// Level 2 QA: uncropped images on the Cloudflare (vinext) build. Read-only, against the local Worker and the
// seeded fixtures (1080x1350 Analysis slides, 2400x1600 Case Study covers).
//
// Usage: node scripts/qa/image-fit-probe.mjs <base> --out result.json [--shots <dir>]   (run by scripts/qa/local.sh)
//
// vinext's next/image sets objectFit: "cover" inline on `fill` images, which beats an object-contain class,
// so the components set it inline too. This checks the COMPUTED object-fit in the browser (not the
// class), and the geometry that follows from it, at desktop, tablet and mobile sizes:
//   - Analysis cards (homepage, archive): object-fit contain, 4:5 frame, whole slide inside the frame, the
//     title beneath the image (not over it), no horizontal page overflow;
//   - Analysis viewer: object-fit contain, the whole slide inside the viewport and its stage, clear of the
//     previous/next, close and counter controls, before and after moving to the next slide;
//   - Case Study covers (catalogue, product page): object-fit contain, the whole cover inside its frame at
//     its own proportions.
// Writes nothing. Refuses anything but a local Worker.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const BASE = (args[0] || "").replace(/\/$/, "");
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;
const SHOTS = args.includes("--shots") ? args[args.indexOf("--shots") + 1] : null;
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(BASE)) { console.error("REFUSED: the target is not a local Worker (http://127.0.0.1:<port>)."); process.exit(97); }
const loadPlaywright = async () => { try { return await import("playwright"); } catch { return createRequire(execSync("npm root -g").toString().trim() + "/")("playwright"); } };

const ANALYSIS = "staging-analysis-1"; // seeded: 3 slides, 1080x1350
const CASE_STUDY = "staging-case-study-1"; // seeded: 2400x1600 cover in a 3:4 frame
const VIEWPORTS = [
  ["desktop 1920x1080", 1920, 1080, false],
  ["desktop 1440x900", 1440, 900, false],
  ["tablet 768x1024", 768, 1024, true],
  ["mobile 390x844", 390, 844, true],
  ["mobile 320x568", 320, 568, true],
];
const rows = [];
const check = (area, viewport, operation, ok, detail = "") => {
  rows.push({ area, viewport, operation, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${area} @ ${viewport}] ${operation}${detail ? ` — ${detail}` : ""}`);
};

// In the page: the rectangle an <img> actually paints, from its computed object-fit (contain or cover;
// anything else is reported as is), and the element's own box.
const PAINTED = (img) => {
  const b = img.getBoundingClientRect();
  const fit = getComputedStyle(img).objectFit;
  const s = (fit === "cover" ? Math.max : Math.min)(b.width / img.naturalWidth, b.height / img.naturalHeight);
  const w = img.naturalWidth * s, h = img.naturalHeight * s;
  const l = b.left + (b.width - w) / 2, t = b.top + (b.height - h) / 2;
  return { fit, box: { l: b.left, t: b.top, r: b.right, b: b.bottom }, painted: { l, t, r: l + w, b: t + h }, natural: [img.naturalWidth, img.naturalHeight] };
};
const within = (a, b, eps = 0.75) => a.l >= b.l - eps && a.t >= b.t - eps && a.r <= b.r + eps && a.b <= b.b + eps;
const overlaps = (a, b) => !!a && !!b && !(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b);
const fmt = (r) => `${Math.round(r.r - r.l)}x${Math.round(r.b - r.t)} at ${Math.round(r.l)},${Math.round(r.t)}`;

async function loaded(page, selector) {
  const img = page.locator(selector).first();
  await img.waitFor({ timeout: 20000 });
  await img.scrollIntoViewIfNeeded();
  await page.waitForFunction((sel) => { const i = document.querySelector(sel); return !!i && i.complete && i.naturalWidth > 0; }, selector, { timeout: 20000 });
  return img;
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** Screenshot (evidence only) once transitions such as the viewer's fade-in have finished. */
async function shot(page, name, locator = null) {
  if (!SHOTS) return;
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})))).catch(() => {});
  await (locator ?? page).screenshot({ path: `${SHOTS}/${name}.png` });
}

async function analysisCard(page, vp, label, path) {
  await page.goto(BASE + path, { waitUntil: "load" });
  const sel = `a[href="/analysis/${ANALYSIS}"] img`;
  const img = await loaded(page, sel);
  const m = await img.evaluate((el) => {
    const p = window.__painted(el); const frame = el.parentElement.getBoundingClientRect(); const title = el.closest("a").querySelector("h3").getBoundingClientRect();
    return { ...p, frame: { l: frame.left, t: frame.top, r: frame.right, b: frame.bottom }, titleTop: title.top };
  });
  const ratio = (m.frame.r - m.frame.l) / (m.frame.b - m.frame.t);
  check(label, vp, "computed object-fit is contain", m.fit === "contain", `object-fit: ${m.fit}`);
  check(label, vp, "4:5 frame; the whole slide painted inside it", Math.abs(ratio - 0.8) < 0.01 && within(m.painted, m.frame), `frame ratio ${ratio.toFixed(3)}, slide ${fmt(m.painted)} in frame ${fmt(m.frame)}`);
  check(label, vp, "title beneath the image, not over it", m.titleTop >= m.frame.b - 0.5, `title top ${Math.round(m.titleTop)}, frame bottom ${Math.round(m.frame.b)}`);
  const ox = await noOverflow(page);
  check(label, vp, "no horizontal page overflow", ox <= 0, `${ox}px`);
}

async function viewer(page, vp, desktopNav) {
  await page.goto(`${BASE}/analysis/${ANALYSIS}`, { waitUntil: "load" });
  const measure = async () => {
    await page.waitForFunction(() => { const t = document.querySelector("dialog[open] [aria-roledescription=carousel]"); if (!t) return false; const i = t.querySelectorAll("img")[Math.round(t.scrollLeft / t.clientWidth)]; return !!i && i.complete && i.naturalWidth > 0; }, null, { timeout: 20000 });
    return page.evaluate(() => {
      const dlg = document.querySelector("dialog[open]"); const track = dlg.querySelector("[aria-roledescription=carousel]");
      const index = Math.round(track.scrollLeft / track.clientWidth); const p = window.__painted(track.querySelectorAll("img")[index]);
      const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return b.width ? { l: b.left, t: b.top, r: b.right, b: b.bottom } : null; };
      const s = track.parentElement.getBoundingClientRect();
      return { ...p, index, stage: { l: s.left, t: s.top, r: s.right, b: s.bottom }, vp: { l: 0, t: 0, r: innerWidth, b: innerHeight },
        controls: { previous: r(dlg.querySelector("[aria-label='Previous slide']")), next: r(dlg.querySelector("[aria-label='Next slide']")), close: r(dlg.querySelector("[data-close]")), counter: r(dlg.querySelector("p[aria-hidden=true]")) },
        counter: dlg.querySelector("p[aria-hidden=true]")?.textContent ?? "" };
    });
  };
  const verify = (m, when) => {
    check("viewer", vp, `${when}: computed object-fit is contain`, m.fit === "contain", `object-fit: ${m.fit}`);
    check("viewer", vp, `${when}: whole slide inside the viewport and the stage`, within(m.painted, m.vp) && within(m.painted, m.stage), `slide ${fmt(m.painted)}, stage ${fmt(m.stage)}, viewport ${m.vp.r}x${m.vp.b}`);
    const hits = Object.entries(m.controls).filter(([, c]) => overlaps(c, m.painted)).map(([k]) => k);
    check("viewer", vp, `${when}: no control overlaps the slide`, hits.length === 0, hits.length ? `overlaps ${hits.join(", ")}` : "");
  };
  const first = await measure();
  verify(first, "slide 1");
  await shot(page, `viewer ${vp}`.replace(/\W+/g, "-"));
  if (desktopNav) await page.getByRole("button", { name: "Next slide" }).click();
  else await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => { const t = document.querySelector("dialog[open] [aria-roledescription=carousel]"); return t && Math.abs(t.scrollLeft - t.clientWidth) < 2; }, null, { timeout: 10000 }).catch(() => {});
  const second = await measure();
  check("viewer", vp, `${desktopNav ? "Next button" : "→ key"} moves to slide 2 and the counter follows`, second.index === 1 && second.counter.trim() === "2 / 3", `index ${second.index}, counter "${second.counter}"`);
  verify(second, "slide 2");
  const ox = await noOverflow(page);
  check("viewer", vp, "no horizontal page overflow", ox <= 0, `${ox}px`);
}

async function caseStudyCover(page, vp, label, path, selector) {
  await page.goto(BASE + path, { waitUntil: "load" });
  const img = await loaded(page, selector);
  const m = await img.evaluate((el) => { const p = window.__painted(el); const f = el.parentElement.getBoundingClientRect(); return { ...p, frame: { l: f.left, t: f.top, r: f.right, b: f.bottom } }; });
  check(label, vp, "computed object-fit is contain", m.fit === "contain", `object-fit: ${m.fit}`);
  check(label, vp, "whole cover painted inside its frame", within(m.painted, m.frame), `cover ${fmt(m.painted)} (natural ${m.natural.join("x")}) in frame ${fmt(m.frame)}`);
}

let setupFailed = null, browser;
try {
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const { chromium } = await loadPlaywright();
  browser = await chromium.launch();
  for (const [vp, width, height, touch] of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: touch ? 2 : 1, isMobile: touch && width < 768, hasTouch: touch });
    await context.addInitScript(`window.__painted = ${PAINTED.toString()};`);
    const page = await context.newPage();
    try {
      await analysisCard(page, vp, "homepage card", "/");
      await shot(page, `home ${vp}`.replace(/\W+/g, "-"), page.locator("section[aria-labelledby=latest-heading]"));
      await analysisCard(page, vp, "archive card", "/analysis");
      await shot(page, `archive ${vp}`.replace(/\W+/g, "-"), page.locator(".grid > *").filter({ has: page.locator(`a[href="/analysis/${ANALYSIS}"]`) }).first());
      await viewer(page, vp, width >= 768);
      await caseStudyCover(page, vp, "case study cover (catalogue)", "/case-studies", `article:has(a[href="/case-studies/${CASE_STUDY}"]) img`);
      await caseStudyCover(page, vp, "case study cover (product page)", `/case-studies/${CASE_STUDY}`, "main img");
    } catch (e) {
      check("probe", vp, "completed", false, `aborted (${e?.name || "Error"}: ${String(e?.message || "").split("\n")[0].slice(0, 120)})`);
    }
    await context.close();
  }
} catch (e) { setupFailed = e.message.split("\n")[0]; }
try { if (browser) await browser.close(); } catch {}

if (setupFailed) console.log(`SETUP FAILED: ${setupFailed} (no image-fit result; this is not a pass)`);
const failed = rows.filter((r) => !r.ok);
console.log(`\nImage-fit probes: ${rows.length - failed.length} passed, ${failed.length} failed${setupFailed ? ", setup failed" : ""}`);
if (OUT) writeFileSync(OUT, JSON.stringify({ setupFailed, rows, failed: failed.map((r) => `[${r.area} @ ${r.viewport}] ${r.operation}`) }, null, 2));
process.exit(setupFailed ? 3 : failed.length ? 1 : 0);
