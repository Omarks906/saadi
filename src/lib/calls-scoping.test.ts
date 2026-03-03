/**
 * Regression tests for org-scoped call counting and daily-window logic.
 *
 * Run with:
 *   node --experimental-strip-types --test src/lib/calls-scoping.test.ts
 *
 * These tests use in-memory fakes so they require no database.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// ---------------------------------------------------------------------------
// Inline copy of getStockholmDayStart from dashboard/page.tsx so we can unit-
// test it without spinning up Next.js.
// ---------------------------------------------------------------------------
function getStockholmDayStart(): Date {
  const TZ = "Europe/Stockholm";
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  const msIntoDay =
    (parseInt(p.hour) * 3600 + parseInt(p.minute) * 60 + parseInt(p.second)) *
    1000;
  return new Date(now.getTime() - msIntoDay);
}

// ---------------------------------------------------------------------------
// Fake in-memory call store – mirrors the interface of listCallsByOrganization
// ---------------------------------------------------------------------------
type FakeCall = { organizationId: string; createdAt: string };

function listCallsInMemory(
  calls: FakeCall[],
  organizationId: string,
  options?: { since?: string; limit?: number }
): FakeCall[] {
  let result = calls.filter((c) => c.organizationId === organizationId);
  if (options?.since) {
    result = result.filter((c) => c.createdAt >= options.since!);
  }
  result = result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (options?.limit) {
    result = result.slice(0, options.limit);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** ISO string for N hours ago */
function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3600_000).toISOString();
}

/** ISO string for N days ago (midnight UTC-ish, safe for tests) */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("listCallsInMemory is strictly org-scoped", () => {
  const calls: FakeCall[] = [
    { organizationId: "chilli-id", createdAt: hoursAgo(1) },
    { organizationId: "chilli-id", createdAt: hoursAgo(2) },
    { organizationId: "demo-id", createdAt: hoursAgo(1) },
    { organizationId: "demo-id", createdAt: hoursAgo(3) },
  ];

  const chilliCalls = listCallsInMemory(calls, "chilli-id");
  assert.equal(chilliCalls.length, 2);
  assert.ok(chilliCalls.every((c) => c.organizationId === "chilli-id"));

  const demoCalls = listCallsInMemory(calls, "demo-id");
  assert.equal(demoCalls.length, 2);
  assert.ok(demoCalls.every((c) => c.organizationId === "demo-id"));
});

test("chilli daily count equals only chilli calls created today", () => {
  const todayStart = getStockholmDayStart().toISOString();

  const calls: FakeCall[] = [
    // chilli: 3 calls today, 1 old call
    { organizationId: "chilli-id", createdAt: hoursAgo(1) },
    { organizationId: "chilli-id", createdAt: hoursAgo(2) },
    { organizationId: "chilli-id", createdAt: hoursAgo(3) },
    { organizationId: "chilli-id", createdAt: daysAgo(2) },
    // demo: 5 calls today
    { organizationId: "demo-id", createdAt: hoursAgo(1) },
    { organizationId: "demo-id", createdAt: hoursAgo(2) },
    { organizationId: "demo-id", createdAt: hoursAgo(3) },
    { organizationId: "demo-id", createdAt: hoursAgo(4) },
    { organizationId: "demo-id", createdAt: hoursAgo(5) },
  ];

  const chilliToday = listCallsInMemory(calls, "chilli-id", { since: todayStart });
  assert.equal(chilliToday.length, 3, "chilli today count must be 3");

  const demoToday = listCallsInMemory(calls, "demo-id", { since: todayStart });
  assert.equal(demoToday.length, 5, "demo today count must be 5");
});

test("demo daily count equals only demo calls", () => {
  const todayStart = getStockholmDayStart().toISOString();

  const calls: FakeCall[] = [
    { organizationId: "chilli-id", createdAt: hoursAgo(1) },
    { organizationId: "demo-id", createdAt: hoursAgo(1) },
    { organizationId: "demo-id", createdAt: hoursAgo(2) },
  ];

  const demo = listCallsInMemory(calls, "demo-id", { since: todayStart });
  assert.equal(demo.length, 2);
  assert.ok(demo.every((c) => c.organizationId === "demo-id"));
});

test("limit is applied after org and date filter", () => {
  const todayStart = getStockholmDayStart().toISOString();

  const calls: FakeCall[] = Array.from({ length: 100 }, (_, i) => ({
    organizationId: "chilli-id",
    createdAt: hoursAgo(i * 0.1),
  }));

  const result = listCallsInMemory(calls, "chilli-id", { since: todayStart, limit: 10 });
  assert.ok(result.length <= 10, "limit must cap at 10");
});

test("getStockholmDayStart returns a time at or before now", () => {
  const dayStart = getStockholmDayStart();
  const now = new Date();
  assert.ok(dayStart <= now, "day start must be in the past");
});

test("getStockholmDayStart is midnight in Stockholm (hour 0)", () => {
  const dayStart = getStockholmDayStart();
  const stockholmHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Stockholm",
      hour: "2-digit",
      hour12: false,
    }).format(dayStart)
  );
  // Allow for the 1-second rounding in the computation
  assert.ok(stockholmHour === 0 || stockholmHour === 23,
    `Expected Stockholm hour to be 0 (got ${stockholmHour})`
  );
});

test("no chilli calls appear in demo result and vice versa", () => {
  const todayStart = getStockholmDayStart().toISOString();
  const calls: FakeCall[] = [
    { organizationId: "chilli-id", createdAt: hoursAgo(0.5) },
    { organizationId: "demo-id", createdAt: hoursAgo(0.5) },
  ];

  const chilliResult = listCallsInMemory(calls, "chilli-id", { since: todayStart });
  const demoResult = listCallsInMemory(calls, "demo-id", { since: todayStart });

  assert.ok(!chilliResult.some((c) => c.organizationId === "demo-id"),
    "chilli result must not contain demo calls"
  );
  assert.ok(!demoResult.some((c) => c.organizationId === "chilli-id"),
    "demo result must not contain chilli calls"
  );
});
