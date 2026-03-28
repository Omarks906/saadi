# Codebase Audit Report
**Date:** 2026-03-28
**Scope:** Order processing pipeline (Vapi webhook → DB → kitchen ticket) + general codebase health
**Auditor:** Internal (Claude Code)

---

## 1. Executive Summary

The codebase is a production-grade voice-AI order management system built on Next.js 16 / React 19 / PostgreSQL. The domain logic is genuinely impressive: a multi-stage review pipeline, phonetic fuzzy-matching, hallucination detection, and multi-tenant isolation show real engineering care. **Health score: 6 / 10.** The score is held down by one critical security leak, a lack of unit tests for core business logic, an oversized God-file route handler, and several silent failure modes that could cause missed or duplicate orders in production.

---

## 2. Strengths

- **Well-designed Zod schemas**: `ChilliOrderSchema` and `OPENAI_ORDER_SCHEMA` are kept in explicit sync with comments. Strict-mode OpenAI structured output alignment is correct and thorough.
- **Fuzzy name matcher quality**: Levenshtein + Dice coefficient combo (40/60 weighted) with a hand-curated phonetic alias table covers known STT distortions. The rationale for 40/60 is documented inline.
- **Multi-tenant isolation**: Every DB query is scoped by `organization_id`. The `orders_org_order_unique` constraint prevents cross-tenant ID collisions.
- **Review pipeline with hallucination guard**: The post-call re-transcription + `looksLikeGarbageItemName` + item-count heuristic is an unusually mature safeguard for a system of this size.
- **Kitchen ticket rendering**: `renderTicket` is clean, well-tested, and correctly handles thermal-printer line widths with wrapping for long names.
- **Operational documentation**: `DEPLOYMENT.md`, `DEBUG_GUIDE.md`, `VAPI_WEBHOOK.md`, etc. show awareness that ops and on-call matter.

---

## 3. Weaknesses

| # | Description | File(s) | Severity |
|---|-------------|---------|----------|
| W1 | **Error stack trace leaked to caller** — `error?.stack` is included in the HTTP 200 response body, exposing internal paths and code structure | `route.ts:926` | CRITICAL |
| W2 | **No webhook signature verification** — Any HTTP client knowing the URL can trigger order creation, OpenAI API calls, and print jobs | `route.ts:127` | HIGH |
| W3 | **In-memory deduplication resets on restart** — The `seenEvents` Set is process-local; VAPI retries after a deploy window will re-process events | `route.ts:33` | HIGH |
| W4 | **`pending_review` missing from UI STATUS_CONFIG** — Orders in `pending_review` fall back to displaying as "New" (blue badge); staff have no visual signal that the order needs review | `page.tsx:37-44` | HIGH |
| W5 | **Sauce modifier applied from full transcript** — `parseModifiers` falls back to scanning the *entire call transcript* for sauce. If one pizza had piripiri and one didn't, both get the sauce | `normalize-order.ts:244-246` | HIGH |
| W6 | **`looksLikeGarbageItemName` + hallucination check copy-pasted** — Identical logic block appears twice (~100 lines each) for AI-extracted path and structured-output review path | `route.ts:512-575`, `route.ts:742-806` | MEDIUM |
| W7 | **No unit tests for core business logic** — `normalize-order.ts`, `match-pizza-name.ts`, and `order-schema.ts` have zero test coverage despite being the most domain-critical files | `src/lib/chilli/` | MEDIUM |
| W8 | **Connection pool has no limits** — `new Pool({ connectionString })` uses pg defaults (`max: 10`). No `idleTimeoutMillis` or `connectionTimeoutMillis` set. Railway free-tier PG allows ~25 connections | `db/connection.ts:46` | MEDIUM |
| W9 | **Schema.sql re-runs DDL on every cold start** — `initDatabaseWithPool` runs the full schema file (with `ALTER TABLE`, `UPDATE`, `INSERT INTO organizations`) on every pool initialization, adding latency | `db/connection.ts:6-30` | MEDIUM |
| W10 | **`createTablesDirectly` fallback is dangerously outdated** — The fallback schema (used when `schema.sql` is missing) creates an old orders table without `organization_id`, review fields, or the correct status enum. Any cold start without schema.sql would silently create broken tables | `db/connection.ts:84-135` | MEDIUM |
| W11 | **README.md is the boilerplate create-next-app template** — No documentation of what this app does, how to run it locally, or how the order pipeline works | `README.md` | LOW |
| W12 | **`package.json` name is `"photolisting-mvp"`** — Legacy artifact from a previous project. Confusing for onboarding. | `package.json:2` | LOW |
| W13 | **Dual extraction modules with unclear canonical** — `order-extract.ts` and `orderExtraction.ts` both exist and are imported with an alias to disambiguate. No comment explains which is preferred or why both exist. | `route.ts:18-19` | LOW |

---

## 4. Critical Issues

### CRITICAL-1: Stack Trace Leaked to Webhook Callers

**File:** `src/app/api/webhooks/vapi/route.ts:921-930`
**Action:** Fix immediately

```typescript
// CURRENT — leaks internal file paths and stack frames
return NextResponse.json(
  {
    success: false,
    error: error?.message || "Internal server error",
    details: error?.stack,   // ← REMOVE THIS
  },
  { status: 200 }
);
```

Any HTTP client (including VAPI's retry logs, which may be visible to staff) receives the full Node.js stack trace. This reveals internal file structure and can aid targeted attacks.

**Fix:** See Code Examples section §7.

---

## 5. Recommended Quick Wins (< 2 hours each)

### QW-1: Remove stack trace from error response
Remove `details: error?.stack` from the catch block. Log it server-side instead.
**Files:** `route.ts:926` — 1 line change.

### QW-2: Add `pending_review` to STATUS_CONFIG
```typescript
pending_review: { label: "Needs Review", color: "text-orange-700", bgColor: "bg-orange-100" },
```
Also update the `OrderStatus` type in `page.tsx` to include `"pending_review"`.
**Files:** `page.tsx:8-14, 37-44` — ~3 lines.

### QW-3: Add connection pool limits
```typescript
pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: ...,
});
```
**Files:** `db/connection.ts:46-53` — ~3 lines.

### QW-4: Add `package.json` name fix
Change `"name": "photolisting-mvp"` to `"name": "saadi"` (or the actual product name).
**Files:** `package.json:2` — 1 line.

### QW-5: Write a real README
Document: what the system does, environment variables required, `npm run dev` prerequisites, local DB setup, and how to trigger a test webhook.
**Files:** `README.md` — ~50 lines.

---

## 6. Recommended Medium-Term Work (1-2 weeks)

### MT-1: Webhook signature verification
VAPI (and most webhook providers) include an HMAC signature header. Verify it on every incoming request before parsing the body. Without this, the endpoint accepts arbitrary POST requests.

```typescript
// Pseudocode — VAPI-specific header name and secret to confirm
const sig = req.headers.get("x-vapi-signature");
const body = await req.text();
const expected = crypto.createHmac("sha256", process.env.VAPI_WEBHOOK_SECRET!).update(body).digest("hex");
if (!timingSafeEqual(Buffer.from(sig!), Buffer.from(expected))) {
  return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
}
```

### MT-2: Persistent deduplication via DB
Move event deduplication from the in-memory `seenEvents` Set to a database check. The calls table already has a `call_id UNIQUE` constraint — use `findCallByCallId` to detect replays instead of the Set. Alternatively, add a `processed_events` table with a `(call_id, event_type)` unique key.

### MT-3: Unit tests for normalize-order and match-pizza-name
These are the highest-risk files with no test coverage. Minimum test cases:
- `matchPizzaName`: Capricciosa, Kantarell, all 69 menu items, known aliases, below-threshold returns null
- `normalizeToChilliOrder`: empty items `[]`, drinks-only order, qty=0 coercion, Bolognese pasta vs Bolognese pizza disambiguation, multi-pizza with different sauces (to catch W5 above)
- `safeParseChilliOrder`: empty pizzas array, null fields, invalid size enum

### MT-4: Extract `route.ts` into focused modules
At 2455 lines, `route.ts` is a maintenance hazard. Suggested split:
```
src/app/api/webhooks/vapi/
  route.ts                  ← just the POST handler & event routing (~100 lines)
  handlers/call-started.ts
  handlers/call-ended.ts
  handlers/end-of-call-report.ts
  handlers/order-confirmed.ts
  lib/review-pipeline.ts    ← shared review + hallucination logic (removes duplication W6)
  lib/idempotency.ts
```

### MT-5: Fix the transcript-wide sauce fallback (W5)
The `parseModifiers` fallback to scanning the full transcript for sauce should only apply when there is exactly one pizza in the order, or when the transcript explicitly ties the sauce to a specific pizza. Document the current behavior and add a test that catches the multi-pizza scenario.

### MT-6: Retire or document `createTablesDirectly`
Either update the fallback schema to match production (including all review fields), or delete it and let the server fail fast if `schema.sql` is missing — a loud failure is safer than silently creating broken tables.

### MT-7: Structured logging
Replace `console.log/warn/error` with a lightweight structured logger (e.g. `pino`). This enables:
- Railway log parsing and alerting on `level: "error"`
- Correlation IDs per webhook invocation
- Machine-readable callId in every log line

---

## 7. Code Examples

### Example 1: Stack Trace Leak (W1) — Fix

**File:** `src/app/api/webhooks/vapi/route.ts:921-930`

```typescript
// BEFORE (leaks stack trace to caller)
} catch (error: any) {
  console.error("[VAPI Webhook] Error processing webhook:", error);
  return NextResponse.json(
    {
      success: false,
      error: error?.message || "Internal server error",
      details: error?.stack,          // ← exposes file paths & internals
    },
    { status: 200 }
  );
}

// AFTER (logs server-side, returns generic response)
} catch (error: any) {
  console.error("[VAPI Webhook] Error processing webhook:", {
    message: error?.message,
    stack: error?.stack,              // ← stays server-side
  });
  return NextResponse.json(
    { success: false, error: "Internal server error" },
    { status: 200 }                   // keep 200 so VAPI doesn't retry
  );
}
```

---

### Example 2: Missing `pending_review` in UI (W4) — Fix

**File:** `src/app/dashboard/orders/page.tsx:8-44`

```typescript
// BEFORE — type excludes pending_review; STATUS_CONFIG has no entry for it
type OrderStatus =
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "cancelled";

const STATUS_CONFIG: Record<OrderStatus, ...> = {
  confirmed:        { label: "New",        color: "text-blue-700",   bgColor: "bg-blue-100"   },
  // ... (pending_review missing — falls back to confirmed silently)
};

// AFTER — add pending_review throughout
type OrderStatus =
  | "pending_review"   // ← add
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "cancelled";

const STATUS_CONFIG: Record<OrderStatus, ...> = {
  pending_review: { label: "Needs Review", color: "text-orange-700", bgColor: "bg-orange-100" },
  confirmed:      { label: "New",          color: "text-blue-700",   bgColor: "bg-blue-100"   },
  // ...rest unchanged
};
```

---

## 8. Per-Section Notes

### Architecture & Dependencies

| Item | Detail | Severity |
|------|--------|----------|
| Data flow | Webhook → `route.ts` → `normalizeToChilliOrder()` → `safeParseChilliOrder()` → `updateOrder()` → `runPrintPipeline()`. Flow is correct. The async review sub-pipeline adds a second normalize+update pass. | — |
| Dependencies | `replicate` and `sharp` are bundled but appear to be for a non-restaurant use case (image processing). If unused for the pizza flow, they add ~40MB to the deployment. | LOW |
| Circular imports | None detected. Module graph is acyclic. | — |
| TypeScript | Strict mode enabled ✓. However, `route.ts` uses `any` pervasively for payload parsing — acceptable at webhook boundaries but should be narrowed where the shape is known (e.g. `structuredOutputs`). | MEDIUM |
| Error boundaries | No React error boundary wraps the orders page or ticket display. A render error on one order card crashes the whole page. | MEDIUM |

### Order Processing Pipeline

| Item | Detail | Severity |
|------|--------|----------|
| normalize-order.ts injection | Both the AI-extracted path and structured-output review path call `normalizeToChilliOrder` ✓. Both then call `safeParseChilliOrder` ✓. | — |
| Fuzzy matcher coverage | 69 items in `PIZZA_MENU_NAMES`, phonetic aliases for ~25 items. The matcher correctly returns null below threshold. Edge case: single-character names (none currently, safe). | — |
| Zod validation | `safeParseChilliOrder` is used (not `parseChilliOrder`), so failures are logged and the system continues rather than throwing. Correct. | — |
| Schema alignment | `ChilliOrder` (Zod) ↔ `OPENAI_ORDER_SCHEMA` (JSON) alignment is correct. Comment warns to keep in sync manually — this is a risk if they drift. | LOW |
| Empty/null edge cases | Empty `transcript` → `detectFulfillment("")` returns `"pickup"` (safe default ✓). Empty `items[]` → returns valid `ChilliOrder` with empty arrays ✓. `qty=0` → coerced to 1 (silent data change, see W5-adjacent). `null` item name → skipped via `if (!name) continue` ✓. | — |

### Error Handling & Logging

| Item | Detail | Severity |
|------|--------|----------|
| recordingUrl missing | If all recording URL candidates are empty, the review pipeline logs and returns early — no crash ✓. | — |
| Transcript malformed | `transcriptValue.length >= 20` guard prevents AI extraction on very short transcripts ✓. | — |
| structuredOutputs null | `extractStructuredOrderFromReport` returns null → falls back to AI extraction path ✓. | — |
| DB write errors | `createOrder` and `updateOrder` propagate exceptions. The outer try-catch in `route.ts` catches them. The review pipeline has its own try-catch ✓. Constraint violations (e.g. duplicate order_id) would be caught and logged. | — |
| Logging structure | All logging is `console.log/warn/error`. No correlation IDs, no log levels queryable by Railway. | MEDIUM |

### Database Layer

| Item | Detail | Severity |
|------|--------|----------|
| Schema vs code | `orders.fulfillment_type` is `TEXT` (unconstrained) in schema but code assumes `"delivery" \| "pickup" \| "dine_in"`. A DB-level CHECK constraint would be safer. | LOW |
| Migrations | 10 migration files exist. They are run separately via `npm run migrate`. The schema.sql is the "combined" view — they can drift. No migration tool tracks which have been applied (no `schema_migrations` table). | MEDIUM |
| Connection pooling | No explicit `max` set — see QW-3. | MEDIUM |
| SQL injection | All queries in `vapi-storage-db.ts` use parameterized `$1, $2, ...` placeholders throughout. No string interpolation into queries found. ✓ | — |
| Indexes | `calls(organization_id, created_at)` index exists ✓. `orders` index on `organization_id` is present (`idx_orders_org_created_at`). `print_jobs` has no index on `organization_id` — may slow job polling. | LOW |

### UI / Kitchen Ticket Layer

| Item | Detail | Severity |
|------|--------|----------|
| Ticket printer | `renderTicket` handles long names via `toPrintableLine` word-wrap ✓. Many modifiers on one pizza would still fit within 48 chars per line. | — |
| Real-time updates | `NewOrderAlert` component polls for new orders. Polling interval not audited here — if it's < 5s, it adds meaningful DB load in a busy service. | LOW |
| Self-HTTP fetch | `page.tsx:getOrders()` makes an HTTP request from the Next.js server to its own API (`/api/admin/orders`). This adds a network hop and is an anti-pattern in App Router. A direct DB call or a shared server-action would be faster. | MEDIUM |

### Performance

| Item | Detail | Severity |
|------|--------|----------|
| Webhook latency | `route.ts → normalizeToChilliOrder → DB → response` is synchronous and fast. The review pipeline (`transcribeAudioUrl` + `reviewExtractedOrder`) is dispatched as `void` and does not block the webhook response ✓. | — |
| N+1 queries | `page.tsx` makes a single API call returning up to 500 orders. No N+1 detected. | — |
| Bundle size | `replicate` and `sharp` are server-only, so they don't inflate the client bundle. `recharts` is client-side and should be code-split. | LOW |
| Cold start DDL | `initDatabaseWithPool` runs schema.sql (DDL + DML + inserts) on every cold start. On Railway this typically takes 200-500ms but adds latency to the first request after a deploy. | MEDIUM |

### Security

| Item | Detail | Severity |
|------|--------|----------|
| Webhook auth | No HMAC signature check. See MT-1. | HIGH |
| SQL injection | Parameterized queries used throughout ✓. | — |
| CORS | No explicit CORS configuration found for the webhook route — Next.js defaults apply. Acceptable for a server-to-server webhook endpoint. | — |
| Secrets in repo | `STRUCTURED_OUTPUT_ID` has a hardcoded UUID fallback value (`e8cfb9c2-...`) in source code. This is a VAPI resource ID, not a secret key, but it couples environment config to code. | LOW |
| `.env` in repo | No `.env` or `.env.local` files found in repo ✓. | — |
| Error leakage | Stack trace in HTTP response — see CRITICAL-1. | CRITICAL |

### Testing

| Item | Detail | Severity |
|------|--------|----------|
| Unit tests | `render-ticket.test.ts` (3 tests) and `print-jobs.test.ts` (4 tests) exist. Zero tests for `normalize-order.ts`, `match-pizza-name.ts`, or `order-schema.ts`. | MEDIUM |
| Integration tests | None. The full webhook → normalize → DB cycle has no automated test. | MEDIUM |
| E2E | None. | LOW |

### Monitoring & Alerting

| Item | Detail | Severity |
|------|--------|----------|
| Error tracking | No Sentry, LogRocket, or equivalent. Errors are logged to Railway's console but not alerted. | MEDIUM |
| Webhook failure alerting | VAPI retries failed webhooks (HTTP non-200 or timeout). The route always returns 200 even on error — VAPI won't retry. This means silent failures in the DB write path. | MEDIUM |
| DB health | No query latency monitoring or connection pool exhaustion alerts. | LOW |

### Documentation

| Item | Detail | Severity |
|------|--------|----------|
| README | Boilerplate — see QW-5. | LOW |
| Inline comments | Core logic in `normalize-order.ts` and `match-pizza-name.ts` is very well commented. The 40/60 Levenshtein/Dice weighting is documented. | — |
| API schema docs | No OpenAPI/Swagger for `/api/webhooks/vapi`. The `VAPI_WEBHOOK.md` partially covers this. | LOW |

---

*This report reflects the state of the repository as of 2026-03-28. Priority order for remediation: CRITICAL-1 → W2 → W4 → W3 → QW-3 → MT-3 → MT-4.*
