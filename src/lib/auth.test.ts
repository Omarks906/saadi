import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import { resolveExpectedPassword } from "./auth";

// Store original env values
let originalOrgPasswords: string | undefined;
let originalAppPassword: string | undefined;

beforeEach(() => {
  originalOrgPasswords = process.env.ORG_PASSWORDS;
  originalAppPassword = process.env.APP_PASSWORD;
  delete process.env.ORG_PASSWORDS;
  delete process.env.APP_PASSWORD;
});

afterEach(() => {
  if (originalOrgPasswords !== undefined) {
    process.env.ORG_PASSWORDS = originalOrgPasswords;
  } else {
    delete process.env.ORG_PASSWORDS;
  }
  if (originalAppPassword !== undefined) {
    process.env.APP_PASSWORD = originalAppPassword;
  } else {
    delete process.env.APP_PASSWORD;
  }
});

test("resolveExpectedPassword returns APP_PASSWORD when ORG_PASSWORDS not set", () => {
  process.env.APP_PASSWORD = "secret123";

  const result = resolveExpectedPassword("any-org");

  assert.equal(result.expected, "secret123");
  assert.equal(result.requiresOrg, false);
});

test("resolveExpectedPassword returns null when no passwords configured", () => {
  const result = resolveExpectedPassword("any-org");

  assert.equal(result.expected, null);
  assert.equal(result.requiresOrg, false);
});

test("resolveExpectedPassword trims APP_PASSWORD whitespace", () => {
  process.env.APP_PASSWORD = "  secret123  ";

  const result = resolveExpectedPassword("any-org");

  assert.equal(result.expected, "secret123");
});

test("resolveExpectedPassword parses JSON format ORG_PASSWORDS", () => {
  process.env.ORG_PASSWORDS = '{"chilli":"pass1","beta":"pass2"}';

  const result = resolveExpectedPassword("chilli");

  assert.equal(result.expected, "pass1");
  assert.equal(result.requiresOrg, true);
});

test("resolveExpectedPassword parses CSV format ORG_PASSWORDS", () => {
  process.env.ORG_PASSWORDS = "chilli:pass1,beta:pass2";

  const result = resolveExpectedPassword("beta");

  assert.equal(result.expected, "pass2");
  assert.equal(result.requiresOrg, true);
});

test("resolveExpectedPassword handles CSV with whitespace", () => {
  process.env.ORG_PASSWORDS = "  chilli : pass1 , beta : pass2  ";

  const result = resolveExpectedPassword("chilli");

  assert.equal(result.expected, "pass1");
  assert.equal(result.requiresOrg, true);
});

test("resolveExpectedPassword handles passwords containing colons in CSV", () => {
  process.env.ORG_PASSWORDS = "org1:pass:with:colons,org2:simple";

  const result = resolveExpectedPassword("org1");

  assert.equal(result.expected, "pass:with:colons");
  assert.equal(result.requiresOrg, true);
});

test("resolveExpectedPassword returns null for unknown org with ORG_PASSWORDS", () => {
  process.env.ORG_PASSWORDS = "chilli:pass1,beta:pass2";

  const result = resolveExpectedPassword("unknown");

  assert.equal(result.expected, null);
  assert.equal(result.requiresOrg, true);
});

test("resolveExpectedPassword requires org when ORG_PASSWORDS set but slug empty", () => {
  process.env.ORG_PASSWORDS = "chilli:pass1";

  const resultNull = resolveExpectedPassword(null);
  const resultUndefined = resolveExpectedPassword(undefined);
  const resultEmpty = resolveExpectedPassword("");
  const resultWhitespace = resolveExpectedPassword("   ");

  assert.equal(resultNull.expected, null);
  assert.equal(resultNull.requiresOrg, true);

  assert.equal(resultUndefined.expected, null);
  assert.equal(resultUndefined.requiresOrg, true);

  assert.equal(resultEmpty.expected, null);
  assert.equal(resultEmpty.requiresOrg, true);

  assert.equal(resultWhitespace.expected, null);
  assert.equal(resultWhitespace.requiresOrg, true);
});

test("resolveExpectedPassword trims org slug", () => {
  process.env.ORG_PASSWORDS = "chilli:pass1";

  const result = resolveExpectedPassword("  chilli  ");

  assert.equal(result.expected, "pass1");
});

test("resolveExpectedPassword trims password value", () => {
  process.env.ORG_PASSWORDS = '{"chilli":"  pass1  "}';

  const result = resolveExpectedPassword("chilli");

  assert.equal(result.expected, "pass1");
});

test("resolveExpectedPassword handles empty CSV entries gracefully", () => {
  process.env.ORG_PASSWORDS = "chilli:pass1,,beta:pass2,";

  const result = resolveExpectedPassword("beta");

  assert.equal(result.expected, "pass2");
});

test("resolveExpectedPassword handles malformed CSV entries", () => {
  process.env.ORG_PASSWORDS = "chilli:pass1,invalid,beta:pass2,:noorg,nocolon";

  const chilli = resolveExpectedPassword("chilli");
  const beta = resolveExpectedPassword("beta");
  const invalid = resolveExpectedPassword("invalid");

  assert.equal(chilli.expected, "pass1");
  assert.equal(beta.expected, "pass2");
  assert.equal(invalid.expected, null);
});
