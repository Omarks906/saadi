import * as crypto from "crypto";
import { getPool, initDatabase } from "./db/connection";
import { BusinessType, getBusinessTypeFromAssistantId } from "./vapi-assistant-map";
import { getTenantId } from "./tenant";

// Export types (same as vapi-storage.ts)
export type Call = {
  id: string;
  callId: string;
  tenantId: string;
  createdAt: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  status: "started" | "ended" | "failed";
  businessType?: BusinessType | null;
  scores?: Record<"restaurant" | "car" | "other", number>;
  detectedFrom?: string;
  confidence?: number;
  phoneNumber?: string;
  customerId?: string;
  metadata?: Record<string, any>;
  rawEvent?: any;
};

export type Order = {
  id: string;
  orderId: string;
  callId?: string;
  tenantId: string;
  createdAt: string;
  confirmedAt: string;
  status: "confirmed" | "cancelled" | "completed";
  businessType?: BusinessType | null;
  customerId?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price?: number;
    description?: string;
  }>;
  totalAmount?: number;
  currency?: string;
  metadata?: Record<string, any>;
  rawEvent?: any;
};

/**
 * Extract assistantId from payload
 */
export function extractAssistantId(payload: any): string | undefined {
  return payload.assistantId || 
         payload.assistant_id || 
         payload.call?.assistantId || 
         payload.call?.assistant_id;
}

// Initialize database on module load (only once)
let dbInitialized = false;
async function ensureDbInitialized() {
  if (!dbInitialized) {
    try {
      await initDatabase();
      dbInitialized = true;
    } catch (error) {
      console.error("[VAPI Storage DB] Failed to initialize database:", error);
      // Continue anyway - might fail in some environments, but will retry on first query
    }
  }
}

/**
 * Convert database row to Call object
 */
function rowToCall(row: any): Call {
  return {
    id: row.id,
    callId: row.call_id,
    tenantId: row.tenant_id,
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: row.ended_at || undefined,
    durationSeconds: row.duration_seconds || undefined,
    status: row.status,
    businessType: row.business_type || null,
    scores: row.scores || undefined,
    detectedFrom: row.detected_from || undefined,
    confidence: row.confidence ? parseFloat(row.confidence) : undefined,
    phoneNumber: row.phone_number || undefined,
    customerId: row.customer_id || undefined,
    metadata: row.metadata || undefined,
    rawEvent: row.raw_event || undefined,
  };
}

/**
 * Convert Call object to database row
 */
function callToRow(call: Call): any {
  return {
    id: call.id,
    call_id: call.callId,
    tenant_id: call.tenantId,
    created_at: call.createdAt,
    started_at: call.startedAt,
    ended_at: call.endedAt || null,
    duration_seconds: call.durationSeconds || null,
    status: call.status,
    business_type: call.businessType || null,
    scores: call.scores || null,
    detected_from: call.detectedFrom || null,
    confidence: call.confidence || null,
    phone_number: call.phoneNumber || null,
    customer_id: call.customerId || null,
    metadata: call.metadata || null,
    raw_event: call.rawEvent || null,
  };
}

/**
 * Convert database row to Order object
 */
function rowToOrder(row: any): Order {
  return {
    id: row.id,
    orderId: row.order_id,
    callId: row.call_id || undefined,
    tenantId: row.tenant_id,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    status: row.status,
    businessType: row.business_type || null,
    customerId: row.customer_id || undefined,
    items: row.items || undefined,
    totalAmount: row.total_amount ? parseFloat(row.total_amount) : undefined,
    currency: row.currency || undefined,
    metadata: row.metadata || undefined,
    rawEvent: row.raw_event || undefined,
  };
}

/**
 * Convert Order object to database row
 */
function orderToRow(order: Order): any {
  return {
    id: order.id,
    order_id: order.orderId,
    call_id: order.callId || null,
    tenant_id: order.tenantId,
    created_at: order.createdAt,
    confirmed_at: order.confirmedAt,
    status: order.status,
    business_type: order.businessType || null,
    customer_id: order.customerId || null,
    items: order.items || null,
    total_amount: order.totalAmount || null,
    currency: order.currency || null,
    metadata: order.metadata || null,
    raw_event: order.rawEvent || null,
  };
}

/**
 * Create a new Call record from webhook event
 */
export async function createCall(event: any): Promise<Call> {
  await ensureDbInitialized();
  const pool = getPool();
  const tenantId = getTenantId();
  
  const id = crypto.randomBytes(8).toString("hex");
  const assistantId = extractAssistantId(event);
  if (!assistantId) console.warn("[VAPI] assistantId missing");
  const bt = getBusinessTypeFromAssistantId(assistantId);
  if (assistantId && !bt) console.warn("[VAPI] assistantId not in map:", assistantId);
  
  const call: Call = {
    id,
    callId: event.call?.id || event.id || crypto.randomBytes(8).toString("hex"),
    tenantId,
    createdAt: new Date().toISOString(),
    startedAt: event.startedAt || event.timestamp || new Date().toISOString(),
    status: "started",
    businessType: bt ?? "car",
    phoneNumber: event.call?.phoneNumber || event.phoneNumber,
    customerId: event.call?.customerId || event.customerId,
    metadata: event.call?.metadata || event.metadata,
    rawEvent: event,
  };
  
  const row = callToRow(call);
  await pool.query(
    `INSERT INTO calls (
      id, call_id, tenant_id, created_at, started_at, ended_at, duration_seconds,
      status, business_type, scores, detected_from, confidence,
      phone_number, customer_id, metadata, raw_event
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      row.id, row.call_id, row.tenant_id, row.created_at, row.started_at, row.ended_at,
      row.duration_seconds, row.status, row.business_type,
      row.scores ? JSON.stringify(row.scores) : null,
      row.detected_from, row.confidence,
      row.phone_number, row.customer_id,
      row.metadata ? JSON.stringify(row.metadata) : null,
      row.raw_event ? JSON.stringify(row.raw_event) : null,
    ]
  );
  
  console.log(`[VAPI Storage DB] Created call ${call.id} (callId: ${call.callId})`);
  return call;
}

/**
 * Read a Call by ID
 */
export async function readCall(id: string): Promise<Call> {
  await ensureDbInitialized();
  const pool = getPool();
  const tenantId = getTenantId();
  
  const result = await pool.query(
    "SELECT * FROM calls WHERE id = $1 AND tenant_id = $2",
    [id, tenantId]
  );
  if (result.rows.length === 0) {
    throw new Error(`Call with id ${id} not found`);
  }
  
  return rowToCall(result.rows[0]);
}

export async function readCallByOrganization(id: string, organizationId: string): Promise<Call> {
  await ensureDbInitialized();
  const pool = getPool();

  const result = await pool.query(
    "SELECT * FROM calls WHERE id = $1 AND organization_id = $2",
    [id, organizationId]
  );
  if (result.rows.length === 0) {
    throw new Error(`Call with id ${id} not found`);
  }

  return rowToCall(result.rows[0]);
}

/**
 * Update a Call record
 */
export async function updateCall(call: Call): Promise<void> {
  await ensureDbInitialized();
  const pool = getPool();
  const tenantId = getTenantId();
  
  call.tenantId = tenantId;
  const row = callToRow(call);
  await pool.query(
    `UPDATE calls SET
      call_id = $2, started_at = $3, ended_at = $4, duration_seconds = $5,
      status = $6, business_type = $7, scores = $8, detected_from = $9, confidence = $10,
      phone_number = $11, customer_id = $12, metadata = $13, raw_event = $14
    WHERE id = $1 AND tenant_id = $15`,
    [
      row.id, row.call_id, row.started_at, row.ended_at, row.duration_seconds,
      row.status, row.business_type,
      row.scores ? JSON.stringify(row.scores) : null,
      row.detected_from, row.confidence,
      row.phone_number, row.customer_id,
      row.metadata ? JSON.stringify(row.metadata) : null,
      row.raw_event ? JSON.stringify(row.raw_event) : null,
      row.tenant_id,
    ]
  );
}

/**
 * Find a Call by VAPI callId
 */
export async function findCallByCallId(callId: string): Promise<Call | null> {
  await ensureDbInitialized();
  const pool = getPool();
  const tenantId = getTenantId();
  
  try {
    const result = await pool.query(
      "SELECT * FROM calls WHERE call_id = $1 AND tenant_id = $2",
      [callId, tenantId]
    );
    if (result.rows.length === 0) {
      return null;
    }
    return rowToCall(result.rows[0]);
  } catch (error) {
    console.error("[VAPI Storage DB] Error finding call:", error);
    return null;
  }
}

/**
 * Create a new Order record from webhook event
 */
export async function createOrder(event: any): Promise<Order> {
  await ensureDbInitialized();
  const pool = getPool();
  const tenantId = getTenantId();
  
  const id = crypto.randomBytes(8).toString("hex");
  const callId = event.order?.callId || event.callId;
  const assistantId = extractAssistantId(event);
  if (!assistantId) console.warn("[VAPI] assistantId missing");
  const bt = getBusinessTypeFromAssistantId(assistantId);
  if (assistantId && !bt) console.warn("[VAPI] assistantId not in map:", assistantId);
  
  const order: Order = {
    id,
    orderId: event.order?.id || event.id || crypto.randomBytes(8).toString("hex"),
    callId,
    tenantId,
    createdAt: new Date().toISOString(),
    confirmedAt: event.confirmedAt || event.timestamp || new Date().toISOString(),
    status: "confirmed",
    businessType: bt ?? "car",
    customerId: event.order?.customerId || event.customerId,
    items: event.order?.items || event.items,
    totalAmount: event.order?.totalAmount || event.totalAmount,
    currency: event.order?.currency || event.currency || "USD",
    metadata: event.order?.metadata || event.metadata,
    rawEvent: event,
  };
  
  const row = orderToRow(order);
  await pool.query(
    `INSERT INTO orders (
      id, order_id, call_id, tenant_id, created_at, confirmed_at, status,
      business_type, customer_id, items, total_amount, currency, metadata, raw_event
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      row.id, row.order_id, row.call_id, row.tenant_id, row.created_at, row.confirmed_at,
      row.status, row.business_type, row.customer_id,
      row.items ? JSON.stringify(row.items) : null,
      row.total_amount, row.currency,
      row.metadata ? JSON.stringify(row.metadata) : null,
      row.raw_event ? JSON.stringify(row.raw_event) : null,
    ]
  );
  
  return order;
}

/**
 * Read an Order by ID
 */
export async function readOrder(id: string): Promise<Order> {
  await ensureDbInitialized();
  const pool = getPool();
  const tenantId = getTenantId();
  
  const result = await pool.query(
    "SELECT * FROM orders WHERE id = $1 AND tenant_id = $2",
    [id, tenantId]
  );
  if (result.rows.length === 0) {
    throw new Error(`Order with id ${id} not found`);
  }
  
  return rowToOrder(result.rows[0]);
}

/**
 * Update an Order record
 */
export async function updateOrder(order: Order): Promise<void> {
  await ensureDbInitialized();
  const pool = getPool();
  const tenantId = getTenantId();
  
  order.tenantId = tenantId;
  const row = orderToRow(order);
  await pool.query(
    `UPDATE orders SET
      order_id = $2, call_id = $3, confirmed_at = $4, status = $5,
      business_type = $6, customer_id = $7, items = $8, total_amount = $9,
      currency = $10, metadata = $11, raw_event = $12
    WHERE id = $1 AND tenant_id = $13`,
    [
      row.id, row.order_id, row.call_id, row.confirmed_at, row.status,
      row.business_type, row.customer_id,
      row.items ? JSON.stringify(row.items) : null,
      row.total_amount, row.currency,
      row.metadata ? JSON.stringify(row.metadata) : null,
      row.raw_event ? JSON.stringify(row.raw_event) : null,
      row.tenant_id,
    ]
  );
}

/**
 * Find an Order by VAPI orderId
 */
export async function findOrderByOrderId(orderId: string): Promise<Order | null> {
  await ensureDbInitialized();
  const pool = getPool();
  const tenantId = getTenantId();
  
  try {
    const result = await pool.query(
      "SELECT * FROM orders WHERE order_id = $1 AND tenant_id = $2",
      [orderId, tenantId]
    );
    if (result.rows.length === 0) {
      return null;
    }
    return rowToOrder(result.rows[0]);
  } catch (error) {
    console.error("[VAPI Storage DB] Error finding order:", error);
    return null;
  }
}

export async function findOrderByOrderIdByOrganization(
  orderId: string,
  organizationId: string
): Promise<Order | null> {
  await ensureDbInitialized();
  const pool = getPool();

  try {
    const result = await pool.query(
      "SELECT * FROM orders WHERE order_id = $1 AND organization_id = $2",
      [orderId, organizationId]
    );
    if (result.rows.length === 0) {
      return null;
    }
    return rowToOrder(result.rows[0]);
  } catch (error) {
    console.error("[VAPI Storage DB] Error finding order:", error);
    return null;
  }
}

/**
 * List all Calls
 */
export async function listCalls(): Promise<Call[]> {
  await ensureDbInitialized();
  const pool = getPool();
  const tenantId = getTenantId();
  
  try {
    const result = await pool.query(
      "SELECT * FROM calls WHERE tenant_id = $1 ORDER BY created_at DESC",
      [tenantId]
    );
    return result.rows.map(rowToCall);
  } catch (error) {
    console.error("[VAPI Storage DB] Error listing calls:", error);
    return [];
  }
}

export async function listCallsByOrganization(organizationId: string): Promise<Call[]> {
  await ensureDbInitialized();
  const pool = getPool();

  try {
    const result = await pool.query(
      "SELECT * FROM calls WHERE organization_id = $1 ORDER BY created_at DESC",
      [organizationId]
    );
    return result.rows.map(rowToCall);
  } catch (error) {
    console.error("[VAPI Storage DB] Error listing calls:", error);
    return [];
  }
}

/**
 * List all Orders
 */
export async function listOrders(): Promise<Order[]> {
  await ensureDbInitialized();
  const pool = getPool();
  const tenantId = getTenantId();
  
  try {
    const result = await pool.query(
      "SELECT * FROM orders WHERE tenant_id = $1 ORDER BY created_at DESC",
      [tenantId]
    );
    return result.rows.map(rowToOrder);
  } catch (error) {
    console.error("[VAPI Storage DB] Error listing orders:", error);
    return [];
  }
}

