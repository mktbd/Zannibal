#!/bin/bash
# Level 2 QA: local, production-like integration run (pre-deployment).
#
# Usage: npm run qa:local [-- --keep-db] [-- --no-throttle] [-- --skip-build]
#
# Runs the app as the Cloudflare Worker (vinext build on local workerd) against a DISPOSABLE local
# Supabase stack (project "mktbd-qa", ports 553xx) with synthetic fixtures, then drives it with the
# staging browser round (the smoke profile, then the full round) in a throttled Chromium (CPU x4, slow
# 4G-class network). Throttling makes timing bugs (e.g. acting on a control before hydration)
# more likely to show, not certain to; the deterministic guard is
# tests/unit/browser-test-rules.test.mjs. The smoke round must leave the order rate-limit counters
# unchanged (it sends no order request), or the run fails.
#
# Safety:
#   - Every credential-like variable is removed from the environment first, so production or staging
#     keys can never reach the run. Nothing here talks to a hosted Supabase project or Cloudflare.
#   - The QA stack's config is generated from supabase/config.toml (ports 54xxx -> 55xxx, project
#     "mktbd-qa"), so the dev stack (54xxx) is never touched. The workdir must not be linked to a
#     hosted project. The database is reset (unless --keep-db) and marked qa_disposable; the seed
#     refuses any database without that marker.
#   - The local build is a LOCAL_TEST build (no global_fetch_strictly_public, local Supabase URL).
#     It is deleted when the run ends; CI's check-build-config rejects such a build anyway.
#   - Secrets (local QA keys, a random admin password) stay in environment variables and a 0600
#     .dev.vars that is removed as soon as the Worker has started. Nothing secret is printed.
# Limits (covered only by the staging smoke/full tests): Cloudflare Access and edge behaviour,
# global Workers Cache propagation, global_fetch_strictly_public, real latency, hosted-Supabase
# dashboard settings, Cloudflare analytics.
set -euo pipefail

KEEP_DB=0 THROTTLE=--throttle SKIP_BUILD=0
for a in "$@"; do
  case "$a" in
    --keep-db) KEEP_DB=1 ;;
    --no-throttle) THROTTLE="" ;;
    --skip-build) SKIP_BUILD=1 ;;
    *) echo "usage: scripts/qa/local.sh [--keep-db] [--no-throttle] [--skip-build]" >&2; exit 2 ;;
  esac
done

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
# Drop every credential-like variable inherited from the shell (production keys included).
for v in $(compgen -e); do
  case "$v" in
    *SUPABASE*|*_KEY|*_TOKEN|*_SECRET|*PASSWORD*|*_DB_URL|DATABASE_URL|CLOUDFLARE_*|CF_*|PRODUCTION_REF|STAGING_*|BKASH_*) unset "$v" ;;
  esac
done

W=${QA_WORKDIR:-${TMPDIR:-/tmp}/mktbd-qa}
OUT=$W/out
QA_PORT_API=55321 QA_PORT_DB=55322
BASE=http://127.0.0.1:4173
mkdir -p "$W/supabase" "$OUT"
umask 077
step() { printf '\n== %s\n' "$*"; }
die() { echo "QA REFUSED/FAILED: $*" >&2; exit 1; }

step "prerequisites"
docker info >/dev/null 2>&1 || die "Docker is not running (start the Docker daemon first)."
npx --no-install supabase --version >/dev/null 2>&1 || die "Supabase CLI not installed (npm ci)."
node -e 'import("playwright").catch(() => { const { createRequire } = require("module"); createRequire(require("child_process").execSync("npm root -g").toString().trim() + "/")("playwright"); })' >/dev/null 2>&1 || die "Playwright not available."
echo "docker, supabase CLI, playwright: OK"

step "QA Supabase stack (project mktbd-qa, ports 553xx)"
sed -E 's/\b54([0-9]{3})\b/55\1/g; s/^project_id = .*/project_id = "mktbd-qa"/' supabase/config.toml > "$W/supabase/config.toml"
grep -q '^project_id = "mktbd-qa"$' "$W/supabase/config.toml" || die "could not derive the QA config."
grep -qE '\b54[0-9]{3}\b' "$W/supabase/config.toml" && die "the QA config still contains dev (54xxx) ports."
rm -rf "$W/supabase/migrations" && cp -R supabase/migrations "$W/supabase/migrations"
[ -e "$W/supabase/.temp/project-ref" ] && die "the QA workdir is linked to a hosted project."
npx --no-install supabase start --workdir "$W" -x studio,imgproxy,vector,logflare,realtime,edge-runtime,supavisor,mailpit > "$OUT/supabase-start.log" 2>&1 || { tail -5 "$OUT/supabase-start.log" >&2; die "supabase start failed."; }
eval "$(npx --no-install supabase status --workdir "$W" -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY|DB_URL)=' | sed 's/^/QA_/')"
[ "${QA_API_URL:-}" = "http://127.0.0.1:$QA_PORT_API" ] || die "QA API is not on 127.0.0.1:$QA_PORT_API."
case "${QA_DB_URL:-}" in *@127.0.0.1:$QA_PORT_DB/*) ;; *) die "QA database is not on 127.0.0.1:$QA_PORT_DB." ;; esac
docker ps --format '{{.Names}}' | grep -qx "supabase_db_mktbd-qa" || die "the QA database container is not running."
echo "QA stack up: API 127.0.0.1:$QA_PORT_API, DB 127.0.0.1:$QA_PORT_DB"

if [ "$KEEP_DB" = 0 ]; then
  step "reset QA database (repo migrations) and mark it disposable"
  npx --no-install supabase db reset --workdir "$W" --local --no-seed > "$OUT/db-reset.log" 2>&1 || { tail -5 "$OUT/db-reset.log" >&2; die "db reset failed."; }
  psql "$QA_DB_URL" -X -q -v ON_ERROR_STOP=1 -c "create schema if not exists qa_disposable; comment on schema qa_disposable is 'Disposable local QA database (scripts/qa/local.sh).';" >/dev/null
  echo "migrations applied: $(psql "$QA_DB_URL" -XtAc 'select count(*) from supabase_migrations.schema_migrations') of $(ls supabase/migrations | wc -l)"
fi
[ "$(psql "$QA_DB_URL" -XtAc "select count(*) from pg_namespace where nspname = 'qa_disposable'")" = 1 ] || die "QA database has no qa_disposable marker (run without --keep-db)."
# The browser round expects a fresh per-IP order window; a kept database still holds the last run's.
[ "$KEEP_DB" = 1 ] && psql "$QA_DB_URL" -X -q -v ON_ERROR_STOP=1 -c "truncate public.order_rate_limits;" >/dev/null && echo "kept database: order rate-limit window cleared"

step "seed synthetic fixtures"
ADMIN_PASSWORD="qa-$(node -e 'console.log(require("crypto").randomUUID())')"
QA_SUPABASE_URL="$QA_API_URL" QA_DB_URL="$QA_DB_URL" QA_SERVICE_ROLE_KEY="$QA_SERVICE_ROLE_KEY" STAGING_ADMIN_EMAIL=staging-admin@example.test STAGING_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  node scripts/staging/seed.mjs --local-qa > "$OUT/seed.log" 2>&1 || { tail -3 "$OUT/seed.log" >&2; die "seed failed."; }
tail -1 "$OUT/seed.log"

cleanup() {
  [ -n "${PREVIEW_PID:-}" ] && kill -- "-$PREVIEW_PID" 2>/dev/null || true
  rm -f "$ROOT/.dev.vars"
  # The LOCAL_TEST build must never be deployable from a workstation.
  [ "${BUILT:-0}" = 1 ] && rm -rf "$ROOT/.cloudflare/output"
  return 0
}
trap cleanup EXIT INT TERM

export NEXT_PUBLIC_SUPABASE_URL="$QA_API_URL" NEXT_PUBLIC_SUPABASE_ANON_KEY="$QA_ANON_KEY" NEXT_PUBLIC_SITE_URL="$BASE"
export SITE_ENV=preview DEPLOY_PLATFORM=cloudflare DEPLOY_TARGET=staging LOCAL_TEST=1
if [ "$SKIP_BUILD" = 0 ]; then
  step "build the Worker (vinext, LOCAL_TEST)"
  BUILT=1
  npx --no-install vite build > "$OUT/build.log" 2>&1 || { tail -15 "$OUT/build.log" >&2; die "build failed."; }
  node scripts/staging/check-build-config.mjs --target staging
  node scripts/staging/bundle-size.mjs
fi
[ -f .cloudflare/output/v0/workers/default/worker.config.json ] || die "no build output (run without --skip-build)."

step "start the Worker on local workerd ($BASE)"
printf 'SUPABASE_SERVICE_ROLE_KEY=%s\n' "$QA_SERVICE_ROLE_KEY" > .dev.vars
setsid npx --no-install vite preview --host 127.0.0.1 --port 4173 --strictPort > "$OUT/preview.log" 2>&1 &
PREVIEW_PID=$!
ready=0
for _ in $(seq 1 120); do
  if curl -s -o /dev/null --max-time 2 -w '%{http_code}' "$BASE/" | grep -q '^200$'; then ready=1; break; fi
  kill -0 "$PREVIEW_PID" 2>/dev/null || break
  sleep 0.5
done
rm -f .dev.vars
[ "$ready" = 1 ] || { tail -10 "$OUT/preview.log" >&2; die "the local Worker did not start."; }
echo "Worker answering on $BASE (.dev.vars removed)"
unset QA_SERVICE_ROLE_KEY

round() { STAGING_ADMIN_EMAIL=staging-admin@example.test STAGING_ADMIN_PASSWORD="$ADMIN_PASSWORD" node scripts/staging/browser-round.mjs "$BASE" "$@" $THROTTLE; }
hits() { psql "$QA_DB_URL" -XtAc "select coalesce(sum(hits), 0) from public.order_rate_limits"; }
set +e
# Same order as on staging (smoke, then full): the smoke round uses the seeded order fixture, and the
# full round's "429 at exactly the 6th submission (fresh window)" check then proves the smoke round
# left the per-IP order window untouched.
step "smoke browser round (${THROTTLE:+throttled, }the staging smoke-staging profile)"
before=$(hits); round --profile smoke --out "$OUT/smoke.json"; smoke=$?; after=$(hits)
step "full browser round (${THROTTLE:+throttled, }real local Supabase: DB, Auth, Storage, CMS, orders)"
round --out "$OUT/browser.json"; full=$?
set -e
if [ "$before" = "$after" ]; then echo "smoke sent no order request (rate-limit hits unchanged: $before)"; window=0
else echo "FAIL  smoke changed the order rate-limit counters ($before -> $after): it must not use up the full test's window"; window=1; fi

step "result"
echo "results: $OUT/smoke.json, $OUT/browser.json"
echo "smoke round: $([ $smoke = 0 ] && echo PASS || echo "FAIL (exit $smoke)"); full round: $([ $full = 0 ] && echo PASS || echo "FAIL (exit $full)"); rate-limit window untouched by smoke: $([ $window = 0 ] && echo yes || echo NO)"
if [ "$full" = 0 ] && [ "$smoke" = 0 ] && [ "$window" = 0 ]; then echo "LOCAL QA: PASS"; exit 0; fi
echo "LOCAL QA: FAIL"; exit 1
