import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPsqlError } from "../../scripts/staging/db-diagnose.mjs";

// Stage 05E-B2F (temporary diagnostic): representative psql/libpq/Supavisor error texts -> categories.
// The texts below are synthetic examples with placeholder hosts; real stderr is never printed.
test("db-diagnose: psql errors map to sanitized categories", () => {
  const cases = [
    ['psql: error: could not translate host name "aws-0-x.pooler.example" to address: Name or service not known', "DNS"],
    ['psql: error: connection to server at "aws-0-x.pooler.example" (192.0.2.1), port 5432 failed: FATAL:  password authentication failed for user "postgres.abcdefghijklmnopqrst"', "authentication"],
    ['psql: error: connection to server at "h" (192.0.2.1), port 5432 failed: FATAL:  Tenant or user not found', "pooler configuration"],
    ['psql: error: connection to server at "h" (192.0.2.1), port 5432 failed: FATAL:  database "postgresx" does not exist', "pooler configuration"],
    ['psql: error: connection to server at "h" (192.0.2.1), port 5432 failed: server does not support SSL, but SSL was required', "TLS"],
    ['psql: error: connection to server at "h" (192.0.2.1), port 5432 failed: SSL error: certificate verify failed', "TLS"],
    ['psql: error: connection to server at "h" (192.0.2.1), port 5432 failed: Connection refused', "network"],
    ['psql: error: connection to server at "h" (192.0.2.1), port 5432 failed: timeout expired', "network"],
    ['psql: error: invalid percent-encoded token: "ab%zz"', "connection string format"],
    ['ERROR:  relation "x" does not exist', "SQL"],
    ['psql: error: connection to server at "h" (192.0.2.1), port 5432 failed: FATAL:  something unexpected', "pooler configuration"],
    ["", "unknown"],
  ];
  for (const [stderr, want] of cases) assert.equal(classifyPsqlError(stderr), want, stderr.slice(0, 80));
});
