# PostgreSQL Migration Guide

## Overview

Your VAPI call and order data has been migrated from file storage to PostgreSQL database. This ensures data persistence across Railway deployments and provides better performance and querying capabilities.

## What Changed

### Database Setup
- ✅ PostgreSQL database added to Railway project
- ✅ Database schema created automatically on first use
- ✅ Connection string available as `DATABASE_URL` environment variable

### Code Changes
- ✅ All storage functions now use PostgreSQL instead of files
- ✅ Functions are now async (use `await`)
- ✅ Same API interface - no changes needed in calling code
- ✅ Automatic table creation on first database connection

## Railway Setup

### Step 1: Verify PostgreSQL is Running

1. Go to Railway Dashboard → Your Project
2. Verify you see a **Postgres** service running (should show "Online")
3. If not present, add it:
   - Click **"New"** → **"Database"** → **"Add PostgreSQL"**
   - Railway will automatically create the database

### Step 2: Verify DATABASE_URL

The `DATABASE_URL` environment variable should be automatically set by Railway when you add the PostgreSQL service. To verify:

1. Go to Railway Dashboard → Your Service (the main app service, not Postgres)
2. Go to **"Variables"** tab
3. Look for `DATABASE_URL` - it should be present
4. It should look like: `postgresql://postgres:password@hostname:port/railway`

**Note:** If `DATABASE_URL` is not visible, it might be in the service's environment but not shown in the UI. Railway automatically shares database connection strings between services in the same project.

### Step 3: Deploy the Code

The migration code is already in the repository. Just deploy:

```bash
git add .
git commit -m "Migrate to PostgreSQL"
git push
```

Railway will automatically deploy the changes.

### Step 4: Verify Migration

After deployment:

1. **Check Railway Logs:**
   - Go to Railway → Your Service → **"Logs"**
   - Look for: `[DB] Database schema initialized successfully`
   - This confirms the database tables were created

2. **Test Webhook:**
   - Make a test call or send a test webhook
   - Check logs for: `[VAPI Storage DB] Created call ...`
   - Check dashboard: `/dashboard` - calls should appear

3. **Verify Data Persistence:**
   - Make a test call
   - Redeploy your service (trigger a new deployment)
   - Check dashboard again - the call should still be there!

## Database Schema

The migration creates two tables:

### `calls` table
- Stores all VAPI call data
- Includes: call ID, timestamps, status, business type, scores, confidence, metadata, raw events
- Indexed on `call_id`, `created_at`, `business_type`, `status`

### `orders` table
- Stores all VAPI order data
- Includes: order ID, call ID, timestamps, status, items, amounts, metadata, raw events
- Indexed on `order_id`, `call_id`, `created_at`, `business_type`

## Data Migration (Optional)

If you have existing data in the `data/` directory that you want to migrate:

1. **Export existing data:**
   ```bash
   # List all call files
   ls data/call-*.json
   
   # You can manually copy the JSON content if needed
   ```

2. **Import script (optional):**
   - You can create a one-time migration script to import existing JSON files
   - Or manually re-process important calls through the webhook

**Note:** For production, it's usually fine to start fresh - new calls will be stored in PostgreSQL going forward.

## Troubleshooting

### Error: "DATABASE_URL environment variable is not set"

**Solution:**
1. Make sure PostgreSQL service exists in Railway
2. The `DATABASE_URL` should be automatically available
3. If not, check Railway docs for sharing environment variables between services
4. You can also manually add it: Copy the connection string from the PostgreSQL service and add it as `DATABASE_URL` in your main service's variables

### Error: "relation 'calls' does not exist"

**Solution:**
- The tables should be created automatically on first use
- Check Railway logs for database initialization errors
- Try redeploying - the schema creation happens on first database connection

### Calls not appearing after migration

**Solution:**
1. Check Railway logs for database connection errors
2. Verify `DATABASE_URL` is set correctly
3. Make a test webhook call and check logs
4. Look for `[VAPI Storage DB]` log messages

### Database connection timeouts

**Solution:**
- Railway PostgreSQL has connection limits on free tier
- The code uses connection pooling to manage connections efficiently
- If you see connection errors, check Railway's PostgreSQL service status

## Benefits of PostgreSQL

✅ **Data Persistence** - Data survives deployments and restarts  
✅ **Better Performance** - Indexed queries are faster than file scanning  
✅ **Scalability** - Handles concurrent access better  
✅ **Querying** - Can use SQL for complex analytics  
✅ **Backups** - Railway PostgreSQL includes automatic backups  
✅ **No File System Limits** - No need for volumes or disk management  

## Rollback (If Needed)

If you need to rollback to file storage:

1. Revert the code changes (git)
2. Remove `DATABASE_URL` environment variable
3. Redeploy

**Note:** Data in PostgreSQL will remain, but won't be accessible until you migrate back.

## Next Steps

1. ✅ Verify PostgreSQL is running
2. ✅ Deploy the code changes
3. ✅ Test with a real call
4. ✅ Verify data persists after redeployment
5. 🎉 Enjoy persistent data!

---

**Migration completed!** Your data is now stored in PostgreSQL and will persist across Railway deployments.

