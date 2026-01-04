# Deployment Guide

This guide will help you deploy your car photolisting app to a public URL that you can share with your team.

## ⚠️ Important: File Storage

Your app currently uses **local file storage** (`data/` and `public/uploads/`). Most cloud platforms have **ephemeral storage** (files are deleted when the server restarts). You have two options:

### Option A: Use a Platform with Persistent Storage (Recommended for Quick Deploy)
- **Railway** ✅ (supports persistent volumes)
- **Render** ✅ (supports persistent disks)
- **Fly.io** ✅ (supports persistent volumes)

### Option B: Migrate to Cloud Storage (Better for Production)
- Use **AWS S3**, **Cloudinary**, or **Supabase Storage** for file uploads
- Use a database (PostgreSQL, MongoDB) for listing data

---

## 🚀 Quick Deploy: Railway (Recommended)

Railway is the easiest option that supports persistent file storage out of the box.

### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (recommended) or email

### Step 2: Deploy from GitHub
1. **Push your code to GitHub** (if not already):
   ```bash
   cd /Users/linkura/Desktop/Corsur/photolisting-mvp
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **In Railway Dashboard:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway will auto-detect Next.js

### Step 3: Set Environment Variables
In Railway project settings → Variables, add:
```
OPENAI_API_KEY=sk-proj-...
REPLICATE_API_TOKEN=r8_...
APP_PASSWORD=admin123
APP_BASE_URL=https://your-app-name.up.railway.app
NEXT_PUBLIC_BASE_URL=https://your-app-name.up.railway.app
ADMIN_TOKEN=your-secure-admin-token-here
NODE_ENV=production
```

### Step 4: Deploy
- Railway will automatically build and deploy
- Your app will be available at `https://your-app-name.up.railway.app`
- **Share this URL with your team!**

### Step 5: Enable Persistent Storage (Important!)
1. In Railway project → Settings → Volumes
2. Create a new volume
3. Mount it to `/app/data` and `/app/public/uploads`
4. This ensures files persist across deployments

---

## 🌐 Alternative: Render

### Step 1: Create Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub

### Step 2: Create Web Service
1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Select your repository

### Step 3: Configure
- **Name**: `photolisting-mvp`
- **Environment**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Plan**: Free tier works, but upgrade for persistent storage

### Step 4: Environment Variables
Add in Render dashboard:
```
OPENAI_API_KEY=sk-proj-...
REPLICATE_API_TOKEN=r8_...
APP_PASSWORD=admin123
APP_BASE_URL=https://photolisting-mvp.onrender.com
NODE_ENV=production
```

### Step 5: Enable Persistent Disk
1. In Render dashboard → Settings → Persistent Disk
2. Enable and set size (5GB free tier)
3. Mount to `/opt/render/project/src/data` and `/opt/render/project/src/public/uploads`

---

## 🎯 Alternative: Vercel (Requires Storage Migration)

Vercel is the easiest for Next.js, but **doesn't support persistent file storage**. You'll need to migrate to cloud storage first.

### Option: Use Vercel + Supabase Storage

1. **Deploy to Vercel:**
   ```bash
   npm i -g vercel
   vercel
   ```
   Follow the prompts and add environment variables.

2. **Set up Supabase Storage** (for file uploads):
   - Create account at [supabase.com](https://supabase.com)
   - Create a new project
   - Go to Storage → Create bucket named `uploads`
   - Get your Supabase URL and anon key

3. **Update code to use Supabase Storage** (requires code changes)

---

## 📝 Pre-Deployment Checklist

Before deploying, make sure:

- [ ] All environment variables are set in the platform
- [ ] `APP_BASE_URL` is set to your production URL (no ngrok needed!)
- [ ] `.env.local` is in `.gitignore` (should already be)
- [ ] `data/` and `public/uploads/` are in `.gitignore` (should already be)
- [ ] Test the build locally: `npm run build`

---

## 🔧 Post-Deployment

1. **Test the app:**
   - Visit your production URL
   - Try logging in with `APP_PASSWORD`
   - Upload a photo
   - Test background removal
   - Test ad generation

2. **Share with team:**
   - Send them the production URL
   - Share the password (or set up proper authentication later)

3. **Monitor:**
   - Check Railway/Render logs for errors
   - Monitor API usage (OpenAI, Replicate)

---

## 🐛 Troubleshooting

### Files Not Persisting
- **Railway/Render**: Make sure persistent volumes/disks are enabled and mounted correctly
- **Vercel**: You'll need to migrate to cloud storage (S3, Supabase, etc.)

### Environment Variables Not Working
- Double-check variable names (case-sensitive)
- Restart the service after adding variables
- Check logs for errors

### Build Fails
- Check build logs in the platform dashboard
- Ensure `npm run build` works locally first
- Check Node.js version compatibility

### Replicate API Errors
- Make sure `APP_BASE_URL` is set to your production URL (not localhost)
- Replicate needs publicly accessible URLs (production URL works, no ngrok needed!)

---

## 💡 Recommended: Railway

For your use case, **Railway** is the best choice because:
- ✅ Supports persistent file storage out of the box
- ✅ Easy GitHub integration
- ✅ Automatic deployments on git push
- ✅ Free tier available
- ✅ Simple environment variable management
- ✅ No code changes needed

**Next Steps:**
1. Push code to GitHub
2. Sign up for Railway
3. Deploy from GitHub
4. Add environment variables
5. Enable persistent storage
6. Share the URL!

---

## 📚 Additional Resources

- [Railway Docs](https://docs.railway.app)
- [Render Docs](https://render.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

