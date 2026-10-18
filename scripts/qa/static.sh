#!/bin/bash
# Level 1 QA: static and build validation (pre-deployment). No services, no network, no credentials.
#
# Usage: npm run qa:static [-- --allow-workflow-change]
#
# Runs every check, then reports them together; exits non-zero if any failed. Logs go to $QA_OUT
# (default ${TMPDIR:-/tmp}/mktbd-qa-static). Builds use synthetic, non-existent Supabase refs, so the
# staging/production build guards are exercised without any real project or key.
set -uo pipefail

ALLOW_WORKFLOW_CHANGE=0
for a in "$@"; do
  case "$a" in
    --allow-workflow-change) ALLOW_WORKFLOW_CHANGE=1 ;;
    *) echo "usage: scripts/qa/static.sh [--allow-workflow-change]" >&2; exit 2 ;;
  esac
done

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
# Drop every credential-like variable inherited from the shell (production keys included).
for v in $(compgen -e); do
  case "$v" in
    *SUPABASE*|*_KEY|*_TOKEN|*_SECRET|*PASSWORD*|*_DB_URL|DATABASE_URL|CLOUDFLARE_*|CF_*|PRODUCTION_REF|STAGING_*|BKASH_*|LOCAL_TEST) unset "$v" ;;
  esac
done

OUT=${QA_OUT:-${TMPDIR:-/tmp}/mktbd-qa-static}
mkdir -p "$OUT"
declare -a NAMES RESULTS TIMES
run() {
  local name=$1; shift
  local log="$OUT/$(echo "$name" | tr -c 'a-zA-Z0-9' '-').log" t0=$SECONDS
  printf '%-58s ' "$name"
  if "$@" > "$log" 2>&1; then RESULTS+=(PASS); echo "PASS ($((SECONDS - t0)) s)"; else RESULTS+=(FAIL); echo "FAIL ($((SECONDS - t0)) s) -> $log"; tail -8 "$log" | sed 's/^/    /'; fi
  NAMES+=("$name"); TIMES+=($((SECONDS - t0)))
}

# Synthetic refs: 20 lowercase characters, never a real project. Staging and production differ.
SYN_PROD=bbbbbbbbbbbbbbbbbbbb SYN_STAGING=aaaaaaaaaaaaaaaaaaaa
build_target() {
  local target=$1 ref site
  if [ "$target" = production ]; then ref=$SYN_PROD site=production; else ref=$SYN_STAGING site=preview; fi
  env DEPLOY_TARGET="$target" SITE_ENV="$site" DEPLOY_PLATFORM=cloudflare PRODUCTION_REF="$SYN_PROD" \
    NEXT_PUBLIC_SUPABASE_URL="https://$ref.supabase.co" NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-anon-key-for-static-qa \
    npx --no-install vite build && node scripts/staging/check-build-config.mjs --target "$target" && node scripts/staging/bundle-size.mjs
}
refuses_production_url_for_staging() {
  # The staging build must refuse the production project's URL (guard in cloudflare.config.ts), and
  # for that reason -- any other build failure does not count.
  local out
  out=$(env DEPLOY_TARGET=staging SITE_ENV=preview DEPLOY_PLATFORM=cloudflare PRODUCTION_REF="$SYN_PROD" \
    NEXT_PUBLIC_SUPABASE_URL="https://$SYN_PROD.supabase.co" NEXT_PUBLIC_SUPABASE_ANON_KEY=x npx --no-install vite build 2>&1) && { echo "build succeeded: guard missing"; return 1; }
  echo "$out" | grep -q "is the PRODUCTION project. Refusing." && echo "refused as expected"
}
workflow_matches_main() {
  local f=.github/workflows/cloudflare-staging.yml
  git rev-parse -q --verify origin/main >/dev/null || { echo "origin/main not fetched (git fetch origin main)"; return 1; }
  if [ "$(git hash-object "$f")" = "$(git rev-parse origin/main:"$f")" ]; then echo "identical to origin/main"; return 0; fi
  echo "$f differs from origin/main: the authorize job will refuse it until the same file is registered on main."
  [ "$ALLOW_WORKFLOW_CHANGE" = 1 ] && { echo "(allowed: a registration PR to main is part of this change)"; return 0; }
  return 1
}

echo "Level 1 QA (static) — logs in $OUT"
run "lint (eslint)" npm run -s lint
run "typecheck (next typegen + tsc)" bash -c "npx --no-install next typegen && npm run -s typecheck"
run "unit tests" npm test --silent
run "secret scan (tracked + untracked files)" node scripts/qa/secret-scan.mjs
run "staging workflow identical to main" workflow_matches_main
run "staging build refuses the production Supabase URL" refuses_production_url_for_staging
run "production build (synthetic) + build-config check" build_target production
run "staging build (synthetic) + build-config + bundle size" build_target staging
# vinext's build rewrites .next/types/routes.d.ts; regenerate so a later tsc sees consistent types.
npx --no-install next typegen > /dev/null 2>&1 || true

fails=0
for i in "${!NAMES[@]}"; do [ "${RESULTS[$i]}" = FAIL ] && fails=$((fails + 1)); done
echo
if [ "$fails" = 0 ]; then echo "LEVEL 1 QA: PASS (${#NAMES[@]} checks, ${SECONDS} s)"; else echo "LEVEL 1 QA: FAIL ($fails of ${#NAMES[@]} checks failed)"; fi
exit $(( fails > 0 ))
