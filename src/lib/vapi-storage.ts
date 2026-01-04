import fs from "fs";
import crypto from "crypto";
import { ensureDirs, DATA_DIR } from "./paths";
import { callPath, orderPath } from "./vapi-paths";
import { BusinessType, getBusinessTypeFromAssistantId } from "./vapi-assistant-map";

/**
 * Extract assistantId from payload, checking multiple possible locations
 */
export function extractAssistantId(payload: any): string | undefined {
  return payload.assistantId || 
         payload.assistant_id || 
         payload.call?.assistantId || 
         payload.call?.assistant_id;
}

/**
 * VAPI Call data structure
 */
export type Call = {
  id: string;
  callId: string; // VAPI call ID
  createdAt: string;
  startedAt: string;
  status: "started" | "ended" | "failed";
  businessType?: BusinessType | null;
  phoneNumber?: string;
  customerId?: string;
  metadata?: Record<string, any>;
  rawEvent?: any; // Store the full webhook payload
};

/**
 * VAPI Order data structure
 */
export type Order = {
  id: string;
  orderId: string; // VAPI order ID
  callId?: string; // Associated call ID if available
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
  rawEvent?: any; // Store the full webhook payload
};

/**
 * Create a new Call record from webhook event
 */
export function createCall(event: any): Call {
  ensureDirs();
  const id = crypto.randomBytes(8).toString("hex");
  const assistantId = extractAssistantId(event);
  if (!assistantId) console.warn("[VAPI] assistantId missing");
  const bt = getBusinessTypeFromAssistantId(assistantId);
  if (assistantId && !bt) console.warn("[VAPI] assistantId not in map:", assistantId);
  
  const call: Call = {
    id,
    callId: event.call?.id || event.id || crypto.randomBytes(8).toString("hex"),
    createdAt: new Date().toISOString(),
    startedAt: event.startedAt || event.timestamp || new Date().toISOString(),
    status: "started",
    businessType: bt ?? "car",
    phoneNumber: event.call?.phoneNumber || event.phoneNumber,
    customerId: event.call?.customerId || event.customerId,
    metadata: event.call?.metadata || event.metadata,
    rawEvent: event,
  };
  fs.writeFileSync(callPath(id), JSON.stringify(call, null, 2), "utf-8");
  return call;
}

/**
 * Read a Call by ID
 */
export function readCall(id: string): Call {
  const raw = fs.readFileSync(callPath(id), "utf-8");
  return JSON.parse(raw) as Call;
}

/**
 * Update a Call record
 */
export function updateCall(call: Call) {
  fs.writeFileSync(callPath(call.id), JSON.stringify(call, null, 2), "utf-8");
}

/**
 * Find a Call by VAPI callId
 */
export function findCallByCallId(callId: string): Call | null {
  try {
    const files = fs.readdirSync(DATA_DIR);
    for (const file of files) {
      if (file.startsWith("call-") && file.endsWith(".json")) {
        const call = readCall(file.replace("call-", "").replace(".json", ""));
        if (call.callId === callId) {
          return call;
        }
      }
    }
  } catch (error) {
    console.error("Error finding call:", error);
  }
  return null;
}

/**
 * Create a new Order record from webhook event
 */
export function createOrder(event: any): Order {
  ensureDirs();
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
  fs.writeFileSync(orderPath(id), JSON.stringify(order, null, 2), "utf-8");
  return order;
}

/**
 * Read an Order by ID
 */
export function readOrder(id: string): Order {
  const raw = fs.readFileSync(orderPath(id), "utf-8");
  return JSON.parse(raw) as Order;
}

/**
 * Update an Order record
 */
export function updateOrder(order: Order) {
  fs.writeFileSync(orderPath(order.id), JSON.stringify(order, null, 2), "utf-8");
}

/**
 * Find an Order by VAPI orderId
 */
export function findOrderByOrderId(orderId: string): Order | null {
  try {
    const files = fs.readdirSync(DATA_DIR);
    for (const file of files) {
      if (file.startsWith("order-") && file.endsWith(".json")) {
        const order = readOrder(file.replace("order-", "").replace(".json", ""));
        if (order.orderId === orderId) {
          return order;
        }
      }
    }
  } catch (error) {
    console.error("Error finding order:", error);
  }
  return null;
}

/**
 * List all Calls
 */
export function listCalls(): Call[] {
  try {
    const files = fs.readdirSync(DATA_DIR);
    return files
      .filter((file) => file.startsWith("call-") && file.endsWith(".json"))
      .map((file) => {
        const id = file.replace("call-", "").replace(".json", "");
        return readCall(id);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Error listing calls:", error);
    return [];
  }
}

/**
 * List all Orders
 */
export function listOrders(): Order[] {
  try {
    const files = fs.readdirSync(DATA_DIR);
    return files
      .filter((file) => file.startsWith("order-") && file.endsWith(".json"))
      .map((file) => {
        const id = file.replace("order-", "").replace(".json", "");
        return readOrder(id);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Error listing orders:", error);
    return [];
  }
}

