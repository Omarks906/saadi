# Railway Persistent Storage Setup

## Why This Matters

Your call data is stored in the `data/` directory as JSON files. Without persistent storage, this data is **lost every time Railway redeploys** your service.

## How to Set Up Persistent Storage on Railway

### Step 1: Create a Volume

1. Go to your Railway project dashboard
2. Click on your service (the Next.js app)
3. Go to the **"Volumes"** tab
4. Click **"Create Volume"**

### Step 2: Configure the Volume

- **Name**: `data-storage` (or any name you prefer)
- **Size**: Start with 1GB (you can increase later)
- **Mount Path**: `/app/data`

### Step 3: Create Another Volume for Uploads (Optional but Recommended)

If you also want to persist uploaded images:

- **Name**: `uploads-storage`
- **Size**: 5GB (images take more space)
- **Mount Path**: `/app/public/uploads`

### Step 4: Redeploy

After creating the volumes:
- Railway will automatically redeploy your service
- The `data/` directory will now persist across deployments
- All future call data will be saved permanently

## Verify It's Working

1. Make a test call or send a test webhook
2. Check the dashboard - you should see the call
3. Redeploy your service (trigger a new deployment)
4. Check the dashboard again - the call should still be there

## Important Notes

- **Existing data**: If you had data before setting up volumes, it's likely gone. Only new data after volume setup will persist.
- **Backup**: Consider backing up important data regularly
- **Volume size**: You can increase volume size later if needed (but you can't decrease it)

## Alternative: Use a Database

For production, consider migrating to a database (PostgreSQL, MongoDB) instead of file storage:
- Better for concurrent access
- Easier to query and analyze
- Built-in backup options
- Scales better

But for now, persistent volumes work great for your use case!

