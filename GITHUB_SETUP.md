# GitHub Setup Guide

## Step 1: Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `photolisting-mvp`
3. Description: "Car photolisting app with AI background removal and ad generation"
4. Choose **Private** (recommended) or **Public**
5. **DO NOT** check "Initialize with README" (you already have files)
6. Click **"Create repository"**

## Step 2: Add Remote and Push

After creating the repository, GitHub will show you commands. Run these in your terminal:

```bash
cd /Users/linkura/Desktop/Corsur/photolisting-mvp

# Add the remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/photolisting-mvp.git

# Or if you prefer SSH:
# git remote add origin git@github.com:YOUR_USERNAME/photolisting-mvp.git

# Check current branch name
git branch

# Push to GitHub (replace 'main' with your branch name if different)
git push -u origin main
```

## Step 3: Verify

1. Go to your repository on GitHub
2. You should see all your files there
3. Your code is now backed up and ready for deployment!

## Troubleshooting

### If you get "repository not found"
- Make sure the repository name matches exactly
- Check that you're logged into GitHub
- Verify the repository exists in your account

### If you get authentication errors
- Use a Personal Access Token instead of password:
  1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
  2. Generate new token with `repo` scope
  3. Use token as password when pushing

### If branch name is different
- Check with: `git branch`
- If it's `master` or `car-listing-ai`, use that name:
  ```bash
  git push -u origin master
  # or
  git push -u origin car-listing-ai
  ```

## Next Steps

Once your code is on GitHub, you can:
1. Deploy to Railway (see DEPLOYMENT.md)
2. Share the repository with your team
3. Set up continuous deployment

