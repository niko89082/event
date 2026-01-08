// config/apiConfig.js - API Configuration with multiple fallbacks
import { Platform } from 'react-native';
// Import from @env - babel will transform this
import { API_BASE_URL, EXPO_PUBLIC_API_URL } from '@env';

/**
 * Get the API base URL with multiple fallback strategies
 */
function getApiBaseUrl() {
  let ipAddress = null;
  
  // Debug: Log what we're getting
  console.log('🔍 getApiBaseUrl - Checking values:');
  console.log('   API_BASE_URL:', API_BASE_URL, '(type:', typeof API_BASE_URL, ')');
  console.log('   EXPO_PUBLIC_API_URL:', EXPO_PUBLIC_API_URL, '(type:', typeof EXPO_PUBLIC_API_URL, ')');
  console.log('   process.env.EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
  
  // Strategy 1: Try API_BASE_URL from .env
  if (API_BASE_URL && API_BASE_URL !== 'undefined' && API_BASE_URL !== undefined && String(API_BASE_URL).trim() !== '') {
    ipAddress = String(API_BASE_URL).trim();
    console.log('✅ Strategy 1: Using API_BASE_URL from .env:', ipAddress);
  }
  // Strategy 2: Try EXPO_PUBLIC_API_URL from .env
  else if (EXPO_PUBLIC_API_URL && EXPO_PUBLIC_API_URL !== 'undefined' && EXPO_PUBLIC_API_URL !== undefined && String(EXPO_PUBLIC_API_URL).trim() !== '') {
    ipAddress = String(EXPO_PUBLIC_API_URL).trim();
    console.log('✅ Strategy 2: Using EXPO_PUBLIC_API_URL from .env:', ipAddress);
  }
  // Strategy 3: Try process.env (for Expo public vars)
  else if (process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_API_URL !== 'undefined') {
    ipAddress = String(process.env.EXPO_PUBLIC_API_URL).trim();
    console.log('✅ Strategy 3: Using EXPO_PUBLIC_API_URL from process.env:', ipAddress);
  }
  // Strategy 4: Platform-specific fallbacks
  else {
    if (__DEV__) {
      // Development mode
      if (Platform.OS === 'android') {
        // Android emulator uses 10.0.2.2 to access host machine
        ipAddress = '10.0.2.2';
        console.log('⚠️  Strategy 4: Using Android emulator fallback: 10.0.2.2');
      } else if (Platform.OS === 'ios') {
        // iOS simulator can use localhost
        ipAddress = 'localhost';
        console.log('⚠️  Strategy 4: Using iOS simulator fallback: localhost');
      } else {
        // Web or other
        ipAddress = 'localhost';
        console.log('⚠️  Strategy 4: Using default fallback: localhost');
      }
    } else {
      // Production - you should set this
      ipAddress = 'localhost';
      console.warn('⚠️  Production mode: Using localhost (should be set in .env)');
    }
  }
  
  // Clean up the IP address
  if (ipAddress) {
    ipAddress = ipAddress
      .replace(/^https?:\/\//, '') // Remove http:// or https://
      .replace(/\/$/, '') // Remove trailing slash
      .split(':')[0]; // Remove port if included
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

console.log('🌐 API Configuration Final:');
console.log('   IP Address:', IP_ADDRESS);
console.log('   Base URL:', BASE_URL);
console.log('   Platform:', Platform.OS);
console.log('   Dev Mode:', __DEV__);

export default {
  IP_ADDRESS,
  BASE_URL,
  getApiBaseUrl,
};
