// Level 1 QA: scan tracked and untracked (not ignored) files for committed credentials.
//
// Usage: node scripts/qa/secret-scan.mjs
// Reports file:line and the pattern name only -- never the matched value. A line that must contain a
// credential-shaped fake (a test fixture) carries the marker "qa-secret-scan: allow".
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const PATTERNS = [
  ["JWT (e.g. a Supabase anon or service-role key)", /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ["Supabase secret key", /\bsb_secret_[A-Za-z0-9_-]{20,}/],
  ["Supabase personal access token", /\bsbp_[0-9a-f]{40}\b/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["database URL with a password (non-local host)", /postgres(?:ql)?:\/\/[^\s:@/"'`]+:(?!\[|\$|<|\*)[^\s@/"'`]{3,}@(?!127\.0\.0\.1|localhost|\[|\$|<)/],
  ["Cloudflare API token assignment", /CLOUDFLARE_API_TOKEN["']?\s*[:=]\s*["']?[A-Za-z0-9_-]{30,}/],
  ["Cloudflare Access client secret assignment", /CF[-_]ACCESS[-_]CLIENT[-_]SECRET["']?\s*[:=]\s*["']?[a-f0-9]{40,}/i],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
];
const SKIP = /(^|\/)(package-lock\.json|node_modules\/)|\.(png|jpe?g|webp|gif|ico|woff2?|pdf)$/i;

const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { encoding: "utf8" }).split("\n").filter(Boolean).filter((f) => !SKIP.test(f));
const findings = [];
for (const file of files) {
  let text;
  try { if (statSync(file).size > 2_000_000) continue; text = readFileSync(file, "utf8"); } catch { continue; }
  text.split("\n").forEach((line, i) => {
    if (line.includes("qa-secret-scan: allow")) return;
    for (const [name, re] of PATTERNS) if (re.test(line)) findings.push(`${file}:${i + 1}  ${name}`);
  });
}
if (findings.length) {
  console.error(`secret scan: ${findings.length} finding(s) (values not shown):`);
  for (const f of findings) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`secret scan: ${files.length} files, no credential patterns found.`);
