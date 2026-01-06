# Debugging Dashboard - No Calls Showing

## Quick Checks

### 1. Verify Webhook is Being Called

Check Railway logs for webhook activity:
1. Railway → Your Service → "Deployments" → Latest → "View Logs"
2. Look for: `[VAPI Webhook] Received event: call.started`
3. Look for: `[VAPI Storage] Created call file: ...`

If you don't see these logs, the webhook isn't being called.

### 2. Test Webhook Endpoint Directly

```bash
curl -X POST https://saadi-production.up.railway.app/api/webhooks/vapi \
  -H "Content-Type: application/json" \
  -d '{
    "type": "call.started",
    "call": {
      "id": "debug-test-'$(date +%s)'",
      "phoneNumber": "+46700000000"
    },
    "startedAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

Expected response: `{"success":true,"message":"Call stored","callId":"..."}`

### 3. Check Admin API Directly

```bash
# Replace ADMIN_TOKEN with your actual token
curl -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  https://saadi-production.up.railway.app/api/admin/calls
```

Expected: JSON with `{"calls":[...]}`

### 4. Check Railway Logs for Errors

Look for:
- `[Admin] Error reading data directory`
- `[VAPI Storage] Failed to write call file`
- `[Admin] Found X call files`

## Common Issues

### Issue 1: Webhook Not Configured in VAPI

**Symptoms:** No `[VAPI Webhook]` logs in Railway

**Fix:**
1. Go to VAPI Dashboard → Webhooks
2. Verify URL: `https://saadi-production.up.railway.app/api/webhooks/vapi`
3. Ensure events are selected: `call.started`, `call.ended`, `order.confirmed`
4. Save configuration

### Issue 2: Data Directory Not Writable

**Symptoms:** `[VAPI Storage] Failed to write call file` in logs

**Fix:**
- Railway ephemeral storage issue
- Data gets wiped on redeployments
- Solution: Migrate to PostgreSQL (see DATA_PERSISTENCE_ISSUE.md)

### Issue 3: Admin API Authentication Failing

**Symptoms:** Dashboard shows "No calls found" but webhook logs show calls being created

**Fix:**
1. Verify `ADMIN_TOKEN` is set in Railway environment variables
2. Verify `NEXT_PUBLIC_BASE_URL` is set correctly
3. Check Railway logs for: `[Admin] ADMIN_TOKEN environment variable not set`

### Issue 4: Data Being Wiped

**Symptoms:** Calls appear briefly, then disappear

**Fix:**
- Railway is using ephemeral storage
- Data is lost on redeployments/restarts
- Solution: Use PostgreSQL database (see DATA_PERSISTENCE_ISSUE.md)

## Step-by-Step Debugging

1. **Check if webhook is receiving calls:**
   - Railway logs → Look for `[VAPI Webhook] Received event`
   - If missing: Check VAPI webhook configuration

2. **Check if files are being created:**
   - Railway logs → Look for `[VAPI Storage] Created call file`
   - If missing: Check file write permissions

3. **Check if admin API can read files:**
   - Railway logs → Look for `[Admin] Found X call files`
   - Test admin API directly with curl

4. **Check dashboard API call:**
   - Browser DevTools → Network tab
   - Look for `/api/admin/calls` request
   - Check response status and body

## Test Commands

### Test Webhook
```bash
curl -X POST https://saadi-production.up.railway.app/api/webhooks/vapi \
  -H "Content-Type: application/json" \
  -d '{"type":"call.started","call":{"id":"test-123","phoneNumber":"+46700000000"},"startedAt":"2024-01-01T12:00:00Z"}'
```

### Test Admin API
```bash
curl -H "x-admin-token: YOUR_TOKEN" \
  https://saadi-production.up.railway.app/api/admin/calls
```

### Test Health Check
```bash
curl https://saadi-production.up.railway.app/api/webhooks/vapi
```

