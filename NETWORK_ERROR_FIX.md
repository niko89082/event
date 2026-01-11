# Fix Network Errors - Quick Guide

## 🚨 Current IP Address
Your current IP is: **10.0.0.249**

## Quick Fix Steps

### Step 1: Verify Server is Running
```bash
# In root directory
npm start
```

You should see:
```
🌐 Detected IPv4 address: 10.0.0.249
✅ Updated IP_ADD in root .env
✅ Updated API_BASE_URL in SocialApp/.env
✅ Updated EXPO_PUBLIC_API_URL in SocialApp/.env
✨ IP address updated successfully!
🚀 Social App Server Started
🔌 Server: http://localhost:3000
```

### Step 2: Clear Expo Cache and Restart
```bash
cd SocialApp
rm -rf .expo node_modules/.cache .expo-shared
npm start -- -c
```

### Step 3: Check Console Output
When Expo starts, look for:
```
🌐 API Configuration Final:
   IP Address: 10.0.0.249
   Base URL: http://10.0.0.249:3000
```

If you see `localhost` or `undefined`, the .env isn't loading - repeat Step 2.

### Step 4: Test Connection from Phone
Open your phone's browser (same WiFi) and go to:
```
http://10.0.0.249:3000/api/auth/test
```

**If this works:** Server is reachable, it's an Expo/.env issue
**If this doesn't work:** Network/firewall issue (see below)

## Common Network Errors & Fixes

### Error: "Network Error" or "ERR_NETWORK"

**Causes:**
1. Server not running
2. Wrong IP address
3. Devices on different networks
4. Firewall blocking connection

**Fix:**
```bash
# 1. Update IP
npm run update-ip

# 2. Restart server
npm start

# 3. Restart Expo with cache clear
cd SocialApp
npm start -- -c
```

### Error: "ECONNREFUSED"

**Cause:** Server not running or wrong port

**Fix:**
- Make sure `npm start` is running in root directory
- Check server is on port 3000 (check `.env` file: `PORT=3000`)

### Error: "ETIMEDOUT"

**Cause:** Slow network or server overloaded

**Fix:**
- Timeout is now 20 seconds (increased from 15)
- Check server logs for errors
- Try again - might be temporary

### Error: "localhost" or "undefined" in URL

**Cause:** .env file not loading

**Fix:**
```bash
cd SocialApp
rm -rf .expo node_modules/.cache
npm start -- -c
```

## Network Troubleshooting

### Check Both Devices on Same WiFi
- Laptop and phone must be on the same WiFi network
- Check WiFi name matches on both devices

### Test Server Reachability
From your phone's browser:
```
http://10.0.0.249:3000/api/auth/test
```

If this doesn't work:
1. Check firewall: System Settings > Network > Firewall
2. Check IP address: Run `npm run update-ip` again
3. Try different network (sometimes public WiFi blocks connections)

### macOS Firewall
1. System Settings > Network > Firewall
2. Make sure Node.js is allowed
3. Or temporarily disable firewall to test

### Verify .env Files
```bash
# Root .env
cat .env | grep IP_ADD
# Should show: IP_ADD=10.0.0.249

# SocialApp .env
cat SocialApp/.env | grep API_BASE_URL
# Should show: API_BASE_URL=10.0.0.249
```

## Debug Mode

The improved error handling will now show:
- Exact URL being attempted
- Error code and message
- Troubleshooting steps
- Network diagnostics

Check your Expo console for detailed error messages.

## Still Not Working?

1. **Check server logs** - Look for incoming requests
2. **Check Expo logs** - Look for the API configuration output
3. **Test from phone browser** - This tells you if it's network or code
4. **Try different network** - Sometimes WiFi routers block connections
5. **Check IP hasn't changed** - Run `npm run update-ip` again

## Quick Test Command

Add this to test connection from your app:
```javascript
import { testConnection } from './utils/testConnection';

// Call this anywhere
testConnection().then(result => {
  console.log('Connection test:', result);
});
```

