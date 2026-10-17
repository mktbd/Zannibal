// TEMPORARY (Stage 05E-B2F): read-only connection diagnostic for the STAGING database.
// Remove together with the `diagnose-staging-db` workflow mode once `migrate-staging` has succeeded.
//
// Runs in the `db-diagnose` job (environment staging-db) with STAGING_DB_URL, PRODUCTION_REF,
// STAGING_REF_CONFIRM and STAGING_SUPABASE_URL. It:
//   1. proves the target is the staging project exactly as the migrate gate does (checkRefs: typed ref =
//      URL ref = database-URL ref, different from production, no production credential names);
//   2. masks the decoded password, host and username in the GitHub log before doing anything else;
//   3. prints yes/no structure checks and layered probes (DNS -> TCP -> TLS + login + SELECT 1);
//   4. connects only with TLS required (sslmode=require; no unencrypted fallback) and sends only `select 1`.
// Output: fixed status words and at most one sanitized category. Never the URL, password, host, username
// or raw error text (psql's stderr is captured and only classified).
import { lookup } from "node:dns/promises";
import net from "node:net";
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { checkRefs, fail } from "./isolation.mjs";

/** Map psql's stderr (never printed) to one fixed category. Order matters: most specific first. */
export function classifyPsqlError(stderr) {
  const s = String(stderr || "");
  if (/could not translate host name|Name or service not known|nodename nor servname/i.test(s)) return "DNS";
  if (/SSL|certificate|server does not support SSL|tls/i.test(s) && !/password authentication failed/i.test(s)) return "TLS";
  if (/password authentication failed|invalid password|SASL authentication failed/i.test(s)) return "authentication";
  if (/tenant or user not found|no such tenant|tenant.*not found|database ".*" does not exist|role ".*" does not exist/i.test(s)) return "pooler configuration";
  if (/invalid percent-encoded token|invalid URI|invalid connection option|missing "=" after|invalid integer value/i.test(s)) return "connection string format";
  if (/Connection refused|timeout expired|timed out|Network is unreachable|No route to host|server closed the connection unexpectedly|Connection reset/i.test(s)) return "network";
  if (/^\s*ERROR:/m.test(s)) return "SQL";
  if (/FATAL:/i.test(s)) return "pooler configuration";
  return "unknown";
}

const inGitHub = process.env.GITHUB_ACTIONS === "true";
const lines = [];
const say = (line) => { lines.push(line); process.stdout.write(`${line}\n`); };
function done(ok, category) {
  say(ok ? "RESULT: SUCCESS — TLS login through the pooler worked and SELECT 1 returned 1." : `RESULT: FAILED — category: ${category}`);
  if (inGitHub && process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Staging database diagnostic\n\n\`\`\`\n${lines.join("\n")}\n\`\`\`\n`);
  process.exit(ok ? 0 : 1);
}

async function main() {
  const env = process.env;
  const ref = checkRefs(env, { requireDb: true }); // exits 97 unless provably the staging project

  const raw = (env.STAGING_DB_URL || "").trim();
  let u, password = "";
  try { u = new URL(raw); } catch { say("structure: not a valid URL"); return done(false, "connection string format"); }
  try { password = decodeURIComponent(u.password); } catch { password = ""; }
  const user = decodeURIComponent(u.username || ""), host = u.hostname, port = Number(u.port || 5432);
  const database = decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres";
  if (inGitHub) for (const v of [password, u.password, host, user]) if (v && v.length >= 3) process.stdout.write(`::add-mask::${v}\n`);

  // Structure checks (yes/no only).
  let escapesOk = true;
  try { decodeURIComponent(u.password); } catch { escapesOk = false; }
  const sslParam = u.searchParams.get("sslmode");
  const checks = [
    ["scheme postgres:// or postgresql://", /^postgres(ql)?:$/.test(u.protocol)],
    ["username is postgres.<staging ref>", user === `postgres.${ref}`],
    ["host is a Supabase pooler", /\.pooler\.supabase\.com$/.test(host)],
    ["port is 5432 (Session Pooler)", port === 5432],
    ["database name is postgres", database === "postgres"],
    ["password present", password.length > 0],
    ["password %-escapes valid", escapesOk],
    ["no [YOUR-PASSWORD] placeholder or [ ] brackets", !/YOUR-PASSWORD|^\[|\]$/.test(password)],
    ["no whitespace in the stored value", !/\s/.test(env.STAGING_DB_URL || "")],
    ["no sslmode weaker than require in the URL", !sslParam || ["require", "verify-ca", "verify-full"].includes(sslParam)],
  ];
  for (const [name, ok] of checks) say(`structure: ${ok ? "ok    " : "FAILED"} ${name}`);
  if (!escapesOk) return done(false, "connection string format");
  if (sslParam && !["require", "verify-ca", "verify-full"].includes(sslParam)) return done(false, "connection string format");

  // Layer 1: DNS.
  try { await lookup(host); say("probe: DNS lookup .................. ok"); }
  catch { say("probe: DNS lookup .................. FAILED"); return done(false, "DNS"); }

  // Layer 2: TCP reachability.
  const tcp = await new Promise((resolve) => {
    const s = net.connect({ host, port, timeout: 10000 });
    s.once("connect", () => { s.destroy(); resolve(true); });
    s.once("timeout", () => { s.destroy(); resolve(false); });
    s.once("error", () => resolve(false));
  });
  say(`probe: TCP connect ................. ${tcp ? "ok" : "FAILED"}`);
  if (!tcp) return done(false, "network");

  // Layer 3: TLS required + login + the single read-only statement. sslmode=require is forced in the URL
  // (overriding any value there) and in the environment; there is no unencrypted fallback.
  const conn = new URL(raw);
  conn.searchParams.set("sslmode", "require");
  const r = spawnSync("psql", [conn.href, "-X", "-q", "-tA", "-v", "ON_ERROR_STOP=1", "-c", "select 1"], {
    encoding: "utf8",
    timeout: 30000,
    env: { PATH: env.PATH, HOME: env.HOME, PGSSLMODE: "require", PGCONNECT_TIMEOUT: "10", PGAPPNAME: "mktbd-staging-diagnose" },
  });
  if (r.error && r.error.code === "ENOENT") { say("probe: psql client .................. MISSING"); return done(false, "client missing"); }
  if (r.status === 0 && (r.stdout || "").trim() === "1") {
    say("probe: TLS + login + SELECT 1 ....... ok");
    return done(true);
  }
  const category = r.error ? "network" : classifyPsqlError(r.stderr);
  say("probe: TLS + login + SELECT 1 ....... FAILED");
  return done(false, category);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main().catch(() => fail("diagnostic error (details withheld)."));
