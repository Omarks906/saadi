import * as crypto from "crypto";
import { getPool, initDatabase } from "./db/connection";
import { BusinessType, getBusinessTypeFromAssistantId } from "./vapi-assistant-map";
import { getTenantId } from "./tenant";

// Export types (same as vapi-storage.ts)
export type Call = {
  id: string;
  callId: string;
  tenantId: string;
  organizationId: string;
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

// Order status types - expanded for kitchen workflow
export type OrderStatus =
  | "confirmed"    // Order received
  | "preparing"    // Kitchen is preparing
  | "ready"        // Ready for pickup/delivery
  | "out_for_delivery" // On the way (delivery only)
  | "completed"    // Delivered/picked up
  | "cancelled";   // Order cancelled

export type Order = {
  id: string;
  orderId: string;
  orderNumber: number;
  callId?: string;
  tenantId: string;
  organizationId: string;
  createdAt: string;
  confirmedAt: string;
  status: OrderStatus;
  businessType?: BusinessType | null;
  customerId?: string;
  fulfillmentType?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  scheduledFor?: string;
  specialInstructions?: string;
  allergies?: string;
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
  return (
    payload.assistantId ||
    payload.assistant_id ||
    payload.assistant?.id ||
    payload.message?.assistant?.id ||
    payload.message?.assistantId ||
    payload.message?.assistant_id ||
    payload.call?.assistantId ||
    payload.call?.assistant_id ||
    payload.call?.assistant?.id ||
    payload.newAssistant?.id ||
    payload.message?.newAssistant?.id
  );
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
    organizationId: row.organization_id,
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
    organization_id: call.organizationId,
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
    orderNumber: row.order_number,
    callId: row.call_id || undefined,
    tenantId: row.tenant_id,
    organizationId: row.organization_id,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    status: row.status,
    businessType: row.business_type || null,
    customerId: row.customer_id || undefined,
    fulfillmentType: row.fulfillment_type || undefined,
    customerName: row.customer_name || undefined,
    customerPhone: row.customer_phone || undefined,
    customerAddress: row.customer_address || undefined,
    scheduledFor: row.scheduled_for || undefined,
    specialInstructions: row.special_instructions || undefined,
    allergies: row.allergies || undefined,
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
    order_number: order.orderNumber,
    call_id: order.callId || null,
    tenant_id: order.tenantId,
    organization_id: order.organizationId,
    created_at: order.createdAt,
    confirmed_at: order.confirmedAt,
    status: order.status,
    business_type: order.businessType || null,
    customer_id: order.customerId || null,
    customer_name: order.customerName || null,
    customer_phone: order.customerPhone || null,
    customer_address: order.customerAddress || null,
    scheduled_for: order.scheduledFor || null,
    special_instructions: order.specialInstructions || null,
    allergies: order.allergies || null,
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
export async function createCall(
  event: any,
  options?: { organizationId?: string }
): Promise<Call> {
  await ensureDbInitialized();
  const pool = getPool();
  const organizationId = options?.organizationId || getTenantId();
  const tenantId = organizationId;
  
  const id = crypto.randomBytes(8).toString("hex");
  const assistantId = extractAssistantId(event);
  if (!assistantId) console.warn("[VAPI] assistantId missing");
  const bt = getBusinessTypeFromAssistantId(assistantId);
  if (assistantId && !bt) console.warn("[VAPI] assistantId not in map:", assistantId);
  
  const call: Call = {
    id,
    callId: event.call?.id || event.id || crypto.randomBytes(8).toString("hex"),
    tenantId,
    organizationId,
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
      id, call_id, tenant_id, organization_id,
      created_at, started_at, ended_at, duration_seconds,
      status, business_type, scores, detected_from, confidence,
      phone_number, customer_id, metadata, raw_event
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
    [
      row.id, row.call_id, row.tenant_id, row.organization_id,
      row.created_at, row.started_at, row.ended_at, row.duration_seconds,
      row.status, row.business_type,
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
  const organizationId = call.organizationId || getTenantId();
  call.organizationId = organizationId;
  call.tenantId = call.tenantId || organizationId;
  const row = callToRow(call);
  await pool.query(
    `UPDATE calls SET
      call_id = $2, started_at = $3, ended_at = $4, duration_seconds = $5,
      status = $6, business_type = $7, scores = $8, detected_from = $9, confidence = $10,
      phone_number = $11, customer_id = $12, metadata = $13, raw_event = $14
    WHERE id = $1 AND organization_id = $15`,
    [
      row.id, row.call_id, row.started_at, row.ended_at, row.duration_seconds,
      row.status, row.business_type,
      row.scores ? JSON.stringify(row.scores) : null,
      row.detected_from, row.confidence,
      row.phone_number, row.customer_id,
      row.metadata ? JSON.stringify(row.metadata) : null,
      row.raw_event ? JSON.stringify(row.raw_event) : null,
      row.organization_id,
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

export async function findCallByCallIdByOrganization(
  callId: string,
  organizationId: string
): Promise<Call | null> {
  await ensureDbInitialized();
  const pool = getPool();

  try {
    const result = await pool.query(
      "SELECT * FROM calls WHERE call_id = $1 AND organization_id = $2",
      [callId, organizationId]
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
 * Get the next order number for an organization
 */
async function getNextOrderNumber(organizationId: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT COALESCE(MAX(order_number), 0) + 1 as next_number
     FROM orders WHERE organization_id = $1`,
    [organizationId]
  );
  return parseInt(result.rows[0].next_number, 10);
}

/**
 * Create a new Order record from webhook event
 */
export async function createOrder(
  event: any,
  options?: { organizationId?: string }
): Promise<Order> {
  await ensureDbInitialized();
  const pool = getPool();
  const organizationId = options?.organizationId || getTenantId();
  const tenantId = organizationId;

  const id = crypto.randomBytes(8).toString("hex");
  const callId = event.order?.callId || event.callId;
  const assistantId = extractAssistantId(event);
  if (!assistantId) console.warn("[VAPI] assistantId missing");
  const bt = getBusinessTypeFromAssistantId(assistantId);
  if (assistantId && !bt) console.warn("[VAPI] assistantId not in map:", assistantId);

  // Get next sequential order number for this organization
  const orderNumber = await getNextOrderNumber(organizationId);

  const order: Order = {
    id,
    orderId: event.order?.id || event.id || crypto.randomBytes(8).toString("hex"),
    orderNumber,
    callId,
    tenantId,
    organizationId,
    createdAt: new Date().toISOString(),
    confirmedAt: event.confirmedAt || event.timestamp || new Date().toISOString(),
    status: "confirmed",
    businessType: bt ?? "car",
    customerId: event.order?.customerId || event.customerId,
    fulfillmentType: event.order?.fulfillmentType || event.fulfillmentType,
    customerName:
      event.order?.customerName ||
      event.customerName ||
      event.order?.customer?.name ||
      event.customer?.name ||
      event.message?.customer?.name ||
      event.call?.customer?.name,
    customerPhone:
      event.order?.customerPhone ||
      event.customerPhone ||
      event.order?.customer?.phone ||
      event.order?.customer?.number ||
      event.customer?.phone ||
      event.customer?.number ||
      event.message?.customer?.number ||
      event.call?.customer?.number,
    customerAddress:
      event.order?.customerAddress ||
      event.customerAddress ||
      event.order?.customer?.address ||
      event.customer?.address ||
      event.message?.customer?.address ||
      event.call?.customer?.address,
    scheduledFor: event.order?.scheduledFor || event.scheduledFor,
    specialInstructions:
      event.order?.specialInstructions ||
      event.specialInstructions ||
      event.order?.notes ||
      event.notes,
    allergies: event.order?.allergies || event.allergies,
    items: event.order?.items || event.items,
    totalAmount: event.order?.totalAmount || event.totalAmount,
    currency: event.order?.currency || event.currency || "USD",
    metadata: event.order?.metadata || event.metadata,
    rawEvent: event,
  };

  const row = orderToRow(order);
  await pool.query(
    `INSERT INTO orders (
      id, order_id, order_number, call_id, tenant_id, organization_id,
      created_at, confirmed_at, status,
      business_type, customer_id, customer_name, customer_phone, customer_address,
      scheduled_for, special_instructions, allergies,
      items, total_amount, currency, metadata, raw_event
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
    [
      row.id, row.order_id, row.order_number, row.call_id, row.tenant_id, row.organization_id,
      row.created_at, row.confirmed_at, row.status,
      row.business_type, row.customer_id,
      row.customer_name, row.customer_phone, row.customer_address,
      row.scheduled_for, row.special_instructions, row.allergies,
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
  const organizationId = order.organizationId || getTenantId();
  order.organizationId = organizationId;
  order.tenantId = order.tenantId || organizationId;
  const row = orderToRow(order);
  await pool.query(
    `UPDATE orders SET
      order_id = $2, order_number = $3, call_id = $4, confirmed_at = $5, status = $6,
      business_type = $7, customer_id = $8, customer_name = $9, customer_phone = $10,
      customer_address = $11, scheduled_for = $12, special_instructions = $13,
      allergies = $14, items = $15, total_amount = $16, currency = $17,
      metadata = $18, raw_event = $19
    WHERE id = $1 AND organization_id = $20`,
    [
      row.id, row.order_id, row.order_number, row.call_id, row.confirmed_at, row.status,
      row.business_type, row.customer_id,
      row.customer_name, row.customer_phone,
      row.customer_address, row.scheduled_for, row.special_instructions,
      row.allergies,
      row.items ? JSON.stringify(row.items) : null,
      row.total_amount, row.currency,
      row.metadata ? JSON.stringify(row.metadata) : null,
      row.raw_event ? JSON.stringify(row.raw_event) : null,
      row.organization_id,
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

export async function listOrdersByOrganization(
  organizationId: string,
  options?: { limit?: number; status?: Order["status"]; since?: string }
): Promise<Order[]> {
  await ensureDbInitialized();
  const pool = getPool();
  const values: Array<string | number> = [organizationId];
  const where: string[] = ["organization_id = $1"];

  if (options?.status) {
    values.push(options.status);
    where.push(`status = $${values.length}`);
  }

  if (options?.since) {
    values.push(options.since);
    where.push(`created_at >= $${values.length}`);
  }

  let sql = `SELECT * FROM orders WHERE ${where.join(" AND ")} ORDER BY created_at DESC`;

  if (options?.limit) {
    values.push(options.limit);
    sql += ` LIMIT $${values.length}`;
  }

  try {
    const result = await pool.query(sql, values);
    return result.rows.map(rowToOrder);
  } catch (error) {
    console.error("[VAPI Storage DB] Error listing orders by org:", error);
    return [];
  }
}

/**
 * Update order status by orderId and organizationId
 * Returns the updated order or null if not found
 */
export async function updateOrderStatusByOrganization(
  orderId: string,
  organizationId: string,
  newStatus: OrderStatus
): Promise<Order | null> {
  await ensureDbInitialized();
  const pool = getPool();

  try {
    const result = await pool.query(
      `UPDATE orders SET status = $1 WHERE order_id = $2 AND organization_id = $3 RETURNING *`,
      [newStatus, orderId, organizationId]
    );
    if (result.rows.length === 0) {
      return null;
    }
    console.log(`[VAPI Storage DB] Updated order ${orderId} status to ${newStatus}`);
    return rowToOrder(result.rows[0]);
  } catch (error) {
    console.error("[VAPI Storage DB] Error updating order status:", error);
    throw error;
  }
}

/**
 * Get order statistics for an organization
 */
export async function getOrderStatsByOrganization(
  organizationId: string,
  since?: string
): Promise<{
  total: number;
  byStatus: Record<OrderStatus, number>;
  totalRevenue: number;
  averageOrderValue: number;
}> {
  await ensureDbInitialized();
  const pool = getPool();

  const values: Array<string> = [organizationId];
  let whereClause = "organization_id = $1";

  if (since) {
    values.push(since);
    whereClause += ` AND created_at >= $${values.length}`;
  }

  try {
    // Get counts by status
    const statusResult = await pool.query(
      `SELECT status, COUNT(*) as count FROM orders WHERE ${whereClause} GROUP BY status`,
      values
    );

    const byStatus: Record<OrderStatus, number> = {
      confirmed: 0,
      preparing: 0,
      ready: 0,
      out_for_delivery: 0,
      completed: 0,
      cancelled: 0,
    };

    let total = 0;
    for (const row of statusResult.rows) {
      byStatus[row.status as OrderStatus] = parseInt(row.count, 10);
      total += parseInt(row.count, 10);
    }

    // Get revenue stats (exclude cancelled orders)
    const revenueResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as count
       FROM orders WHERE ${whereClause} AND status != 'cancelled' AND total_amount IS NOT NULL`,
      values
    );

    const totalRevenue = parseFloat(revenueResult.rows[0]?.revenue || 0);
    const orderCount = parseInt(revenueResult.rows[0]?.count || 0, 10);
    const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    return {
      total,
      byStatus,
      totalRevenue,
      averageOrderValue,
    };
  } catch (error) {
    console.error("[VAPI Storage DB] Error getting order stats:", error);
    return {
      total: 0,
      byStatus: {
        confirmed: 0,
        preparing: 0,
        ready: 0,
        out_for_delivery: 0,
        completed: 0,
        cancelled: 0,
      },
      totalRevenue: 0,
      averageOrderValue: 0,
    };
  }
}

