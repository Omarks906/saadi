# Data Persistence Issue - Railway Ephemeral Storage

## Problem

Data disappears when you refresh the page because **Railway uses ephemeral storage by default**. The `data/` directory is wiped when:
- Railway redeploys your service
- Railway restarts your service
- Railway scales your service

## Why This Happens

Railway containers are stateless by default. Files written to the filesystem are lost when the container restarts or redeploys.

## Solutions

### Option 1: Use Railway PostgreSQL Database (Recommended)

**Best long-term solution** - Migrate from file storage to a database.

#### Steps:
1. In Railway → Your Project → Click **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway will create a PostgreSQL database
3. Get the connection string from the database service (it's automatically added as `DATABASE_URL`)
4. Update code to use PostgreSQL instead of file storage

**Benefits:**
- ✅ Data persists permanently
- ✅ Free tier (500MB)
- ✅ Automatic backups
- ✅ Better for production
- ✅ Easier to query and analyze

### Option 2: Find Railway Volumes (If Available)

Some Railway plans support persistent volumes:

1. Check Railway → Your Service → **"Settings"** tab
2. Look for **"Volumes"** or **"Storage"** section
3. If available:
   - Create a volume
   - Mount it to `/app/data`
   - Data will persist across deployments

**Note:** Volumes may require a paid plan.

### Option 3: Use External Storage (S3, Supabase, etc.)

Migrate to cloud storage:
- **AWS S3** - Object storage
- **Supabase Storage** - Easy to set up
- **Cloudinary** - Good for images

### Option 4: Accept Ephemeral Storage (For Testing)

For development/testing:
- Data will be lost on redeployments
- New calls will be stored until next restart
- Good for testing features, not for production

## Current Status

Your data is being stored correctly, but Railway is wiping the `data/` directory on restarts/redeployments.

## Quick Test

To verify data is being written (before it gets wiped):

1. Send a test webhook
2. Immediately check Railway logs for: `[VAPI Webhook] call.started: Created new call`
3. Check dashboard immediately (before Railway restarts)
4. Data should appear, then disappear on next restart

## Recommended Next Step

**Migrate to PostgreSQL** - It's the best solution for production and Railway makes it easy to set up.

Would you like me to help migrate the code to use PostgreSQL?

