import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Stage 3B: the CMS lifecycle probe deletes and rewrites content, so it must only ever run against the
// disposable local QA stack, touch nothing but its own synthetic records, and prove every outcome from
// the database rather than from the editor's own message.
const src = readFileSync(new URL("../../scripts/qa/cms-probe.mjs", import.meta.url), "utf8");

test("the CMS probe refuses anything but the local QA stack and the local Worker", () => {
  assert.match(src, /import \{ LOCAL_API, LOCAL_DB \} from "\.\/rls-probe\.mjs"/);
  assert.match(src, /LOCAL_API\.test\(env\.QA_API_URL/);
  assert.match(src, /LOCAL_DB\.test\(env\.QA_DB_URL/);
  assert.match(src, /\^http:\\\/\\\/127\\\.0\\\.0\\\.1:\\d\+\$/, "the Worker must be 127.0.0.1");
  assert.match(src, /nspname = 'qa_disposable'/);
  assert.match(src, /process\.exit\(97\)/);
});

test("the CMS probe cleans up only its own synthetic records, before and after, and verifies it", () => {
  const cleanup = src.slice(src.indexOf("async function cleanup()"), src.indexOf("const leftovers"));
  for (const statement of cleanup.match(/delete from [^;`]+/g)) {
    assert.match(statement, /slug like 'qa-cms-%'|name like 'QA CMS %'|customer_email = '\$\{BUYER\}'/, `unscoped delete: ${statement}`);
  }
  assert.match(src, /BUYER = "qa-cms-buyer@example\.test"/);
  assert.match(src, /await cleanup\(\); \/\/ a crashed earlier run/);
  assert.match(src, /cleanOk = leftovers\(\) === 0/);
  assert.match(src, /CLEANUP FAILED/);
  assert.match(src, /SETUP FAILED: .*this is not a pass/);
});

test("every refused save is checked against a database snapshot", () => {
  const helper = src.slice(src.indexOf("const refusedCase"), src.indexOf("await refusedCase("));
  assert.match(helper, /const before = snap\(t\.table, t\.id\)/);
  assert.match(helper, /snap\(t\.table, t\.id\) === before/);
  assert.ok((src.match(/await refusedCase\(/g) || []).length >= 10, "publishing-rule and media refusals");
});
