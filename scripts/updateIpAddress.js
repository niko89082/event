const os = require('os');
const fs = require('fs');
const path = require('path');

/**
 * Get the current machine's IPv4 address
 * Prefers non-internal addresses (not 127.0.0.1 or 169.254.x.x)
 */
function getCurrentIPv4() {
  try {
    const interfaces = os.networkInterfaces();
    
    if (!interfaces) {
      console.log('⚠️  No network interfaces found');
      return '127.0.0.1';
    }
    
    // Priority order: en0, en1, eth0, or first non-internal IPv4
    const priorityInterfaces = ['en0', 'en1', 'eth0', 'wlan0', 'Wi-Fi'];
    
    // First, try priority interfaces
    for (const ifaceName of priorityInterfaces) {
      if (interfaces[ifaceName]) {
        for (const addr of interfaces[ifaceName]) {
          if (addr && addr.family === 'IPv4' && !addr.internal) {
            return addr.address;
          }
        }
      }
    }
    
    // Fallback: find any non-internal IPv4 address
    for (const ifaceName of Object.keys(interfaces)) {
      if (interfaces[ifaceName]) {
        for (const addr of interfaces[ifaceName]) {
          if (addr && addr.family === 'IPv4' && !addr.internal) {
            return addr.address;
          }
        }
      }
    }
    
    // Last resort: return localhost
    console.log('⚠️  No external IPv4 address found, using localhost');
    return '127.0.0.1';
  } catch (error) {
    console.error('❌ Error detecting IP address:', error.message);
    return '127.0.0.1';
  }
}

/**
 * Update environment variable in .env file
 */
function updateEnvFile(filePath, varName, newValue) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return false;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove all existing instances of this variable
    const lines = content.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        return true;
      }
      // Check if this line contains the variable
      return !trimmed.startsWith(`${varName}=`) && !trimmed.match(new RegExp(`^${varName}\\s*=`));
    });
    
    // Check if we need to update (value changed or variable didn't exist or duplicates exist)
    const existingLines = lines.filter(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return false;
      }
      return trimmed.startsWith(`${varName}=`) || trimmed.match(new RegExp(`^${varName}\\s*=`));
    });
    
    const hasDuplicates = existingLines.length > 1;
    let valueChanged = false;
    
    if (existingLines.length > 0) {
      // Extract current value from first occurrence (before any comment)
      const firstLine = existingLines[0];
      const parts = firstLine.split('=');
      if (parts.length >= 2) {
        const valuePart = parts.slice(1).join('='); // Handle values with = in them
        const currentValue = valuePart.split('#')[0].trim();
        valueChanged = currentValue !== newValue;
      }
    }
    
    // Update if: value changed, duplicates exist, or variable doesn't exist
    if (valueChanged || hasDuplicates || existingLines.length === 0) {
      // Add the variable with new value at the end
      const trimmed = filteredLines.join('\n').trimEnd();
      const needsNewline = trimmed.length > 0 && !trimmed.endsWith('\n');
      content = trimmed + (needsNewline ? '\n' : '') + `${varName}=${newValue}\n`;
      
      // Write the file
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    } else {
      // Value is already correct and no duplicates, no update needed
      return false;
    }
  } catch (error) {
    console.error(`❌ Error updating ${varName} in ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Main function
 */
function main() {
  try {
    const ipAddress = getCurrentIPv4();
    console.log(`🌐 Detected IPv4 address: ${ipAddress}`);
    
    // Paths to .env files
    const rootEnvPath = path.join(__dirname, '..', '.env');
    const socialAppEnvPath = path.join(__dirname, '..', 'SocialApp', '.env');
    
    let updated = false;
    let errors = [];
    
    // Update root .env file (IP_ADD)
    if (fs.existsSync(rootEnvPath)) {
      try {
        if (updateEnvFile(rootEnvPath, 'IP_ADD', ipAddress)) {
          console.log(`✅ Updated IP_ADD in root .env`);
          updated = true;
        }
      } catch (error) {
        errors.push(`IP_ADD: ${error.message}`);
      }
    } else {
      console.log(`⚠️  Root .env file not found at: ${rootEnvPath}`);
    }
    
    // Update SocialApp .env file (API_BASE_URL and EXPO_PUBLIC_API_URL)
    if (fs.existsSync(socialAppEnvPath)) {
      try {
        // API_BASE_URL should be just the IP, not http://
        if (updateEnvFile(socialAppEnvPath, 'API_BASE_URL', ipAddress)) {
          console.log(`✅ Updated API_BASE_URL in SocialApp/.env`);
          updated = true;
        }
      } catch (error) {
        errors.push(`API_BASE_URL: ${error.message}`);
      }
      
      try {
        // Also update EXPO_PUBLIC_API_URL for Expo public env vars
        if (updateEnvFile(socialAppEnvPath, 'EXPO_PUBLIC_API_URL', ipAddress)) {
          console.log(`✅ Updated EXPO_PUBLIC_API_URL in SocialApp/.env`);
          updated = true;
        }
      } catch (error) {
        errors.push(`EXPO_PUBLIC_API_URL: ${error.message}`);
      }
    } else {
      console.log(`⚠️  SocialApp .env file not found at: ${socialAppEnvPath}`);
    }
    
    if (errors.length > 0) {
      console.log(`\n⚠️  Some errors occurred:`);
      errors.forEach(err => console.log(`   - ${err}`));
    }
    
    if (updated) {
      console.log(`\n✨ IP address updated successfully!`);
      console.log(`   Current IP: ${ipAddress}`);
    } else if (errors.length === 0) {
      console.log(`\n✅ IP address is already up to date (${ipAddress})`);
    }
  } catch (error) {
    console.error('❌ Fatal error in IP update script:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
