# Troubleshooting Real Calls Not Appearing

## Quick Checks

### 1. Check Railway Logs (Most Important!)

**This will tell us if VAPI is sending webhooks:**

1. Go to Railway → Your Service → "Deployments" → Latest → "View Logs"
2. Look for `[VAPI Webhook] Received event:` messages
3. If you see these logs → webhook is being called, check for errors
4. If you DON'T see these logs → VAPI isn't sending webhooks

**What to look for:**
- `[VAPI Webhook] Received event: call.started` - Good! Webhook received
- `[VAPI Webhook] call.started: Created new call` - Good! Call stored
- `[VAPI Storage] Created call file: ...` - Good! File written
- Any error messages - Bad! Check the error

### 2. Verify VAPI Webhook Configuration

**Check the Server URL is correct:**
1. VAPI Dashboard → Organization Settings
2. Verify Server URL: `https://saadi-production.up.railway.app/api/webhooks/vapi`
3. Make sure there's no typo (check for `/webhool` vs `/webhooks/vapi`)

**Check if it's set at assistant level too:**
- If Server URL is set at both org AND assistant level, assistant level takes priority
- Make sure assistant-level URL is also correct (or remove it to use org-level)

### 3. Check VAPI Call Logs

**In VAPI Dashboard:**
1. Go to "Call Logs" or "Observe" → "Call Logs"
2. Find your test call
3. Check if the call was successful
4. Check if webhook was sent (some VAPI dashboards show webhook delivery status)

### 4. Test Webhook Endpoint Directly

**Verify the endpoint still works:**
```bash
curl -X POST https://saadi-production.up.railway.app/api/webhooks/vapi \
  -H "Content-Type: application/json" \
  -d '{
    "type": "call.started",
    "call": {
      "id": "debug-real-call-test",
      "phoneNumber": "+46700000000"
    },
    "startedAt": "2026-01-01T12:00:00Z"
  }'
```

If this works but real calls don't → VAPI isn't sending webhooks

### 5. Check for Data Persistence Issues

**If calls appear briefly then disappear:**
- Railway is using ephemeral storage
- Data gets wiped on redeployments/restarts
- Solution: Migrate to PostgreSQL (see DATA_PERSISTENCE_ISSUE.md)

## Common Issues

### Issue 1: VAPI Not Sending Webhooks

**Symptoms:**
- No `[VAPI Webhook]` logs in Railway
- Test curl works, but real calls don't appear

**Possible Causes:**
- Server URL typo in VAPI
- Webhook disabled in VAPI settings
- VAPI webhook delivery failed (check VAPI dashboard)

**Fix:**
- Double-check Server URL in VAPI org settings
- Verify webhook is enabled
- Check VAPI call logs for webhook delivery status

### Issue 2: Webhook Received But Not Stored

**Symptoms:**
- See `[VAPI Webhook] Received event:` in logs
- But no `[VAPI Storage] Created call file:` message
- Calls don't appear in dashboard

**Possible Causes:**
- File write permission error
- Data directory doesn't exist
- Storage error

**Fix:**
- Check Railway logs for file write errors
- Verify `DATA_DIR` is writable
- Check for `[VAPI Storage] Failed to write call file` errors

### Issue 3: Data Being Wiped

**Symptoms:**
- Calls appear briefly, then disappear
- Dashboard shows "No calls found" after refresh

**Possible Causes:**
- Railway ephemeral storage
- Service restarted/redeployed

**Fix:**
- Migrate to PostgreSQL for persistent storage
- Or accept ephemeral storage for testing

### Issue 4: Wrong Event Format

**Symptoms:**
- Webhook received but call not created
- See `[VAPI Webhook] Unknown event type` in logs

**Possible Causes:**
- VAPI sending events in different format
- Event type name mismatch

**Fix:**
- Check Railway logs for the actual event format
- Update webhook handler to support VAPI's format

## Step-by-Step Debugging

1. **Make a test call from your phone**
2. **Immediately check Railway logs** - Look for `[VAPI Webhook]` messages
3. **If no logs appear:**
   - VAPI isn't sending webhooks → Check VAPI configuration
   - Check VAPI call logs for webhook delivery status
4. **If logs appear but call doesn't:**
   - Check for errors in the logs
   - Verify file write succeeded
   - Check dashboard API: `/api/admin/calls`
5. **If call appears then disappears:**
   - Ephemeral storage issue → Migrate to PostgreSQL

## What to Share for Help

If you need help debugging, share:
1. Railway logs (especially `[VAPI Webhook]` messages)
2. VAPI call logs (webhook delivery status)
3. Any error messages from Railway logs
4. Whether test curl commands work

