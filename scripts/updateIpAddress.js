const os = require('os');
const fs = require('fs');
const path = require('path');

/**
 * Get the current machine's IPv4 address
 * Prefers non-internal addresses (not 127.0.0.1 or 169.254.x.x)
 */
function getCurrentIPv4() {
  const interfaces = os.networkInterfaces();
  
  // Priority order: en0, en1, eth0, or first non-internal IPv4
  const priorityInterfaces = ['en0', 'en1', 'eth0', 'wlan0', 'Wi-Fi'];
  
  // First, try priority interfaces
  for (const ifaceName of priorityInterfaces) {
    if (interfaces[ifaceName]) {
      for (const addr of interfaces[ifaceName]) {
        if (addr.family === 'IPv4' && !addr.internal) {
          return addr.address;
        }
      }
    }
  }
  
  // Fallback: find any non-internal IPv4 address
  for (const ifaceName of Object.keys(interfaces)) {
    for (const addr of interfaces[ifaceName]) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }
  
  // Last resort: return localhost
  return '127.0.0.1';
}

/**
 * Update environment variable in .env file
 */
function updateEnvFile(filePath, varName, newValue) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let updated = false;
  
  // Update or add the variable
  const varRegex = new RegExp(`^${varName}=.*$`, 'm');
  if (varRegex.test(content)) {
    // Update existing variable
    content = content.replace(varRegex, `${varName}=${newValue}`);
    updated = true;
  } else {
    // Add new variable at the end
    content = content.trim() + `\n${varName}=${newValue}\n`;
    updated = true;
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  return updated;
}

/**
 * Main function
 */
function main() {
  const ipAddress = getCurrentIPv4();
  console.log(`🌐 Detected IPv4 address: ${ipAddress}`);
  
  // Paths to .env files
  const rootEnvPath = path.join(__dirname, '..', '.env');
  const socialAppEnvPath = path.join(__dirname, '..', 'SocialApp', '.env');
  
  let updated = false;
  
  // Update root .env file (IP_ADD)
  if (fs.existsSync(rootEnvPath)) {
    if (updateEnvFile(rootEnvPath, 'IP_ADD', ipAddress)) {
      console.log(`✅ Updated IP_ADD in root .env`);
      updated = true;
    }
  } else {
    console.log(`⚠️  Root .env file not found at: ${rootEnvPath}`);
  }
  
  // Update SocialApp .env file (API_BASE_URL)
  if (fs.existsSync(socialAppEnvPath)) {
    // API_BASE_URL should be just the IP, not http://
    if (updateEnvFile(socialAppEnvPath, 'API_BASE_URL', ipAddress)) {
      console.log(`✅ Updated API_BASE_URL in SocialApp/.env`);
      updated = true;
    }
  } else {
    console.log(`⚠️  SocialApp .env file not found at: ${socialAppEnvPath}`);
  }
  
  if (updated) {
    console.log(`\n✨ IP address updated successfully!`);
    console.log(`   Current IP: ${ipAddress}`);
  } else {
    console.log(`\n❌ No .env files were updated.`);
  }
}

// Run the script
main();

