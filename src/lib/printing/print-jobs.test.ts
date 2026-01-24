import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getPrintJobById,
  listFailedPrintJobs,
  markPrintJobRetrying,
  PrintJobAdminStore,
  PrintJobListItem,
  PrintJobQueryStore,
} from "./print-jobs";

class SpyStore implements PrintJobQueryStore {
  public seenOrganizationId: string | null = null;
  public seenLimit: number | null = null;

  async listFailed(organizationId: string, limit: number): Promise<PrintJobListItem[]> {
    this.seenOrganizationId = organizationId;
    this.seenLimit = limit;
    return [];
  }
}

class InMemoryStore implements PrintJobQueryStore {
  constructor(private jobs: PrintJobListItem[]) {}

  async listFailed(organizationId: string, limit: number): Promise<PrintJobListItem[]> {
    return this.jobs
      .filter((job) => job.organizationId === organizationId && job.status === "failed")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
}

class InMemoryAdminStore implements PrintJobAdminStore {
  constructor(private jobs: PrintJobListItem[]) {}

  async getById(organizationId: string, id: string): Promise<PrintJobListItem | null> {
    return (
      this.jobs.find((job) => job.organizationId === organizationId && job.id === id) || null
    );
  }

  async markRetrying(organizationId: string, id: string): Promise<PrintJobListItem | null> {
    const job = this.jobs.find(
      (item) => item.organizationId === organizationId && item.id === id
    );
    if (!job || job.status !== "failed") return null;
    job.status = "retrying";
    return job;
  }
}

test("listFailedPrintJobs passes tenant and limit to store", async () => {
  const store = new SpyStore();
  await listFailedPrintJobs({
    organizationId: "tenant-1",
    limit: 50,
    store,
  });

  assert.equal(store.seenOrganizationId, "tenant-1");
  assert.equal(store.seenLimit, 50);
});

test("listFailedPrintJobs returns only tenant failed jobs", async () => {
  const jobs: PrintJobListItem[] = [
    {
      id: "job-1",
      organizationId: "tenant-1",
      orderId: "order-1",
      callId: null,
      status: "failed",
      attempts: 1,
      lastError: "timeout",
      printerTarget: null,
      createdAt: "2026-01-23T10:00:00Z",
      updatedAt: "2026-01-23T10:05:00Z",
    },
    {
      id: "job-2",
      organizationId: "tenant-2",
      orderId: "order-2",
      callId: null,
      status: "failed",
      attempts: 1,
      lastError: "offline",
      printerTarget: null,
      createdAt: "2026-01-23T11:00:00Z",
      updatedAt: "2026-01-23T11:05:00Z",
    },
    {
      id: "job-3",
      organizationId: "tenant-1",
      orderId: "order-3",
      callId: null,
      status: "sent",
      attempts: 1,
      lastError: null,
      printerTarget: null,
      createdAt: "2026-01-23T12:00:00Z",
      updatedAt: "2026-01-23T12:05:00Z",
    },
  ];

  const store = new InMemoryStore(jobs);
  const result = await listFailedPrintJobs({
    organizationId: "tenant-1",
    store,
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].orderId, "order-1");
});

test("getPrintJobById is tenant scoped", async () => {
  const jobs: PrintJobListItem[] = [
    {
      id: "job-1",
      organizationId: "tenant-1",
      orderId: "order-1",
      callId: null,
      status: "failed",
      attempts: 1,
      lastError: "timeout",
      printerTarget: null,
      createdAt: "2026-01-23T10:00:00Z",
      updatedAt: "2026-01-23T10:05:00Z",
    },
  ];

  const store = new InMemoryAdminStore(jobs);
  const result = await getPrintJobById({
    organizationId: "tenant-2",
    id: "job-1",
    store,
  });

  assert.equal(result, null);
});

test("markPrintJobRetrying only updates failed for tenant", async () => {
  const jobs: PrintJobListItem[] = [
    {
      id: "job-1",
      organizationId: "tenant-1",
      orderId: "order-1",
      callId: null,
      status: "failed",
      attempts: 1,
      lastError: "timeout",
      printerTarget: null,
      createdAt: "2026-01-23T10:00:00Z",
      updatedAt: "2026-01-23T10:05:00Z",
    },
  ];

  const store = new InMemoryAdminStore(jobs);
  const result = await markPrintJobRetrying({
    organizationId: "tenant-1",
    id: "job-1",
    store,
  });

  assert.equal(result?.status, "retrying");
});
