# Step-by-Step Debugging Guide for Background Removal

This guide will help you debug why Replicate is returning an empty object `{}`.

## Step 1: Verify All Services Are Running

### 1.1 Check if Next.js server is running
```bash
cd /Users/linkura/Desktop/Corsur/photolisting-mvp
lsof -ti:3000
```
**Expected:** Should show a process ID (like `67343`)
**If empty:** Start the server:
```bash
npm run dev
```

### 1.2 Check if ngrok is running
```bash
ps aux | grep ngrok | grep -v grep
```
**Expected:** Should show ngrok process
**If empty:** Start ngrok:
```bash
ngrok http 3000
```

### 1.3 Get your ngrok URL
```bash
curl -s http://localhost:4040/api/tunnels | python3 -m json.tool | grep -A 1 "public_url" | head -3
```
**Expected:** Should show your ngrok HTTPS URL (e.g., `https://nonantagonistic-areolar-albert.ngrok-free.dev`)

---

## Step 2: Verify Environment Configuration

### 2.1 Check your .env.local file
```bash
cd /Users/linkura/Desktop/Corsur/photolisting-mvp
cat .env.local | grep APP_BASE_URL
```
**Expected:** Should show `APP_BASE_URL=https://your-ngrok-url.ngrok-free.dev`
**If wrong:** Update it:
```bash
# Edit .env.local and set APP_BASE_URL to your ngrok URL
```

### 2.2 Verify the ngrok URL matches
```bash
# Get current ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['tunnels'][0]['public_url'])" 2>/dev/null)
echo "Current ngrok URL: $NGROK_URL"

# Check if it matches .env.local
grep "$NGROK_URL" .env.local
```
**Expected:** Should find a match
**If no match:** Update `.env.local` with the current ngrok URL

---

## Step 3: Test Image URL Accessibility

### 3.1 Find a test image file
```bash
cd /Users/linkura/Desktop/Corsur/photolisting-mvp
# List recent uploads
ls -lt public/uploads/*/original/*.jpg public/uploads/*/original/*.png 2>/dev/null | head -5
```
**Note the full path** of one image file

### 3.2 Test localhost access
```bash
# Replace with your actual listing ID and filename
LISTING_ID="8b56b0dc9da2b551"
FILENAME="1767006746841-Screenshot_2025-12-29_at_11.55.07.png"

curl -I http://localhost:3000/uploads/$LISTING_ID/original/$FILENAME
```
**Expected:** Should return `HTTP/1.1 200 OK`
**If 404:** The file doesn't exist or path is wrong

### 3.3 Test ngrok access
```bash
# Get your ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['tunnels'][0]['public_url'])" 2>/dev/null)

# Test the image URL through ngrok
curl -I "$NGROK_URL/uploads/$LISTING_ID/original/$FILENAME"
```
**Expected:** Should return `HTTP/2 200` or `HTTP/2 302` (redirect to warning page)
**If ERR_NGROK_3200:** ngrok is offline - restart it
**If 404:** Visit the URL in browser first to accept warning page

---

## Step 4: Test Replicate API Directly

### 4.1 Test with a simple image URL
```bash
# First, make sure you have a publicly accessible image URL
# Use your ngrok URL from step 3.3
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['tunnels'][0]['public_url'])" 2>/dev/null)
IMAGE_URL="$NGROK_URL/uploads/$LISTING_ID/original/$FILENAME"

# Test Replicate API (replace with your token)
REPLICATE_TOKEN=$(grep REPLICATE_API_TOKEN .env.local | cut -d '=' -f2)
curl -X POST https://api.replicate.com/v1/models/cjwbw/rembg/predictions \
  -H "Authorization: Token $REPLICATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"input\": {\"image\": \"$IMAGE_URL\"}}" | python3 -m json.tool
```
**Expected:** Should return a prediction object with `id` and `status`
**If error:** Check the error message

---

## Step 5: Monitor Server Logs During Background Removal

### 5.1 Open a terminal to watch logs
```bash
# In a new terminal, watch the Next.js server output
# The logs will appear automatically when you try background removal
```

### 5.2 Try background removal in the browser
1. Go to your listing page
2. Click "Remove BG" on a photo
3. **Immediately check the server terminal** for these logs:
   - `Calling Replicate with model: ...`
   - `Image input type: ...`
   - `Replicate call completed. Output type: ...`
   - `Replicate output type: ... value: ...`
   - `Replicate output keys: ...`
   - `Failed to extract URL from Replicate output: ...`

### 5.3 Copy the full log output
Copy all the log messages that appear and note:
- What is the `Image input type`?
- What is the `Replicate output type`?
- What is the `Replicate output value`?
- What are the `Replicate output keys`?

---

## Step 6: Common Issues and Fixes

### Issue 1: ERR_NGROK_3200 (ngrok offline)
**Fix:**
```bash
pkill -f ngrok
ngrok http 3000
```

### Issue 2: Image URL returns 404 through ngrok
**Fix:**
1. Visit the image URL in your browser: `https://your-ngrok-url.ngrok-free.dev/uploads/...`
2. Accept the ngrok warning page
3. Try again

### Issue 3: Replicate returns empty object `{}`
**Possible causes:**
- Image URL not accessible to Replicate
- Replicate API error (check server logs)
- Model processing failed silently

**Debug:**
```bash
# Check Replicate account status
curl -H "Authorization: Token $(grep REPLICATE_API_TOKEN .env.local | cut -d '=' -f2)" \
  https://api.replicate.com/v1/account
```

### Issue 4: Port 3000 in use
**Fix:**
```bash
# Find what's using port 3000
lsof -ti:3000

# Kill it
kill $(lsof -ti:3000)

# Restart server
npm run dev
```

---

## Step 7: Verify Complete Setup

Run this complete check:
```bash
cd /Users/linkura/Desktop/Corsur/photolisting-mvp

echo "=== Checking Services ==="
echo "Next.js on port 3000:"
lsof -ti:3000 && echo "✓ Running" || echo "✗ Not running"

echo "ngrok:"
ps aux | grep ngrok | grep -v grep && echo "✓ Running" || echo "✗ Not running"

echo ""
echo "=== Checking Configuration ==="
echo "APP_BASE_URL in .env.local:"
grep APP_BASE_URL .env.local

echo ""
echo "Current ngrok URL:"
curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['tunnels'][0]['public_url'])" 2>/dev/null || echo "Cannot get ngrok URL"

echo ""
echo "=== Test Image Access ==="
# Replace with your actual values
LISTING_ID="8b56b0dc9da2b551"
FILENAME="1767006746841-Screenshot_2025-12-29_at_11.55.07.png"
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['tunnels'][0]['public_url'])" 2>/dev/null)

if [ -n "$NGROK_URL" ]; then
  echo "Testing: $NGROK_URL/uploads/$LISTING_ID/original/$FILENAME"
  curl -I "$NGROK_URL/uploads/$LISTING_ID/original/$FILENAME" 2>&1 | head -3
else
  echo "Cannot test - ngrok not running"
fi
```

---

## Next Steps

After running all checks:
1. **Share the output** of Step 7 with me
2. **Share the server logs** from Step 5.2
3. I'll help you identify and fix the specific issue

