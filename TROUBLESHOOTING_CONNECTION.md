# Troubleshooting Connection Issues

## Quick Checks

### 1. Verify IP Address is Correct
```bash
# Run the IP update script
npm run update-ip

# Or manually:
node scripts/updateIpAddress.js
```

### 2. Check Server is Running
```bash
# In the root directory
npm start

# Should see:
# 🔌 Server: http://localhost:3000
# ✅ IP address updated successfully!
```

### 3. Test Server from Terminal
```bash
# Test if server is reachable
curl http://10.0.0.248:3000/api/auth/test

# Should get a response (even if it's an error, means server is reachable)
```

### 4. Check .env Files

**Root `.env`:**
```bash
cat .env | grep IP_ADD
# Should show: IP_ADD=10.0.0.248 (or your current IP)
```

**SocialApp `.env`:**
```bash
cat SocialApp/.env | grep -E "API_BASE_URL|EXPO_PUBLIC_API_URL"
# Should show:
# API_BASE_URL=10.0.0.248
# EXPO_PUBLIC_API_URL=10.0.0.248
```

## Common Issues & Fixes

### Issue 1: Expo Not Picking Up .env Changes

**Solution:**
1. Stop Expo (Ctrl+C)
2. Clear Expo cache:
   ```bash
   cd SocialApp
   npm start -- -c
   ```
3. Or restart completely:
   ```bash
   cd SocialApp
   rm -rf node_modules/.cache
   npm start
   ```

### Issue 2: Device/Emulator Not on Same Network

**Check:**
- Your laptop and phone/emulator must be on the same WiFi network
- The IP address should be your laptop's local network IP (usually 10.0.0.x or 192.168.x.x)

**Fix:**
- Make sure both devices are on the same WiFi
- Run `npm run update-ip` to get the correct IP

### Issue 3: Firewall Blocking Connections

**macOS:**
1. System Settings → Network → Firewall
2. Make sure Node.js is allowed through firewall
3. Or temporarily disable firewall to test

**Test:**
```bash
# From your phone/device, try accessing:
http://YOUR_IP:3000/api/auth/test
```

### Issue 4: Port Mismatch

**Check:**
- Server runs on port 3000 (check `.env` file: `PORT=3000`)
- API service uses: `http://${API_BASE_URL}:3000`

**Verify:**
```bash
# Check what port server is using
grep PORT .env

# Should match what's in SocialApp/services/api.js
```

### Issue 5: Environment Variables Not Loading

**For react-native-dotenv:**
- Make sure `babel.config.js` has the plugin configured
- Restart Expo after changing .env
- Check that variables don't have spaces: `API_BASE_URL=10.0.0.248` (not `API_BASE_URL = 10.0.0.248`)

## Step-by-Step Fix

1. **Update IP address:**
   ```bash
   npm run update-ip
   ```

2. **Verify .env files:**
   ```bash
   cat SocialApp/.env
   ```

3. **Restart server:**
   ```bash
   npm start
   ```

4. **Restart Expo with cache clear:**
   ```bash
   cd SocialApp
   npm start -- -c
   ```

5. **Check Expo logs:**
   - Look for: `🟡 API Service: Initializing with base URL: 10.0.0.248`
   - If you see `undefined` or `localhost`, the .env isn't loading

6. **Test connection:**
   - Try making a request in the app
   - Check Expo logs for the actual URL being used
   - Should see: `http://10.0.0.248:3000/api/...`

## Debug Mode

Add this to see what's happening:

**In SocialApp/services/api.js**, you should see:
```javascript
console.log('🟡 API Service: Initializing with base URL:', API_BASE_URL);
console.log('🟡 API Service: Full base URL:', baseURL);
```

**In Expo console, you should see:**
```
🟡 API Service: Initializing with base URL: 10.0.0.248
🟡 API Service: Full base URL: http://10.0.0.248:3000
```

If you see `undefined` or `localhost`, the .env file isn't being loaded correctly.

## Still Not Working?

1. **Check network connectivity:**
   ```bash
   # From your phone, ping your laptop
   ping 10.0.0.248
   ```

2. **Check server logs:**
   - Look for incoming requests in server console
   - If no requests appear, it's a network/firewall issue

3. **Try localhost (for emulator only):**
   - Android emulator: Use `10.0.2.2` instead of your IP
   - iOS simulator: Use `localhost` or `127.0.0.1`

4. **Check Expo network settings:**
   - Make sure Expo isn't using tunnel mode
   - Use LAN mode: `npm start -- --lan`

