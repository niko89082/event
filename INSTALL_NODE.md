# Install Node.js and npm on macOS

## Quick Installation Steps

Open your Terminal and run these commands:

### Step 1: Load nvm (if not already loaded)
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

### Step 2: Install Node.js (includes npm)
```bash
nvm install --lts
```

### Step 3: Use the installed version
```bash
nvm use node
```

### Step 4: Verify installation
```bash
node -v
npm -v
```

## Alternative: Install via Homebrew

If you prefer Homebrew:

1. Install Homebrew (if not installed):
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

2. Install Node.js:
```bash
brew install node
```

## After Installation

Once Node.js and npm are installed, you can:

1. Run the IP update script:
```bash
npm run update-ip
```

2. Start your server:
```bash
npm start
```

The IP address will auto-update when you start the server!



