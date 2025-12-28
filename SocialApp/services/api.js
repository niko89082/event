// services/api.js - Fixed for better auth handling and route consistency
import axios from 'axios';
import apiConfig from '../config/apiConfig';

// Use the centralized API configuration
const baseURL = apiConfig.BASE_URL;
const ipAddress = apiConfig.IP_ADDRESS;

console.log('🟡 API Service: Initializing');
console.log('   Using base URL:', baseURL);
console.log('   IP Address:', ipAddress);

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