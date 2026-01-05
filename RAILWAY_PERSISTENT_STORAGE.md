# Railway Persistent Storage Setup

## Why This Matters

Your call data is stored in the `data/` directory as JSON files. Without persistent storage, this data is **lost every time Railway redeploys** your service.

## Option 1: Find Volumes in Railway (If Available)

The Volumes tab location may vary. Try these locations:

1. **Service Settings:**
   - Click on your service in Railway
   - Look for a **"Settings"** tab
   - Check for **"Volumes"** or **"Storage"** section

2. **Project Settings:**
   - Go to your Railway project
   - Click **"Settings"** (project-level)
   - Look for storage/volume options

3. **Service Configuration:**
   - Click on your service
   - Look for tabs: "Deployments", "Metrics", "Settings", "Variables"
   - Volumes might be under "Settings" or a separate "Storage" tab

4. **Check Your Plan:**
   - Volumes may require a paid plan
   - Go to Railway → Account → Billing
   - Check if your plan supports volumes

## Option 2: Use Railway PostgreSQL (Recommended - Better Solution!)

Instead of file storage, use Railway's built-in PostgreSQL database:

### Benefits:
- ✅ **Free tier available** (500MB)
- ✅ **Automatic backups**
- ✅ **Better for production**
- ✅ **Easier to query and analyze**
- ✅ **No volume setup needed**

### Quick Setup:
1. In Railway project → Click **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway will create a PostgreSQL database
3. Get the connection string from the database service
4. Add it as `DATABASE_URL` environment variable
5. (Requires code changes to use database instead of files)

## Option 3: Accept Ephemeral Storage (For Now)

If volumes aren't available and you don't want to migrate to a database yet:

- **Data will be lost on redeployments** (but that's okay for testing)
- New calls will be stored until the next deployment
- You can still test and develop the analytics features
- Migrate to a database when ready for production

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

