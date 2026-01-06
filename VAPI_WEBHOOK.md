# VAPI Webhook Integration

This document describes the VAPI (Voice AI Platform) webhook implementation for handling call and order events.

## Endpoint

**URL:** `/api/webhooks/vapi`  
**Methods:** `POST` (webhook events), `GET` (health check)

## Supported Events

### 1. `call.started`
Triggered when a call begins.

**Expected Payload:**
```json
{
  "type": "call.started",
  "call": {
    "id": "call_123",
    "businessType": "restaurant",
    "phoneNumber": "+1234567890",
    "customerId": "customer_456",
    "metadata": {}
  },
  "startedAt": "2024-01-01T12:00:00Z"
}
```

**Note:** `businessType` is optional and can be `"restaurant"` or `"car"`.

**Alternative Formats:**
- `{ "event": "call.started", "id": "call_123", ... }`
- `{ "eventType": "call.started", "callId": "call_123", ... }`

### 2. `order.confirmed`
Triggered when an order is confirmed.

**Expected Payload:**
```json
{
  "type": "order.confirmed",
  "order": {
    "id": "order_789",
    "businessType": "restaurant",
    "callId": "call_123",
    "customerId": "customer_456",
    "items": [
      {
        "name": "Product Name",
        "quantity": 1,
        "price": 99.99,
        "description": "Product description"
      }
    ],
    "totalAmount": 99.99,
    "currency": "USD",
    "metadata": {}
  },
  "confirmedAt": "2024-01-01T12:05:00Z"
}
```

**Note:** `businessType` is optional and can be `"restaurant"` or `"car"`.

**Alternative Formats:**
- `{ "event": "order.confirmed", "id": "order_789", ... }`
- `{ "eventType": "order.confirmed", "orderId": "order_789", ... }`

## Storage

### Calls
- **Location:** `data/call-{id}.json`
- **Fields:**
  - `id`: Internal ID
  - `callId`: VAPI call ID
  - `createdAt`: ISO timestamp
  - `startedAt`: ISO timestamp
  - `status`: "started" | "ended" | "failed"
  - `businessType`: Optional - "restaurant" | "car"
  - `phoneNumber`: Optional phone number
  - `customerId`: Optional customer ID
  - `metadata`: Optional metadata object
  - `rawEvent`: Full webhook payload

### Orders
- **Location:** `data/order-{id}.json`
- **Fields:**
  - `id`: Internal ID
  - `orderId`: VAPI order ID
  - `callId`: Optional associated call ID
  - `createdAt`: ISO timestamp
  - `confirmedAt`: ISO timestamp
  - `status`: "confirmed" | "cancelled" | "completed"
  - `businessType`: Optional - "restaurant" | "car"
  - `customerId`: Optional customer ID
  - `items`: Array of order items
  - `totalAmount`: Total order amount
  - `currency`: Currency code (default: "USD")
  - `metadata`: Optional metadata object
  - `rawEvent`: Full webhook payload

## Features

1. **Idempotency**: If a call or order with the same VAPI ID already exists, it will be updated instead of creating a duplicate.

2. **Flexible Event Format**: Supports multiple event payload formats:
   - `type`, `event`, or `eventType` for event identification
   - Nested objects (`call.id`, `order.id`) or flat structure (`id`, `callId`, `orderId`)

3. **Full Event Storage**: The complete webhook payload is stored in `rawEvent` for debugging and future reference.

4. **Call-Order Linking**: Orders can be linked to calls via `callId` if provided in the order event.

5. **Error Handling**: Comprehensive error handling with detailed logging.

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Call stored" | "Call updated" | "Order stored" | "Order updated",
  "callId": "internal_id" | "orderId": "internal_id"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": "Stack trace (in development)"
}
```

## Health Check

**GET** `/api/webhooks/vapi`

Returns:
```json
{
  "status": "ok",
  "service": "VAPI Webhook Handler",
  "supportedEvents": ["call.started", "order.confirmed"],
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Usage in VAPI Dashboard

VAPI uses "Server URL" instead of "Webhooks". Configure it at the **Assistant level**:

1. Go to your VAPI dashboard
2. Navigate to **"Assistants"** section (in the left sidebar)
3. Click on the assistant you want to configure
4. Go to the **"Advanced"** tab
5. Scroll down to the **"Server"** section
6. Enter your webhook URL in the **"Server URL"** field:
   ```
   https://saadi-production.up.railway.app/api/webhooks/vapi
   ```
7. Select the server messages/events you want to receive:
   - `call.started`
   - `call.ended` 
   - `order.confirmed`
8. **Save** your changes

**Note:** You can also set the Server URL at:
- Organization level (applies to all assistants)
- Phone number level
- Function call level

For more details, see: https://docs.vapi.ai/server-url/setting-server-urls

## Testing

### Test call.started event:
```bash
curl -X POST https://your-app-url.com/api/webhooks/vapi \
  -H "Content-Type: application/json" \
  -d '{
    "type": "call.started",
    "call": {
      "id": "test_call_123",
      "phoneNumber": "+1234567890",
      "customerId": "test_customer"
    },
    "startedAt": "2024-01-01T12:00:00Z"
  }'
```

### Test order.confirmed event:
```bash
curl -X POST https://your-app-url.com/api/webhooks/vapi \
  -H "Content-Type: application/json" \
  -d '{
    "type": "order.confirmed",
    "order": {
      "id": "test_order_789",
      "callId": "test_call_123",
      "customerId": "test_customer",
      "items": [{"name": "Test Product", "quantity": 1, "price": 99.99}],
      "totalAmount": 99.99,
      "currency": "USD"
    },
    "confirmedAt": "2024-01-01T12:05:00Z"
  }'
```

## Logging

All webhook events are logged with the prefix `[VAPI Webhook]`:
- Event received: `[VAPI Webhook] Received event: {eventType}`
- Call created: `[VAPI Webhook] call.started: Created new call {id}`
- Order created: `[VAPI Webhook] order.confirmed: Created new order {id}`
- Errors: `[VAPI Webhook] Error processing webhook: {error}`

Check your server logs (Railway, local console, etc.) to monitor webhook activity.

## Data Access

To access stored calls and orders programmatically, use the storage functions:

```typescript
import { 
  listCalls, 
  listOrders, 
  findCallByCallId, 
  findOrderByOrderId 
} from "@/lib/vapi-storage";

// List all calls
const calls = listCalls();

// List all orders
const orders = listOrders();

// Find specific call
const call = findCallByCallId("vapi_call_id");

// Find specific order
const order = findOrderByOrderId("vapi_order_id");
```

