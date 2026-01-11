# How to Start the Expo App

## ✅ Correct Commands

Expo is installed **locally** in this project, not globally. Use one of these methods:

### Method 1: Using npm scripts (Recommended)
```bash
cd SocialApp
npm start
```

This runs the `expo start` command defined in `package.json`.

### Method 2: Using npx
```bash
cd SocialApp
npx expo start
```

### Method 3: With cache clear flag
```bash
cd SocialApp
npm start -- -c
```
or
```bash
cd SocialApp
npx expo start -c
```

## ❌ What NOT to do

Don't use:
```bash
npm expo start  # ❌ This doesn't work - expo is not an npm command
```

## Available Scripts

From `package.json`, you have:
- `npm start` - Start Expo development server
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS  
- `npm run web` - Run in web browser

## Troubleshooting

If you get "expo not found" errors:
1. Make sure you're in the `SocialApp` directory
2. Make sure dependencies are installed: `npm install`
3. Use `npx expo` instead of just `expo`



