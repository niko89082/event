# Quick Fix for Connection Issues

## The Problem
The app isn't connecting to the server because:
1. Expo needs to be restarted to pick up .env changes
2. Some files use different environment variable patterns
3. The IP address might have changed

## Quick Fix (3 Steps)

### Step 1: Update IP Address
```bash
cd /Users/nikolassimpfendorfer/event
npm run update-ip
```

This will update:
- `IP_ADD` in root `.env`
- `API_BASE_URL` in `SocialApp/.env`
- `EXPO_PUBLIC_API_URL` in `SocialApp/.env`

### Step 2: Restart Server
```bash
# Stop the server (Ctrl+C if running)
# Then start it again
npm start
```

You should see:
```
🌐 Detected IPv4 address: 10.0.0.248
✅ Updated IP_ADD in root .env
✅ Updated API_BASE_URL in SocialApp/.env
✅ Updated EXPO_PUBLIC_API_URL in SocialApp/.env
✨ IP address updated successfully!
```

### Step 3: Restart Expo with Cache Clear
```bash
cd SocialApp
npm start -- -c
```

The `-c` flag clears the cache so Expo picks up the new .env values.

## Verify It's Working

### Check Expo Console
Look for these lines when Expo starts:
```
🟡 API Service: Initializing with base URL: 10.0.0.248
🟡 API Service: Full base URL: http://10.0.0.248:3000
```

If you see `undefined` or `localhost`, the .env isn't loading - restart Expo again.

### Test in App
Try to:
- Login or signup
- Load the feed
- Make any API call

Check the Expo console for:
- `🟡 API Request: GET /api/...`
- `🟢 API Response: 200 ...`

If you see `❌ API: Network error`, check:
1. Server is running (`npm start` in root directory)
2. Both devices on same WiFi network
3. Firewall isn't blocking port 3000

## Still Not Working?

### Check Network
```bash
# From your phone/device browser, try:
http://10.0.0.248:3000/api/auth/test
```

If this doesn't work, it's a network/firewall issue, not a code issue.

### Check .env Files
```bash
# Root .env
cat .env | grep IP_ADD
# Should show: IP_ADD=10.0.0.248

# SocialApp .env  
cat SocialApp/.env | grep API_BASE_URL
# Should show: API_BASE_URL=10.0.0.248
```

### Force Restart Everything
```bash
# 1. Stop everything (Ctrl+C in all terminals)

# 2. Update IP
npm run update-ip

# 3. Clear all caches
cd SocialApp
rm -rf node_modules/.cache
rm -rf .expo

# 4. Restart server
cd ..
npm start

# 5. In new terminal, restart Expo
cd SocialApp
npm start -- -c
```

## Common Issues

### "Network Error" in Expo
- Server not running? → Start with `npm start`
- Wrong IP? → Run `npm run update-ip`
- Firewall? → Check macOS firewall settings
- Different network? → Make sure phone and laptop on same WiFi

### "API_BASE_URL is undefined"
- Expo cache issue → Restart with `npm start -- -c`
- .env file missing? → Check `SocialApp/.env` exists
- Wrong format? → Should be `API_BASE_URL=10.0.0.248` (no spaces, no http://)

### Server Not Starting
- Port in use? → Check if something else is using port 3000
- MongoDB not running? → Start MongoDB first
- Missing dependencies? → Run `npm install`


