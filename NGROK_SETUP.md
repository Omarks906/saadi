# Setting up ngrok for Local Development

Replicate API requires publicly accessible URLs to process images. Since `localhost` is not accessible from Replicate's servers, you need to expose your local server publicly using ngrok.

## Quick Setup

1. **Install ngrok** (if not already installed):
   ```bash
   npm install -g ngrok
   # OR
   brew install ngrok
   ```

2. **Start your Next.js dev server**:
   ```bash
   npm run dev
   ```

3. **In a separate terminal, start ngrok**:
   ```bash
   ngrok http 3000
   ```

4. **Copy the ngrok HTTPS URL** (it will look like `https://abc123.ngrok.io`)

5. **Update your `.env.local` file**:
   ```env
   APP_BASE_URL=https://abc123.ngrok.io
   ```

6. **Restart your Next.js dev server** to pick up the new environment variable

7. **Try background removal again** - it should now work!

## Troubleshooting

### Error: ERR_NGROK_3200 - "The endpoint is offline"

This error means your ngrok agent is not running or has crashed. To fix it:

1. **Check if ngrok is running:**
   ```bash
   ps aux | grep ngrok | grep -v grep
   ```
   If nothing shows up, ngrok is not running.

2. **Start ngrok:**
   ```bash
   ngrok http 3000
   ```

3. **Verify in dashboard:**
   - Go to https://dashboard.ngrok.com/endpoints
   - Check if your endpoint is listed as active

4. **Use endpoint pooling (optional):**
   To keep the same URL even when restarting:
   ```bash
   ngrok http 3000 --pooling-enabled true
   ```

### Error: ERR_NGROK_334 - "The endpoint URL is already online"

This error means you already have an ngrok tunnel running. To fix it:

1. **Check for active tunnels:**
   - **Web Interface (easiest)**: When you run `ngrok http 3000`, it automatically opens a web interface at http://localhost:4040 - you can see all active tunnels there
   - **Dashboard**: Go to https://dashboard.ngrok.com/ and click on "Tunnels" or "Agents" to see active tunnels
   - **Command line**: Run `ngrok api tunnels list` (requires API key from dashboard)

2. **Stop the existing tunnel:**
   - **From terminal**: Find the terminal window where ngrok is running and press `Ctrl+C`
   - **From web interface**: Go to http://localhost:4040 and click "Stop" on any active tunnels
   - **From dashboard**: Go to https://dashboard.ngrok.com/, find the active tunnel, and stop it
   - **Kill all ngrok processes**: Run `pkill ngrok` in terminal

3. **Then start a new tunnel:**
   ```bash
   ngrok http 3000
   ```

3. **Or use a different port:**
   - If you need multiple tunnels, use different ports:
   ```bash
   ngrok http 3000  # for your Next.js app
   # In another terminal:
   ngrok http 3001  # for something else
   ```

## Notes

- The ngrok URL changes each time you restart ngrok (unless you have a paid account)
- Make sure both your Next.js server and ngrok are running
- The ngrok URL must use HTTPS (not HTTP) for Replicate to access it
- Only one ngrok tunnel can use a URL at a time - stop existing tunnels before starting new ones

## Alternative Solutions

- **Deploy to production**: Deploy your app to Vercel, Railway, or similar, and set `APP_BASE_URL` to your production URL
- **Use cloud storage**: Upload images to a cloud storage service (S3, Cloudinary, etc.) and use those URLs

