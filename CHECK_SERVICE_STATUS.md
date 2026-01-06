# Check Service Status and Webhook Reception

## Step 1: Verify Service is Running

1. Go to Railway → Your Service
2. Check the status indicator (should be green/active)
3. If it shows "Stopped" or "Restarting", the service isn't staying up

## Step 2: Check Recent Logs for Webhook Activity

1. Railway → Your Service → "Deployments" → Latest → "View Logs"
2. **Filter logs for:** `[VAPI Webhook]`
3. **Make a test call from your phone**
4. **Immediately check logs** - Look for:
   - `[VAPI Webhook] Received event: call.started`
   - `[VAPI Storage] Created call file: ...`

**If you see these logs:** Webhook is working, check dashboard API
**If you DON'T see these logs:** VAPI isn't sending webhooks

## Step 3: Check for Errors After Service Starts

Look for errors in Railway logs after:
- `✓ Ready in 589ms`
- Any error messages
- Any crash/restart messages

## Step 4: Test Webhook Endpoint Directly

Verify the endpoint is accessible:

```bash
curl https://saadi-production.up.railway.app/api/webhooks/vapi
```

Should return: `{"status":"ok","service":"VAPI Webhook Handler",...}`

## Step 5: Check Service Health

If the service keeps stopping:
- Check Railway → Service → Settings → Health Check
- Verify health check endpoint is configured
- Check if there are resource limits (memory/CPU)

## Common Issues

### Service Starts Then Stops
- **Cause:** Service crashing after startup
- **Check:** Look for errors in logs after "Ready"
- **Fix:** Check for runtime errors, missing env vars, or resource limits

### No Webhook Logs
- **Cause:** VAPI not sending webhooks
- **Check:** VAPI Server URL configuration
- **Fix:** Verify Server URL in VAPI org settings

### Webhook Logs But No Dashboard Data
- **Cause:** Data storage issue or dashboard API problem
- **Check:** Look for `[VAPI Storage]` logs
- **Fix:** Check file write permissions or data directory

