import { getPool } from "@/lib/db/connection";

export type PrintJobListItem = {
  id: string;
  organizationId: string;
  orderId: string;
  callId?: string | null;
  status: string;
  attempts: number;
  lastError?: string | null;
  printerTarget?: string | null;
  content?: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface PrintJobQueryStore {
  listFailed(organizationId: string, limit: number): Promise<PrintJobListItem[]>;
  listRecent(organizationId: string, limit: number, status?: string): Promise<PrintJobListItem[]>;
}

function rowToListItem(row: any): PrintJobListItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    orderId: row.order_id,
    callId: row.call_id || null,
    status: row.status,
    attempts: Number(row.attempts) || 0,
    lastError: row.last_error || null,
    printerTarget: row.printer_target || null,
    content: row.content || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class PgPrintJobQueryStore implements PrintJobQueryStore {
  async listFailed(organizationId: string, limit: number): Promise<PrintJobListItem[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT *
       FROM print_jobs
       WHERE organization_id = $1 AND status = 'failed'
       ORDER BY created_at DESC
       LIMIT $2`,
      [organizationId, limit]
    );
    return result.rows.map(rowToListItem);
  }

  async listRecent(organizationId: string, limit: number, status?: string): Promise<PrintJobListItem[]> {
    const pool = getPool();
    const VALID_STATUSES = ["queued", "printing", "sent", "failed", "retrying"];
    if (status && !VALID_STATUSES.includes(status)) {
      throw new Error(`Invalid status filter: ${status}`);
    }
    const result = status
      ? await pool.query(
          `SELECT * FROM print_jobs WHERE organization_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3`,
          [organizationId, status, limit]
        )
      : await pool.query(
          `SELECT * FROM print_jobs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`,
          [organizationId, limit]
        );
    return result.rows.map(rowToListItem);
  }
}

export interface PrintJobAdminStore {
  getById(organizationId: string, id: string): Promise<PrintJobListItem | null>;
  markRetrying(organizationId: string, id: string): Promise<PrintJobListItem | null>;
}

class PgPrintJobAdminStore implements PrintJobAdminStore {
  async getById(organizationId: string, id: string): Promise<PrintJobListItem | null> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM print_jobs WHERE organization_id = $1 AND id = $2`,
      [organizationId, id]
    );
    if (result.rows.length === 0) return null;
    return rowToListItem(result.rows[0]);
  }

  async markRetrying(organizationId: string, id: string): Promise<PrintJobListItem | null> {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE print_jobs
       SET status = 'retrying', updated_at = NOW()
       WHERE organization_id = $1 AND id = $2 AND status = 'failed'
       RETURNING *`,
      [organizationId, id]
    );
    if (result.rows.length === 0) return null;
    return rowToListItem(result.rows[0]);
  }
}

export async function listFailedPrintJobs(options: {
  organizationId: string;
  limit?: number;
  store?: PrintJobQueryStore;
}): Promise<PrintJobListItem[]> {
  const limit = options.limit ?? 50;
  const store = options.store || new PgPrintJobQueryStore();
  return store.listFailed(options.organizationId, limit);
}

export async function listRecentPrintJobs(options: {
  organizationId: string;
  limit?: number;
  status?: string;
  store?: PrintJobQueryStore;
}): Promise<PrintJobListItem[]> {
  const limit = options.limit ?? 50;
  const store = options.store || new PgPrintJobQueryStore();
  return store.listRecent(options.organizationId, limit, options.status);
}

export async function getPrintJobById(options: {
  organizationId: string;
  id: string;
  store?: PrintJobAdminStore;
}): Promise<PrintJobListItem | null> {
  const store = options.store || new PgPrintJobAdminStore();
  return store.getById(options.organizationId, options.id);
}

export async function markPrintJobRetrying(options: {
  organizationId: string;
  id: string;
  store?: PrintJobAdminStore;
}): Promise<PrintJobListItem | null> {
  const store = options.store || new PgPrintJobAdminStore();
  return store.markRetrying(options.organizationId, options.id);
}
