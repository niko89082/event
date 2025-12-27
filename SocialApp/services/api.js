// services/api.js - Fixed for better auth handling and route consistency
import axios from 'axios';
import { API_BASE_URL, EXPO_PUBLIC_API_URL } from '@env';

// Debug: Log what we're getting from .env
console.log('🔍 API Service Debug:');
console.log('   API_BASE_URL from @env:', API_BASE_URL);
console.log('   EXPO_PUBLIC_API_URL from @env:', EXPO_PUBLIC_API_URL);
console.log('   Type of API_BASE_URL:', typeof API_BASE_URL);

// Determine the IP address to use
// Priority: API_BASE_URL from .env > EXPO_PUBLIC_API_URL > fallback
let ipAddress = API_BASE_URL || EXPO_PUBLIC_API_URL;

// Clean up the IP address (remove http://, https://, trailing slashes, etc.)
if (ipAddress) {
  ipAddress = ipAddress
    .replace(/^https?:\/\//, '') // Remove http:// or https://
    .replace(/\/$/, '') // Remove trailing slash
    .split(':')[0]; // Remove port if included (we'll add it back)
}

// Fallback if still undefined
if (!ipAddress || ipAddress === 'undefined' || ipAddress === 'localhost') {
  console.warn('⚠️  API Service: API_BASE_URL not found in .env, using fallback');
  ipAddress = 'localhost';
}

// Validate IP address format (basic check)
if (!ipAddress || ipAddress.trim() === '') {
  console.error('❌ API Service: Invalid IP address!');
  throw new Error('API_BASE_URL is invalid. Please check your .env file.');
}

console.log('🟡 API Service: Using IP address:', ipAddress);

// Construct base URL - ensure we don't double-add http://
let baseURL;
if (ipAddress.startsWith('http://') || ipAddress.startsWith('https://')) {
  // Already has protocol, just add port if needed
  baseURL = ipAddress.includes(':3000') ? ipAddress : `${ipAddress}:3000`;
} else {
  // No protocol, add http:// and port
  baseURL = `http://${ipAddress}:3000`;
}

console.log('🟡 API Service: Full base URL:', baseURL);

const api = axios.create({
  baseURL: baseURL,
  timeout: 15000, // 15 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for debugging and auth
api.interceptors.request.use(
  (config) => {
    console.log('🟡 API Request:', config.method?.toUpperCase(), config.url);
    
    // Log if we have auth header
    const hasAuth = !!config.headers.Authorization;
    console.log('🟡 API Request has auth:', hasAuth);
    
    if (config.data && config.headers['Content-Type'] === 'application/json') {
      console.log('🟡 API Request Data:', JSON.stringify(config.data).substring(0, 200));
    }
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for debugging and auth error handling
api.interceptors.response.use(
  (response) => {
    console.log('🟢 API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    const errorInfo = {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data,
    };
    
    console.error('❌ API Response Error:', errorInfo);
    
    // Handle specific error cases
    if (error.response?.status === 401) {
      console.log('🟡 API: Unauthorized - token may be expired or invalid');
      // Don't auto-logout here, let the components handle it
    }
    
    if (error.response?.status === 403) {
      console.log('🟡 API: Forbidden - user may not have permission');
    }
    
    if (error.response?.status === 404) {
      console.log('🟡 API: Not Found - endpoint may not exist');
      console.log('🟡 API: Available endpoints should be prefixed with /api/');
    }
    
    if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
      console.error('❌ API: Network error - check if server is running on', baseURL);
      console.error('❌ API: Current IP address:', ipAddress);
    }
    
    if (error.code === 'ECONNABORTED') {
      console.error('❌ API: Request timeout - server may be slow or unreachable');
      console.error('❌ API: Attempted URL:', error.config?.baseURL + error.config?.url);
      console.error('❌ API: Check if server is running and accessible from this device');
    }
    
    // Log the full URL that was attempted
    if (error.config) {
      const attemptedUrl = error.config.baseURL + error.config.url;
      console.error('❌ API: Attempted URL:', attemptedUrl);
    }
    
    return Promise.reject(error);
  }
);

export default api;