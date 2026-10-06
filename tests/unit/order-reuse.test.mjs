import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTransactionReuse } from "../../lib/order-reuse.ts";

const CASE = "c1";
const row = (over = {}) => ({ case_study_id: CASE, customer_email: "Reader@Example.test", status: "pending", order_number: "MKT-2026-000001", ...over });

test("no existing order with the Transaction ID -> new order", () => {
  assert.deepEqual(resolveTransactionReuse([], CASE, "reader@example.test"), { kind: "new" });
});

test("Pending + same Case Study + same email (any case) -> resubmission of that order", () => {
  const existing = row();
  const result = resolveTransactionReuse([existing], CASE, "READER@example.TEST");
  assert.equal(result.kind, "resubmission");
  assert.equal(result.order, existing);
});

test("Pending + different email -> reused", () => {
  assert.deepEqual(resolveTransactionReuse([row()], CASE, "someone-else@example.test"), { kind: "reused" });
});

test("Pending + different Case Study -> reused", () => {
  assert.deepEqual(resolveTransactionReuse([row()], "c2", "reader@example.test"), { kind: "reused" });
});

test("Pending order whose Case Study was deleted (case_study_id null) -> reused", () => {
  assert.deepEqual(resolveTransactionReuse([row({ case_study_id: null })], CASE, "reader@example.test"), { kind: "reused" });
});

for (const status of ["fulfilled", "invalid"]) {
  test(`${status} + exact resubmission -> reused (never a Pending confirmation)`, () => {
    assert.deepEqual(resolveTransactionReuse([row({ status })], CASE, "reader@example.test"), { kind: "reused" });
  });
  test(`${status} + different customer -> reused`, () => {
    assert.deepEqual(resolveTransactionReuse([row({ status })], "c2", "other@example.test"), { kind: "reused" });
  });
}

test("a reused result carries no information about the existing order", () => {
  const result = resolveTransactionReuse([row({ status: "invalid" })], CASE, "reader@example.test");
  assert.deepEqual(Object.keys(result), ["kind"]);
});

test("several rows (e.g. a past race): a matching Pending row is still found", () => {
  const pending = row({ order_number: "MKT-2026-000009" });
  const result = resolveTransactionReuse([row({ status: "invalid" }), pending], CASE, "reader@example.test");
  assert.equal(result.kind, "resubmission");
  assert.equal(result.order, pending);
});
