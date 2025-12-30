# Fix APP_BASE_URL in Railway

## Problem
The `APP_BASE_URL` environment variable is set to a placeholder value instead of your actual Railway URL, causing 404 errors when trying to access uploaded images.

## Solution

1. **Go to Railway Dashboard:**
   - Visit [railway.app](https://railway.app)
   - Select your project: `adaptable-friendship` or `saadi`

2. **Navigate to Environment Variables:**
   - Click on your service (the one showing "saadi")
   - Go to the **"Variables"** tab

3. **Update APP_BASE_URL:**
   - Find the `APP_BASE_URL` variable
   - Change it from: `https://your-app-name.up.railway.app`
   - To: `https://saadi-production.up.railway.app`
   - Click **"Save"** or **"Update"**

4. **Redeploy (if needed):**
   - Railway should automatically redeploy when you change environment variables
   - If not, go to **"Deployments"** tab and click **"Redeploy"** on the latest deployment

## Verify

After updating, test again:
1. Upload a photo
2. Try to remove background
3. It should work now!

## Current Environment Variables Checklist

Make sure these are all set in Railway:

```
OPENAI_API_KEY=sk-proj-...
REPLICATE_API_TOKEN=r8_...
APP_PASSWORD=admin123
APP_BASE_URL=https://saadi-production.up.railway.app  ← Fix this one!
NODE_ENV=production
```

