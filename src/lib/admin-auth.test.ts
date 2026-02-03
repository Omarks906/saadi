import assert from "node:assert/strict";
import { test } from "node:test";
import { toAdminErrorResponse } from "./admin-auth";

// Note: requireAdminOrg requires database access and NextRequest objects.
// To fully test it, we would need to either:
// 1. Refactor to use dependency injection (like print-jobs.ts does)
// 2. Use integration tests with a test database
// For now, we test the exported toAdminErrorResponse and document
// the expected behavior of the internal parseTokenMap function.

// Note: toAdminErrorResponse uses instanceof check against its internal
// AdminAuthError class. To properly test AdminAuthError handling,
// the class would need to be exported, or we'd need integration tests
// that trigger actual auth errors.

test("toAdminErrorResponse handles generic Error as 500", () => {
  const error = new Error("Something went wrong");
  const result = toAdminErrorResponse(error);

  assert.equal(result.status, 500);
  assert.equal(result.error, "Internal server error");
});

test("toAdminErrorResponse handles null/undefined as 500", () => {
  const resultNull = toAdminErrorResponse(null);
  const resultUndefined = toAdminErrorResponse(undefined);

  assert.equal(resultNull.status, 500);
  assert.equal(resultNull.error, "Internal server error");

  assert.equal(resultUndefined.status, 500);
  assert.equal(resultUndefined.error, "Internal server error");
});

test("toAdminErrorResponse handles string error as 500", () => {
  const result = toAdminErrorResponse("string error");

  assert.equal(result.status, 500);
  assert.equal(result.error, "Internal server error");
});

test("toAdminErrorResponse handles object without status as 500", () => {
  const error = { message: "Some error" };
  const result = toAdminErrorResponse(error);

  assert.equal(result.status, 500);
  assert.equal(result.error, "Internal server error");
});

// ============================================================
// The following tests document expected parseTokenMap behavior.
// parseTokenMap is internal but critical for security.
// These tests serve as documentation and would pass if parseTokenMap
// were exported (e.g., export { parseTokenMap as _parseTokenMap }).
// ============================================================

/*
Expected parseTokenMap behavior:

1. Empty/undefined input returns empty object:
   parseTokenMap(undefined) => {}
   parseTokenMap("") => {}

2. CSV format with colon separator:
   parseTokenMap("org1:token1,org2:token2") => { org1: "token1", org2: "token2" }

3. CSV format with equals separator:
   parseTokenMap("org1=token1,org2=token2") => { org1: "token1", org2: "token2" }

4. Mixed separators:
   parseTokenMap("org1:token1,org2=token2") => { org1: "token1", org2: "token2" }

5. Handles whitespace:
   parseTokenMap("  org1 : token1 , org2 : token2  ") => { org1: "token1", org2: "token2" }

6. Lowercases slugs (case-insensitive org matching):
   parseTokenMap("ORG1:token1,Org2:token2") => { org1: "token1", org2: "token2" }

7. Skips malformed entries:
   parseTokenMap("org1:token1,invalid,org2:token2") => { org1: "token1", org2: "token2" }

8. Skips entries with empty slug or token:
   parseTokenMap("org1:token1,:token2,org3:") => { org1: "token1" }
*/

// These tests would work if parseTokenMap were exported:
// test("parseTokenMap returns empty object for undefined", () => {
//   const result = parseTokenMap(undefined);
//   assert.deepEqual(result, {});
// });
//
// test("parseTokenMap parses colon-separated CSV", () => {
//   const result = parseTokenMap("org1:token1,org2:token2");
//   assert.deepEqual(result, { org1: "token1", org2: "token2" });
// });
//
// test("parseTokenMap parses equals-separated CSV", () => {
//   const result = parseTokenMap("org1=token1,org2=token2");
//   assert.deepEqual(result, { org1: "token1", org2: "token2" });
// });
//
// test("parseTokenMap lowercases org slugs", () => {
//   const result = parseTokenMap("ORG1:token1,Org2:token2");
//   assert.deepEqual(result, { org1: "token1", org2: "token2" });
// });
