// Worker bundle-size check (Stage 05E-B2B). Run after `npm run build:vinext`.
//
// Usage: node scripts/staging/bundle-size.mjs [--budget-kib 5120] [--summary <file>]
// Gzips the built Worker modules (.cloudflare/output/v0/workers/default/bundle: .js/.mjs/.wasm)
// and fails if the total exceeds the budget. Cloudflare Workers Paid allows 10 MiB gzip; the
// 5 MiB default budget keeps headroom and catches dependency bloat early (larger bundles also
// slow cold starts). Static assets are served by Workers Static Assets and do not count.
import { readdirSync, readFileSync, appendFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const BUDGET_KIB = Number(opt("budget-kib", 5120));
const PAID_LIMIT_KIB = 10240;
const dir = ".cloudflare/output/v0/workers/default/bundle";

const files = [];
const walk = (d) => { for (const name of readdirSync(d)) { const p = join(d, name); if (statSync(p).isDirectory()) walk(p); else if (/\.(m?js|wasm)$/.test(name)) files.push(p); } };
try { walk(dir); } catch { console.error(`bundle-size: ${dir} not found (run the vinext build first)`); process.exit(2); }
if (!files.length) { console.error("bundle-size: no Worker modules found"); process.exit(2); }

const raw = files.reduce((s, f) => s + statSync(f).size, 0);
const gz = gzipSync(Buffer.concat(files.map((f) => readFileSync(f))), { level: 9 }).length;
const kib = (n) => Math.round(n / 1024);
const ok = Number.isFinite(BUDGET_KIB) && BUDGET_KIB > 0 && BUDGET_KIB <= PAID_LIMIT_KIB && kib(gz) <= BUDGET_KIB;
const line = `Worker bundle: ${files.length} modules, ${kib(raw)} KiB raw, ${kib(gz)} KiB gzip (budget ${BUDGET_KIB} KiB; Paid limit ${PAID_LIMIT_KIB} KiB) — ${ok ? "OK" : "OVER BUDGET"}`;
console.log(line);
const summary = opt("summary", null);
if (summary) appendFileSync(summary, `${line}\n`);
process.exit(ok ? 0 : 1);
