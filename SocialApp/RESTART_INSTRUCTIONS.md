# How to Fix Connection Issues - Step by Step

## 🔧 Complete Fix Process

### Step 1: Update IP Address
```bash
cd /Users/nikolassimpfendorfer/event
npm run update-ip
```

This will automatically update:
- `IP_ADD` in root `.env`
- `API_BASE_URL` in `SocialApp/.env`
- `EXPO_PUBLIC_API_URL` in `SocialApp/.env`

### Step 2: Verify .env File Format
```bash
cat SocialApp/.env
```

Should look like this (NO spaces around =):
```
PUBLISHABLE_KEY="your_key_here"
API_BASE_URL=10.0.0.39
EXPO_PUBLIC_API_URL=10.0.0.39
```

### Step 3: Clear All Caches
```bash
cd SocialApp
rm -rf node_modules/.cache
rm -rf .expo
rm -rf .expo-shared
```

### Step 4: Restart Expo with Cache Clear
```bash
npm start -- -c
```

The `-c` flag is CRITICAL - it clears the cache so Expo picks up the new .env values.

### Step 5: Check the Console Output

When Expo starts, you should see:
```
🌐 API Configuration:
   IP Address: 10.0.0.39
   Base URL: http://10.0.0.39:3000
   Platform: ios (or android)
   Dev Mode: true

🟡 API Service: Initializing
   Using base URL: http://10.0.0.39:3000
   IP Address: 10.0.0.39
```

If you see `undefined` or `localhost`, the .env isn't loading - repeat Step 3 and 4.

## 🚨 Common Issues

### Issue: Still seeing "localhost" or "undefined"

**Solution:**
1. Make sure you're in the `SocialApp` directory
2. Delete `.expo` folder: `rm -rf .expo`
3. Restart with: `npm start -- -c`
4. If still not working, restart your terminal and try again

### Issue: "Network Error" in app

**Check:**
1. Server is running: `npm start` in root directory
2. Both devices on same WiFi network
3. Firewall isn't blocking port 3000
4. Test from phone browser: `http://10.0.0.39:3000/api/auth/test`

### Issue: IP address keeps changing

**Solution:**
- The IP auto-updates when you start the server
- This is normal if you switch networks
- Just restart Expo after the IP changes

## ✅ Verification

### Test 1: Check .env is loaded
Look for these logs when Expo starts:
```
✅ Using API_BASE_URL from .env: 10.0.0.39
```

### Test 2: Check API calls
When you make an API call, you should see:
```
🟡 API Request: GET /api/...
```

And the URL should be: `http://10.0.0.39:3000/api/...`

### Test 3: Test from phone browser
Open on your phone (same WiFi):
```
http://10.0.0.39:3000/api/auth/test
```

If this works, the server is reachable and it's an Expo/.env issue.
If this doesn't work, it's a network/firewall issue.

## 🔄 Quick Restart Command

If you just need to restart everything:
```bash
# Terminal 1 - Root directory
npm start

# Terminal 2 - SocialApp directory  
cd SocialApp
rm -rf .expo node_modules/.cache
npm start -- -c
```


