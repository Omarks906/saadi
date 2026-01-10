// Re-export types and functions from PostgreSQL storage
// This file now uses PostgreSQL instead of file storage
export {
  extractAssistantId,
  createCall,
  readCall,
  updateCall,
  findCallByCallId,
  createOrder,
  readOrder,
  updateOrder,
  findOrderByOrderId,
  listCalls,
  listOrders,
  type Call,
  type Order,
} from "./vapi-storage-db";
