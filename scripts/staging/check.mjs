// Isolation gate for each Cloudflare STAGING workflow job (Stage 05E-B2A).
//   --db fresh-or-marked  migrate: the staging DB is brand new (no migration history, no app
//                         tables) or already carries this ref's marker; never anything else.
//   --db marked           seed: the staging DB carries this ref's marker.
//   --anon                deploy: the staging URL + anon key answer staging_identity() for this ref
//                         (no database credentials in the deploy job).
//   --site <base>         tests: the target is behind Cloudflare Access and shows the staging banner and noindex.
//   --access <base>       deploy: Cloudflare Access is enforcing on the staging origin (before the full app is uploaded).
//   --env                 any job: no production credential name is present.
//   --require A,B,...     with any mode: each listed variable must be set and non-empty (names only are printed).
// Prints the outcome only.
import { checkAccessEnforced, checkMarkerAnon, checkMarkerDb, checkRefs, checkStagingSite, fail, psql, refuseProductionCredentials } from "./isolation.mjs";

const args = process.argv.slice(2);
const mode = args.indexOf("--db") >= 0 ? `db:${args[args.indexOf("--db") + 1]}` : ["anon", "site", "access", "env"].find((m) => args.includes(`--${m}`)) ?? "";
const env = process.env;
if (!["db:fresh-or-marked", "db:marked", "anon", "site", "access", "env"].includes(mode)) fail("usage: check.mjs --db fresh-or-marked|marked | --anon | --site <base> | --access <base> | --env");

const required = args.indexOf("--require") >= 0 ? String(args[args.indexOf("--require") + 1] || "").split(",").filter(Boolean) : [];
const missing = required.filter((name) => !/^[A-Z][A-Z0-9_]*$/.test(name) || !(env[name] || "").trim());
if (missing.length) fail(`required staging settings are missing: ${missing.join(", ")} (configure them in this job's GitHub environment).`);

(async () => {
  refuseProductionCredentials(env);
  if (mode === "env") {
    console.log("Isolation: no production credential names in this job.");
    return;
  }
  if (mode === "site" || mode === "access") {
    const base = args[args.indexOf(`--${mode}`) + 1];
    const access = env.CF_ACCESS_CLIENT_ID ? { "CF-Access-Client-Id": env.CF_ACCESS_CLIENT_ID, "CF-Access-Client-Secret": env.CF_ACCESS_CLIENT_SECRET } : {};
    if (mode === "access") {
      await checkAccessEnforced(base, access);
      console.log("Isolation: Cloudflare Access is enforcing on the staging origin.");
    } else {
      await checkStagingSite(base, access);
      console.log("Isolation: target is the Access-protected staging site (banner + noindex).");
    }
    return;
  }
  const ref = checkRefs(env, { requireDb: mode.startsWith("db:") });
  if (mode === "db:marked") checkMarkerDb(env.STAGING_DB_URL, ref);
  else if (mode === "db:fresh-or-marked") {
    const marked = psql(env.STAGING_DB_URL, "select count(*) from pg_namespace where nspname = 'staging_disposable'") === "1";
    if (marked) checkMarkerDb(env.STAGING_DB_URL, ref);
    else {
      const history = psql(env.STAGING_DB_URL, "select count(*) from pg_namespace where nspname = 'supabase_migrations'") === "1" ? psql(env.STAGING_DB_URL, "select count(*) from supabase_migrations.schema_migrations") : "0";
      const appTables = psql(env.STAGING_DB_URL, "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'");
      if (history !== "0" || appTables !== "0") fail("the staging database is neither brand new nor marked as staging.");
    }
  } else {
    if (!env.STAGING_SUPABASE_ANON_KEY) fail("STAGING_SUPABASE_ANON_KEY is missing.");
    await checkMarkerAnon(env.STAGING_SUPABASE_URL, env.STAGING_SUPABASE_ANON_KEY, ref);
  }
  console.log(`Isolation: staging project confirmed (${mode}); it differs from production.`);
})().catch((e) => fail(`isolation check error (${e.name})`));
