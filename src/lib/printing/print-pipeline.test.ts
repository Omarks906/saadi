import assert from "node:assert/strict";
import { test } from "node:test";
import { runPrintPipeline, PrintJobRecord, PrintJobStore } from "./print-pipeline";
import type { PrinterProvider } from "./printer";
import type { Order } from "@/lib/vapi-storage";

class InMemoryPrintJobStore implements PrintJobStore {
  private jobs = new Map<string, PrintJobRecord>();

  constructor(seed?: PrintJobRecord[]) {
    seed?.forEach((job) => {
      this.jobs.set(this.key(job.organizationId, job.orderId), job);
    });
  }

  private key(orgId: string, orderId: string) {
    return `${orgId}:${orderId}`;
  }

  async getByOrder(organizationId: string, orderId: string) {
    return this.jobs.get(this.key(organizationId, orderId)) || null;
  }

  async insert(job: Omit<PrintJobRecord, "id" | "createdAt" | "updatedAt">) {
    const existing = await this.getByOrder(job.organizationId, job.orderId);
    if (existing) return null;
    const record: PrintJobRecord = {
      id: "job-1",
      organizationId: job.organizationId,
      orderId: job.orderId,
      callId: job.callId || null,
      status: job.status,
      attempts: job.attempts,
      lastError: job.lastError || null,
      printerTarget: job.printerTarget || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.jobs.set(this.key(job.organizationId, job.orderId), record);
    return record;
  }

  async markRetry(organizationId: string, orderId: string) {
    const job = await this.getByOrder(organizationId, orderId);
    if (!job || job.status !== "failed") return null;
    job.status = "retrying";
    job.updatedAt = new Date().toISOString();
    job.lastError = null;
    this.jobs.set(this.key(organizationId, orderId), job);
    return job;
  }

  async markSent(organizationId: string, orderId: string) {
    const job = await this.getByOrder(organizationId, orderId);
    if (!job) return;
    job.status = "sent";
    job.attempts += 1;
    job.lastError = null;
    job.updatedAt = new Date().toISOString();
    this.jobs.set(this.key(organizationId, orderId), job);
  }

  async markFailed(organizationId: string, orderId: string, error: string) {
    const job = await this.getByOrder(organizationId, orderId);
    if (!job) return;
    job.status = "failed";
    job.attempts += 1;
    job.lastError = error;
    job.updatedAt = new Date().toISOString();
    this.jobs.set(this.key(organizationId, orderId), job);
  }
}

class StubPrinterProvider implements PrinterProvider {
  public calls: string[] = [];
  constructor(private result: { ok: true; jobId?: string } | { ok: false; error: string }) {}

  async send() {
    this.calls.push("sent");
    return this.result;
  }
}

function baseOrder(): Order {
  return {
    id: "order-row-1",
    orderId: "order-1",
    callId: "call-1",
    tenantId: "tenant-1",
    createdAt: new Date().toISOString(),
    confirmedAt: new Date().toISOString(),
    status: "confirmed",
    businessType: "restaurant",
    customerId: "cust-1",
    items: [{ name: "Pizza", quantity: 1 }],
    totalAmount: 10,
    currency: "USD",
    metadata: {},
    rawEvent: {},
  };
}

test("runPrintPipeline is idempotent for sent jobs", async () => {
  const store = new InMemoryPrintJobStore([
    {
      id: "job-1",
      organizationId: "tenant-1",
      orderId: "order-1",
      callId: "call-1",
      status: "sent",
      attempts: 1,
      lastError: null,
      printerTarget: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);
  const provider = new StubPrinterProvider({ ok: true, jobId: "job-123" });

  const result = await runPrintPipeline(baseOrder(), {
    provider,
    store,
    organizationId: "tenant-1",
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(provider.calls.length, 0);
});

test("runPrintPipeline marks failed and increments attempts", async () => {
  const store = new InMemoryPrintJobStore();
  const provider = new StubPrinterProvider({ ok: false, error: "printer_offline" });

  const result = await runPrintPipeline(baseOrder(), {
    provider,
    store,
    organizationId: "tenant-1",
  });

  const job = await store.getByOrder("tenant-1", "order-1");
  assert.equal(result.ok, false);
  assert.equal(job?.status, "failed");
  assert.equal(job?.attempts, 1);
  assert.equal(job?.lastError, "printer_offline");
});

test("runPrintPipeline retries failed jobs and marks sent", async () => {
  const store = new InMemoryPrintJobStore([
    {
      id: "job-1",
      organizationId: "tenant-1",
      orderId: "order-1",
      callId: "call-1",
      status: "failed",
      attempts: 1,
      lastError: "timeout",
      printerTarget: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);
  const provider = new StubPrinterProvider({ ok: true, jobId: "job-456" });

  const result = await runPrintPipeline(baseOrder(), {
    provider,
    store,
    organizationId: "tenant-1",
  });

  const job = await store.getByOrder("tenant-1", "order-1");
  assert.equal(result.ok, true);
  assert.equal(job?.status, "sent");
  assert.equal(job?.attempts, 2);
  assert.equal(job?.lastError, null);
});

test("runPrintPipeline skips queued jobs", async () => {
  const store = new InMemoryPrintJobStore([
    {
      id: "job-queued",
      organizationId: "tenant-1",
      orderId: "order-1",
      callId: "call-1",
      status: "queued",
      attempts: 0,
      lastError: null,
      printerTarget: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);
  const provider = new StubPrinterProvider({ ok: true, jobId: "job-queued" });

  const result = await runPrintPipeline(baseOrder(), {
    provider,
    store,
    organizationId: "tenant-1",
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(provider.calls.length, 0);
});

test("runPrintPipeline skips retrying jobs even when allowRetrying is true", async () => {
  const store = new InMemoryPrintJobStore([
    {
      id: "job-retrying",
      organizationId: "tenant-1",
      orderId: "order-1",
      callId: "call-1",
      status: "retrying",
      attempts: 1,
      lastError: "timeout",
      printerTarget: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);
  const provider = new StubPrinterProvider({ ok: true, jobId: "job-retrying" });

  const result = await runPrintPipeline(baseOrder(), {
    provider,
    store,
    organizationId: "tenant-1",
    allowRetrying: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(provider.calls.length, 0);
});

test("runPrintPipeline returns error when orderId is missing", async () => {
  const store = new InMemoryPrintJobStore();
  const provider = new StubPrinterProvider({ ok: true, jobId: "job-123" });
  const order = { ...baseOrder(), orderId: "" };

  const result = await runPrintPipeline(order, {
    provider,
    store,
    organizationId: "tenant-1",
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "missing_order_id");
  assert.equal(provider.calls.length, 0);
});
