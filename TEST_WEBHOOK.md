# Testing VAPI Webhook

## Quick Test

Test if your webhook endpoint is working:

```bash
# Replace with your Railway URL
curl -X POST https://saadi-production.up.railway.app/api/webhooks/vapi \
  -H "Content-Type: application/json" \
  -d '{
    "type": "call.started",
    "call": {
      "id": "test-call-'$(date +%s)'",
      "phoneNumber": "+46700000000",
      "customerId": "test-customer-001"
    },
    "startedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Call stored",
  "callId": "..."
}
```

## Check Railway Logs

1. Go to Railway → Your Service → "Deployments" tab
2. Click on the latest deployment
3. Click "View Logs"
4. Look for `[VAPI Webhook]` messages

You should see:
- `[VAPI Webhook] Received event: call.started`
- `[VAPI Webhook] call.started: Created new call {id}`

## Verify Webhook URL in VAPI

1. Go to your VAPI dashboard
2. Navigate to Webhooks/Integrations
3. Verify the webhook URL is: `https://saadi-production.up.railway.app/api/webhooks/vapi`
4. Make sure these events are selected:
   - `call.started`
   - `call.ended`
   - `order.confirmed`

## Check Dashboard

After sending a test webhook:
1. Go to `/dashboard`
2. You should see the call in the table
3. If empty, check:
   - Railway logs for errors
   - That the webhook was actually received
   - That data directory exists (files are being written)

## Debug Steps

### 1. Test Webhook Endpoint Health
```bash
curl https://saadi-production.up.railway.app/api/webhooks/vapi
```
Should return: `{"status":"ok","service":"VAPI Webhook Handler",...}`

### 2. Test with Full Payload
```bash
curl -X POST https://saadi-production.up.railway.app/api/webhooks/vapi \
  -H "Content-Type: application/json" \
  -d '{
    "type": "call.started",
    "call": {
      "id": "debug-test-001",
      "phoneNumber": "+46700000000"
    },
    "startedAt": "2024-01-01T12:00:00Z"
  }' -v
```

### 3. Check if Data Files Are Created

If you have access to Railway shell or can check logs, verify:
- Files should be created in `/app/data/call-*.json`
- Check Railway logs for file write errors

### 4. Common Issues

**Issue: Webhook returns 404**
- Check the URL is correct: `/api/webhooks/vapi`
- Verify the route file exists: `src/app/api/webhooks/vapi/route.ts`

**Issue: Webhook returns 500**
- Check Railway logs for the error
- Verify `DATA_DIR` is writable
- Check for missing environment variables

**Issue: Webhook succeeds but no data in dashboard**
- Check if data files are being created (Railway logs)
- Verify `ADMIN_TOKEN` is set correctly
- Check dashboard API endpoint: `/api/admin/calls`

**Issue: VAPI not sending webhooks**
- Verify webhook URL in VAPI dashboard
- Check VAPI webhook logs/delivery status
- Ensure events are selected in VAPI webhook config

## Test Order Event

```bash
curl -X POST https://saadi-production.up.railway.app/api/webhooks/vapi \
  -H "Content-Type: application/json" \
  -d '{
    "type": "order.confirmed",
    "order": {
      "id": "test-order-001",
      "callId": "test-call-001",
      "customerId": "test-customer",
      "items": [{"name": "Test Item", "quantity": 1, "price": 99.99}],
      "totalAmount": 99.99,
      "currency": "USD"
    },
    "confirmedAt": "2024-01-01T12:05:00Z"
  }'
```

