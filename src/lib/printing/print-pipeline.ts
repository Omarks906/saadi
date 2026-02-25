/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";
import { getPool } from "@/lib/db/connection";
import { getTenantId } from "@/lib/tenant";
import { renderTicket, TicketOrder } from "./render-ticket";
import { getPrinterProvider } from "./provider-factory";
import { PrinterProvider } from "./printer";
import type { Order } from "@/lib/vapi-storage";

export type PrintJobStatus = "queued" | "printing" | "sent" | "failed" | "retrying";

export type PrintJobRecord = {
  id: string;
  organizationId: string;
  orderId: string;
  callId?: string | null;
  status: PrintJobStatus;
  attempts: number;
  lastError?: string | null;
  printerTarget?: string | null;
  content?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PrintPipelineResult = {
  ok: boolean;
  skipped?: boolean;
  jobId?: string;
  error?: string;
};

export interface PrintJobStore {
  getByOrder(organizationId: string, orderId: string): Promise<PrintJobRecord | null>;
  insert(job: Omit<PrintJobRecord, "id" | "createdAt" | "updatedAt">): Promise<PrintJobRecord | null>;
  markRetry(organizationId: string, orderId: string): Promise<PrintJobRecord | null>;
  markSent(organizationId: string, orderId: string): Promise<void>;
  markFailed(organizationId: string, orderId: string, error: string): Promise<void>;
}

class PgPrintJobStore implements PrintJobStore {
  async getByOrder(organizationId: string, orderId: string): Promise<PrintJobRecord | null> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM print_jobs WHERE organization_id = $1 AND order_id = $2`,
      [organizationId, orderId]
    );
    if (result.rows.length === 0) return null;
    return rowToPrintJob(result.rows[0]);
  }

  async insert(
    job: Omit<PrintJobRecord, "id" | "createdAt" | "updatedAt">
  ): Promise<PrintJobRecord | null> {
    const pool = getPool();
    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO print_jobs (
        id, organization_id, order_id, call_id, status, attempts, last_error, printer_target, content
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        id,
        job.organizationId,
        job.orderId,
        job.callId || null,
        job.status,
        job.attempts,
        job.lastError || null,
        job.printerTarget || null,
        job.content || "",
      ]
    );
    if (result.rows.length === 0) return null;
    return rowToPrintJob(result.rows[0]);
  }

  async markRetry(organizationId: string, orderId: string): Promise<PrintJobRecord | null> {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE print_jobs
       SET status = 'retrying', updated_at = NOW(), last_error = NULL
       WHERE organization_id = $1 AND order_id = $2 AND status = 'failed'
       RETURNING *`,
      [organizationId, orderId]
    );
    if (result.rows.length === 0) return null;
    return rowToPrintJob(result.rows[0]);
  }

  async markSent(organizationId: string, orderId: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE print_jobs
       SET status = 'sent',
           attempts = attempts + 1,
           last_error = NULL,
           updated_at = NOW()
       WHERE organization_id = $1 AND order_id = $2`,
      [organizationId, orderId]
    );
  }

  async markFailed(organizationId: string, orderId: string, error: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE print_jobs
       SET status = 'failed',
           attempts = attempts + 1,
           last_error = $3,
           updated_at = NOW()
       WHERE organization_id = $1 AND order_id = $2`,
      [organizationId, orderId, error]
    );
  }
}

function rowToPrintJob(row: any): PrintJobRecord {
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

function buildTicketOrder(order: Order): TicketOrder {
  const metadata = (order.metadata || {}) as Record<string, any>;
  const rawEvent = (order.rawEvent || {}) as Record<string, any>;
  const eventOrder = rawEvent.order || rawEvent.message?.order || rawEvent.statusUpdate?.order;
  const eventCustomer = eventOrder?.customer || metadata.customer;
  const eventRestaurant = eventOrder?.restaurant || metadata.restaurant;
  const structuredOutput = metadata.structuredOutput || metadata.structured_output;
  const extraction = metadata.extraction || {};

  return {
    restaurantName: metadata.restaurantName || eventRestaurant?.name || metadata.businessName,
    restaurantPhone: metadata.restaurantPhone || eventRestaurant?.phone || metadata.phone,
    orderNumber: order.orderId,
    confirmedAt: order.confirmedAt,
    fulfillment:
      metadata.fulfillment ||
      extraction.fulfillment ||
      structuredOutput?.fulfillment ||
      order.fulfillmentType ||
      eventOrder?.fulfillment ||
      eventOrder?.type,
    items: order.items,
    notes:
      metadata.notes ||
      eventOrder?.notes ||
      metadata.specialInstructions ||
      order.specialInstructions,
    allergies: metadata.allergies || eventOrder?.allergies || order.allergies,
    customer: {
      name:
        metadata.customerName ||
        structuredOutput?.customerName ||
        eventCustomer?.name ||
        order.customerName,
      phone:
        metadata.customerPhone ||
        structuredOutput?.customerPhone ||
        eventCustomer?.phone ||
        order.customerPhone,
      address:
        metadata.customerAddress ||
        structuredOutput?.address ||
        eventCustomer?.address ||
        eventOrder?.customerAddress ||
        eventOrder?.deliveryAddress ||
        rawEvent?.customerAddress ||
        rawEvent?.deliveryAddress ||
        order.customerAddress ||
        structuredOutput?.address,
    },
    totalAmount: order.totalAmount,
    currency: order.currency,
  };
}

function resolvePrinterTarget(order: Order): string | undefined {
  const metadata = (order.metadata || {}) as Record<string, any>;
  return metadata.printer_target || metadata.printerTarget || undefined;
}

export async function runPrintPipeline(
  order: Order,
  options?: {
    provider?: PrinterProvider;
    store?: PrintJobStore;
    organizationId?: string;
    allowRetrying?: boolean;
  }
): Promise<PrintPipelineResult> {
  const organizationId = options?.organizationId || getTenantId();
  const orderId = order.orderId;
  if (!orderId) {
    return { ok: false, error: "missing_order_id" };
  }

  const store = options?.store || new PgPrintJobStore();
  const provider = options?.provider || getPrinterProvider();

  const existing = await store.getByOrder(organizationId, orderId);
  if (existing) {
    if (existing.status === "sent") {
      return { ok: true, skipped: true, jobId: existing.id };
    }
    if (existing.status === "retrying" && options?.allowRetrying) {
      // allow retrying jobs to proceed
    } else if (existing.status !== "failed") {
      return { ok: true, skipped: true, jobId: existing.id };
    }
  }

  const ticket = renderTicket(buildTicketOrder(order));

  let job: PrintJobRecord | null = null;
  if (!existing) {
    job = await store.insert({
      organizationId,
      orderId,
      callId: order.callId || null,
      status: "queued",
      attempts: 0,
      lastError: null,
      printerTarget: resolvePrinterTarget(order) || null,
      content: ticket,
    });
  } else if (existing?.status === "failed") {
    job = await store.markRetry(organizationId, orderId);
  }

  if (!job) {
    const current = await store.getByOrder(organizationId, orderId);
    if (current?.status === "sent" || current?.status === "queued" || current?.status === "retrying") {
      return { ok: true, skipped: true, jobId: current?.id };
    }
  }

  if (process.env.PRINT_TEST_MODE === "1") {
    console.log(
      JSON.stringify({
        event: "print_test_mode",
        organization_id: organizationId,
        order_id: orderId,
        printer_target: resolvePrinterTarget(order) || null,
        created_at: order.createdAt,
        ticket_text: ticket,
      })
    );
    await store.markSent(organizationId, orderId);
    return { ok: true, skipped: true, jobId: job?.id || existing?.id };
  }

  const result = await provider.send(ticket, {
    organization_id: organizationId,
    order_id: orderId,
    printer_target: resolvePrinterTarget(order),
    created_at: order.createdAt,
  });

  if (result.ok) {
    if (result.deferred) {
      return { ok: true, skipped: true, jobId: job?.id || existing?.id || result.jobId };
    }
    await store.markSent(organizationId, orderId);
    return { ok: true, jobId: result.jobId };
  }

  await store.markFailed(organizationId, orderId, result.error || "print_failed");
  return { ok: false, error: result.error || "print_failed" };
}
