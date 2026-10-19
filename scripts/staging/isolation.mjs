// Shared isolation checks for the Cloudflare STAGING scripts (Stage 05E-B2A).
//
// Production isolation never rests on variable names alone. Every script
// proves, from content, that it is talking to the disposable staging project:
//   1. the confirmed ref typed at dispatch (STAGING_REF_CONFIRM) equals the ref
//      parsed from the Supabase URL (and from the database URL, when used);
//   2. that ref differs from the production ref (PRODUCTION_REF) -- which must
//      be supplied, so a missing value cannot silently skip the comparison;
//   3. the staging database carries the identity marker written at the first
//      migration (staging_disposable.identity = ref), checked either directly
//      (database URL) or through the anon-callable public.staging_identity().
// Nothing here prints credentials, URLs with secrets, or row data.
import { execFileSync } from "node:child_process";

export const MARKER_PREFIX = "mktbd-staging:";

export function fail(message) {
  console.error(`REFUSED: ${message}`);
  process.exit(97);
}

/** "abc...xyz" from https://abc...xyz.supabase.co, or null. */
export function refFromSupabaseUrl(url) {
  const m = String(url || "").match(/^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/);
  return m ? m[1] : null;
}

/** The project ref in a Supabase Postgres URL (direct db.<ref>.supabase.co or pooler user postgres.<ref>). */
export function refFromDbUrl(dbUrl) {
  const s = String(dbUrl || "");
  const direct = s.match(/@db\.([a-z0-9]{20})\.supabase\.co[:/]/);
  const pooler = s.match(/^postgres(?:ql)?:\/\/postgres\.([a-z0-9]{20}):/);
  return (direct && direct[1]) || (pooler && pooler[1]) || null;
}

/**
 * Checks 1-2. Returns the staging ref. `env` is process.env in practice.
 * `requireDb`: the database URL must be present and agree.
 */
export function checkRefs(env, { requireDb = false } = {}) {
  const confirm = (env.STAGING_REF_CONFIRM || "").trim();
  const production = (env.PRODUCTION_REF || "").trim();
  const urlRef = refFromSupabaseUrl(env.STAGING_SUPABASE_URL);
  if (!/^[a-z0-9]{20}$/.test(confirm)) fail("the staging project ref must be confirmed at dispatch (20 lowercase letters/digits).");
  if (!/^[a-z0-9]{20}$/.test(production)) fail("PRODUCTION_REF is missing or malformed, so staging cannot be proven different from production.");
  if (!urlRef) fail("STAGING_SUPABASE_URL is not an https://<ref>.supabase.co URL.");
  if (urlRef !== confirm) fail("STAGING_SUPABASE_URL does not match the confirmed staging ref.");
  if (confirm === production) fail("the confirmed ref is the PRODUCTION project.");
  if (requireDb || env.STAGING_DB_URL) {
    const dbRef = refFromDbUrl(env.STAGING_DB_URL);
    if (!dbRef) fail("STAGING_DB_URL is missing or not a Supabase database URL.");
    if (dbRef !== confirm) fail("STAGING_DB_URL does not match the confirmed staging ref.");
  }
  refuseProductionCredentials(env);
  return confirm;
}

/** Names the production workflow (supabase-migrate.yml) and the production app use. Staging jobs must never see them. */
export const PRODUCTION_CREDENTIAL_NAMES = ["SUPABASE_DB_PASSWORD", "SUPABASE_ACCESS_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_PROJECT_ID"];

/** Refuses if any production credential name is present in the environment (values are never read or printed). */
export function refuseProductionCredentials(env) {
  for (const name of PRODUCTION_CREDENTIAL_NAMES)
    if (env[name]) fail(`${name} (a production credential name) is set in this job; staging jobs must not receive it.`);
}

/** psql against the staging database; returns trimmed stdout. stderr is captured, never printed (it can name the host/user). */
export function psql(dbUrl, sql) {
  try {
    return execFileSync("psql", [dbUrl, "-X", "-q", "-tA", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    fail("a staging database query failed (connection or SQL error; details withheld).");
  }
}

/** Check 3 (direct): the marker exists and names this ref. */
export function checkMarkerDb(dbUrl, ref) {
  const has = psql(dbUrl, "select count(*) from pg_namespace where nspname = 'staging_disposable'");
  if (has !== "1") fail("the staging database has no staging_disposable marker (run migrate-staging first).");
  const id = psql(dbUrl, "select coalesce(string_agg(ref, ','), '') from staging_disposable.identity");
  if (id !== ref) fail("the staging marker does not match the confirmed ref.");
}

/** Check 3 (anon): the public identity function answers with this ref. */
export async function checkMarkerAnon(supabaseUrl, anonKey, ref) {
  const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/staging_identity`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
    body: "{}",
  }).catch(() => null);
  const body = res && res.ok ? await res.json().catch(() => null) : null;
  if (body !== `${MARKER_PREFIX}${ref}`) fail("the Supabase project behind STAGING_SUPABASE_URL is not the marked staging project.");
}

const STAGING_ORIGIN = /^https:\/\/mktbd-staging\.[a-z0-9-]+\.workers\.dev$/;

/**
 * Cloudflare Access must be enforcing on the staging origin, proven both ways:
 * - an anonymous request is redirected to the Access login (<team>.cloudflareaccess.com) -- a 404
 *   (no Worker yet) or any other non-200 does NOT count as protected;
 * - the CI service token gets 200 (so the application really sits behind that Access app).
 */
export async function checkAccessEnforced(base, headers = {}) {
  if (!STAGING_ORIGIN.test(base)) fail("the target is not the mktbd-staging workers.dev origin.");
  if (!headers["CF-Access-Client-Id"] || !headers["CF-Access-Client-Secret"]) fail("the Cloudflare Access service token (CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET) is missing.");
  const anonymous = await fetch(base + "/", { redirect: "manual" }).catch(() => null);
  let loginHost = "";
  try { loginHost = new URL(anonymous?.headers.get("location") || "", base).hostname; } catch {}
  if (!anonymous || ![301, 302, 303, 307, 308].includes(anonymous.status) || !/\.cloudflareaccess\.com$/.test(loginHost))
    fail("Cloudflare Access is not enforcing on the staging origin (an anonymous request was not redirected to the Access login).");
  const withToken = await fetch(base + "/", { headers, redirect: "manual" }).catch(() => null);
  if (!withToken || withToken.status !== 200) fail("the Access service token did not get through (check the Service Auth policy and the token).");
}

/**
 * The deployed site must identify itself as staging before any test touches it. On workers.dev it
 * must also be behind Cloudflare Access (checkAccessEnforced). Local workerd on 127.0.0.1 has no Access.
 */
export async function checkStagingSite(base, headers = {}) {
  const remote = STAGING_ORIGIN.test(base);
  if (!remote && !/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) fail("the target is not the mktbd-staging workers.dev origin.");
  if (remote) await checkAccessEnforced(base, headers);
  const res = await fetch(base + "/", { headers, redirect: "manual" }).catch(() => null);
  if (!res || res.status !== 200) fail("the staging homepage did not answer 200.");
  const html = await res.text();
  if (!/STAGING — not the live mktbd site/.test(html)) fail("the target does not show the staging banner.");
  if (!/noindex/i.test(res.headers.get("x-robots-tag") || "")) fail("the target is not noindex.");
}
