import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classify, LOCAL_API, LOCAL_DB } from "../../scripts/qa/rls-probe.mjs";

// Stage 3A: the security probes must tell an explicit refusal from "nothing happened" and from a broken
// environment, and must only ever run against the disposable local QA stack.

test("classify: explicit refusals are 'denied'", () => {
  assert.equal(classify({ error: { code: "42501", message: "permission denied for table orders" } }), "denied");
  assert.equal(classify({ error: { code: "42501", message: 'new row violates row-level security policy for table "analyses"' } }), "denied");
  assert.equal(classify({ error: { status: 400, statusCode: "403", message: "new row violates row-level security policy" } }), "denied");
  assert.equal(classify({ error: { status: 401, message: "Invalid JWT" } }), "denied");
});

test("classify: filtered-out results are 'empty', real results 'allowed'", () => {
  assert.equal(classify({ data: [], error: null }), "empty");
  assert.equal(classify({ data: null, error: null }), "empty");
  assert.equal(classify({ data: [{ id: 1 }], error: null }), "allowed");
  assert.equal(classify({ data: { path: "x" }, error: null }), "allowed");
});

test("classify: hidden objects, Storage type/size refusals, network failures and other errors stay distinct", () => {
  assert.equal(classify({ error: { status: 400, statusCode: "404", message: "Object not found" } }), "hidden");
  assert.equal(classify({ error: { statusCode: "415", message: "mime type text/html is not supported" } }), "rejected");
  assert.equal(classify({ error: { statusCode: "413", message: "The object exceeded the maximum allowed size" } }), "rejected");
  assert.equal(classify({ thrown: new TypeError("fetch failed") }), "network");
  assert.equal(classify({ thrown: Object.assign(new Error("x"), { cause: { code: "ECONNREFUSED" } }) }), "network");
  assert.equal(classify({ error: { code: "23505", message: "duplicate key value" } }), "error");
  assert.equal(classify({ thrown: new Error("unexpected") }), "error");
});

test("guards accept only the local QA API and database", () => {
  assert.ok(LOCAL_API.test("http://127.0.0.1:55321"));
  for (const bad of ["http://127.0.0.1:54321", "https://abcdefghijabcdefghij.supabase.co", "http://localhost:55321", "http://127.0.0.1:55321.evil.test"]) assert.ok(!LOCAL_API.test(bad), bad);
  assert.ok(LOCAL_DB.test("postgresql://postgres:postgres@127.0.0.1:55322/postgres"));
  for (const bad of ["postgresql://postgres:postgres@127.0.0.1:54322/postgres", "postgresql://postgres.abcdefghijabcdefghij:pw@aws-0-x.pooler.supabase.com:5432/postgres", "postgresql://postgres:postgres@127.0.0.1:55322/other"]) assert.ok(!LOCAL_DB.test(bad), bad);
});

test("the probes refuse a database without the qa_disposable marker and clean up their synthetic data", () => {
  for (const f of ["../../scripts/qa/rls-probe.mjs", "../../scripts/qa/auth-probe.mjs"]) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.match(src, /nspname = 'qa_disposable'/, `${f}: marker check`);
    assert.match(src, /process\.exit\(97\)/, `${f}: refusal exit`);
    assert.match(src, /CLEANUP FAILED/, `${f}: cleanup is verified`);
    assert.match(src, /SETUP FAILED: .*this is not a pass/, `${f}: a setup failure is never a pass`);
  }
});

test("every refused write is checked against the database, not just the API response", () => {
  const src = readFileSync(new URL("../../scripts/qa/rls-probe.mjs", import.meta.url), "utf8");
  const writes = [...src.matchAll(/record\(who, "write", [^\n]*\n?/g)].map((m) => m[0]);
  assert.ok(writes.length >= 5);
  for (const w of writes) assert.match(w, /stateOk:/, `a refused write without a state check: ${w.slice(0, 80)}`);
});
