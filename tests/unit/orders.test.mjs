import { test } from "node:test";
import assert from "node:assert/strict";
import { isOrderStatus, parseOrderStatusFilter, ORDER_SEARCH_COLUMNS, ORDER_STATUSES } from "../../lib/orders.ts";
import { likePattern, ilikeAnyFilter } from "../../lib/search.ts";

test("order statuses are exactly the database enum", () => {
  assert.deepEqual([...ORDER_STATUSES], ["pending", "fulfilled", "invalid"]);
  for (const s of ["pending", "fulfilled", "invalid"]) assert.equal(isOrderStatus(s), true);
  for (const s of ["paid", "refunded", "Pending", "", null, undefined, 1]) assert.equal(isOrderStatus(s), false);
});

test("status filter falls back to all", () => {
  assert.equal(parseOrderStatusFilter("invalid"), "invalid");
  assert.equal(parseOrderStatusFilter("cancelled"), "all");
  assert.equal(parseOrderStatusFilter(undefined), "all");
});

test("likePattern escapes LIKE wildcards", () => {
  assert.equal(likePattern("50%"), "%50\\%%");
  assert.equal(likePattern("a_b"), "%a\\_b%");
  assert.equal(likePattern("back\\slash"), "%back\\\\slash%");
});

test("order search covers the four columns with a quoted, escaped value", () => {
  const filter = ilikeAnyFilter(ORDER_SEARCH_COLUMNS, '50%_,a"(b).c');
  const parts = filter.split(/,(?=[a-z_]+\.ilike\.)/);
  assert.deepEqual(parts.map((p) => p.split(".ilike.")[0]), ["order_number", "customer_name", "customer_email", "bkash_transaction_number"]);
  // PostgREST unquotes \\ -> \ and \" -> ", leaving the escaped LIKE pattern %50\%\_,a"(b).c%
  for (const p of parts) assert.equal(p.split(".ilike.")[1], '"%50\\\\%\\\\_,a\\"(b).c%"');
});
