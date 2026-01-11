// config/apiConfig.js - API Configuration with direct IP detection
import { Platform } from 'react-native';

// Direct IP address - update this if .env isn't loading
// This will be auto-updated by the update script
const HARDCODED_IP = '10.0.0.220';

// Try to import from @env
let API_BASE_URL, EXPO_PUBLIC_API_URL;
try {
  const env = require('@env');
  API_BASE_URL = env.API_BASE_URL;
  EXPO_PUBLIC_API_URL = env.EXPO_PUBLIC_API_URL;
} catch (e) {
  // If @env fails, we'll use fallbacks
  API_BASE_URL = undefined;
  EXPO_PUBLIC_API_URL = undefined;
}

/**
 * Get the API base URL with multiple fallback strategies
 */
function getApiBaseUrl() {
  let ipAddress = null;
  
  console.log('🔍 API Config - Checking values:');
  console.log('   API_BASE_URL from @env:', API_BASE_URL);
  console.log('   EXPO_PUBLIC_API_URL from @env:', EXPO_PUBLIC_API_URL);
  console.log('   HARDCODED_IP:', HARDCODED_IP);
  console.log('   process.env.EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
  
  // Strategy 1: Try API_BASE_URL from .env
  if (API_BASE_URL && API_BASE_URL !== 'undefined' && API_BASE_URL !== undefined && String(API_BASE_URL).trim() !== '') {
    ipAddress = String(API_BASE_URL).trim();
    console.log('✅ Using API_BASE_URL from .env:', ipAddress);
  }
  // Strategy 2: Try EXPO_PUBLIC_API_URL from .env
  else if (EXPO_PUBLIC_API_URL && EXPO_PUBLIC_API_URL !== 'undefined' && EXPO_PUBLIC_API_URL !== undefined && String(EXPO_PUBLIC_API_URL).trim() !== '') {
    ipAddress = String(EXPO_PUBLIC_API_URL).trim();
    console.log('✅ Using EXPO_PUBLIC_API_URL from .env:', ipAddress);
  }
  // Strategy 3: Use hardcoded IP (updated by script)
  else if (HARDCODED_IP && HARDCODED_IP !== 'localhost') {
    ipAddress = HARDCODED_IP;
    console.log('✅ Using hardcoded IP:', ipAddress);
  }
  // Strategy 4: Try process.env
  else if (process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_API_URL !== 'undefined') {
    ipAddress = String(process.env.EXPO_PUBLIC_API_URL).trim();
    console.log('✅ Using EXPO_PUBLIC_API_URL from process.env:', ipAddress);
  }
  // Strategy 5: Platform-specific fallbacks
  else {
    if (__DEV__) {
      if (Platform.OS === 'android') {
        ipAddress = '10.0.2.2';
        console.log('⚠️  Using Android emulator fallback: 10.0.2.2');
      } else if (Platform.OS === 'ios') {
        ipAddress = 'localhost';
        console.log('⚠️  Using iOS simulator fallback: localhost');
      } else {
        ipAddress = 'localhost';
        console.log('⚠️  Using default fallback: localhost');
      }
    } else {
      ipAddress = 'localhost';
      console.warn('⚠️  Production mode: Using localhost');
    }
  }
  
  // Clean up the IP address
  if (ipAddress) {
    ipAddress = ipAddress
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .split(':')[0];
  }
  
  // Final validation
  if (!ipAddress || ipAddress === 'undefined' || ipAddress.trim() === '') {
    console.error('❌ All fallbacks failed! Using localhost');
    ipAddress = 'localhost';
  }
  
  return ipAddress;
}

// Get the IP address
const IP_ADDRESS = getApiBaseUrl();

// Construct the full base URL
const BASE_URL = `http://${IP_ADDRESS}:3000`;

console.log('');
console.log('🌐 ===== API CONFIGURATION =====');
console.log('   IP Address:', IP_ADDRESS);
console.log('   Base URL:', BASE_URL);
console.log('   Platform:', Platform.OS);
console.log('   Dev Mode:', __DEV__);
console.log('================================');
console.log('');

export default {
  IP_ADDRESS,
  BASE_URL,
  getApiBaseUrl,
};
