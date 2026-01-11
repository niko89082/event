// services/api.js - Fixed for better auth handling and route consistency
import axios from 'axios';
import apiConfig from '../config/apiConfig';

// Use the centralized API configuration
const baseURL = apiConfig.BASE_URL;
const ipAddress = apiConfig.IP_ADDRESS;

// Logout callback to be registered by AuthContext
let logoutCallback = null;

// Function to register logout callback from AuthContext
export const setLogoutCallback = (callback) => {
  logoutCallback = callback;
  console.log('🟡 API Service: Logout callback registered');
};

// Function to clear logout callback
export const clearLogoutCallback = () => {
  logoutCallback = null;
  console.log('🟡 API Service: Logout callback cleared');
};

console.log('🟡 API Service: Initializing');
console.log('   Using base URL:', baseURL);
console.log('   IP Address:', ipAddress);

// Validate baseURL before creating axios instance
if (!baseURL || baseURL === 'http://undefined:3000' || baseURL === 'http://localhost:3000') {
  console.error('❌ Invalid baseURL:', baseURL);
  console.error('   This usually means .env file is not loading correctly');
  console.error('   Try: cd SocialApp && rm -rf .expo && npm start -- -c');
}

const api = axios.create({
  baseURL: baseURL,
  timeout: 20000, // Increased to 20 seconds for slower networks
  headers: {
    'Content-Type': 'application/json',
  },
  // Add adapter for better error handling
  validateStatus: function (status) {
    // Treat 401 (Unauthorized) as an error so it triggers the error handler
    // Other status codes < 500 are treated as success (for backward compatibility)
    return status < 500 && status !== 401;
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
    
    // Check for 401 even in "successful" responses (shouldn't happen with new validateStatus, but just in case)
    if (response.status === 401) {
      console.log('🟡 API: Unauthorized detected in response interceptor');
      console.log('🔴 API: Triggering automatic logout due to 401 error');
      
      // Trigger automatic logout if callback is registered
      if (logoutCallback) {
        try {
          logoutCallback();
          console.log('🟢 API: Logout callback executed successfully');
        } catch (logoutError) {
          console.error('❌ API: Error executing logout callback:', logoutError);
        }
      } else {
        console.warn('⚠️ API: No logout callback registered - user may remain logged in');
      }
    }
    
    return response;
  },
  (error) => {
    const errorInfo = {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data,
      code: error.code,
    };
    
    // Log the full URL that was attempted
    const attemptedUrl = error.config?.baseURL + error.config?.url;
    console.error('❌ API Error Details:');
    console.error('   Attempted URL:', attemptedUrl);
    console.error('   Error Code:', error.code);
    console.error('   Error Message:', error.message);
    console.error('   Response Status:', error.response?.status);
    
    // Handle network errors specifically
    const isNetworkError = 
      error.code === 'NETWORK_ERROR' ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('Network Error') ||
      error.message?.includes('Network request failed') ||
      error.message?.includes('Failed to connect') ||
      (!error.response && error.request);
    
    if (isNetworkError) {
      console.error('🚨 NETWORK ERROR DETECTED');
      console.error('   Base URL:', baseURL);
      console.error('   IP Address:', ipAddress);
      console.error('   Full URL:', attemptedUrl);
      console.error('');
      console.error('🔧 Troubleshooting Steps:');
      console.error('   1. Check if server is running: npm start (in root directory)');
      console.error('   2. Verify IP address is correct:', ipAddress);
      console.error('   3. Test from phone browser: http://' + ipAddress + ':3000/api/auth/test');
      console.error('   4. Ensure both devices are on the same WiFi network');
      console.error('   5. Check macOS firewall settings');
      console.error('   6. Try updating IP: npm run update-ip');
      
      // Create a more helpful error message
      error.networkDiagnostics = {
        baseURL,
        ipAddress,
        attemptedUrl,
        suggestions: [
          'Server may not be running - check terminal where you ran "npm start"',
          'IP address may have changed - run "npm run update-ip" and restart Expo',
          'Devices may be on different networks - ensure same WiFi',
          'Firewall may be blocking - check macOS System Settings > Network > Firewall',
        ]
      };
    }
    
    // Handle specific HTTP status codes
    if (error.response?.status === 401) {
      console.log('🟡 API: Unauthorized - token may be expired or invalid');
      console.log('🔴 API: Triggering automatic logout due to 401 error');
      
      // Trigger automatic logout if callback is registered
      if (logoutCallback) {
        try {
          logoutCallback();
          console.log('🟢 API: Logout callback executed successfully');
        } catch (logoutError) {
          console.error('❌ API: Error executing logout callback:', logoutError);
        }
      } else {
        console.warn('⚠️ API: No logout callback registered - user may remain logged in');
      }
    }
    
    if (error.response?.status === 403) {
      console.log('🟡 API: Forbidden - user may not have permission');
    }
    
    if (error.response?.status === 404) {
      console.log('🟡 API: Not Found - endpoint may not exist');
      console.log('🟡 API: Available endpoints should be prefixed with /api/');
    }
    
    if (error.code === 'ECONNABORTED') {
      console.error('❌ API: Request timeout - server may be slow or unreachable');
      console.error('❌ API: Timeout after 15 seconds');
    }
    
    return Promise.reject(error);
  }
);

// ✅ NEW: Repost API methods
export const repostAPI = {
  /**
   * Repost a post
   * @param {string} postId - The ID of the post to repost
   * @param {string} comment - Optional comment for quote repost
   * @returns {Promise} API response
   */
  repostPost: async (postId, comment = null) => {
    return api.post(`/api/photos/repost/${postId}`, { comment });
  },

  /**
   * Remove a repost
   * @param {string} postId - The ID of the original post
   * @returns {Promise} API response
   */
  undoRepost: async (postId) => {
    return api.delete(`/api/photos/repost/${postId}`);
  },

  /**
   * Get repost status for a post
   * @param {string} postId - The ID of the post to check
   * @returns {Promise} API response with { hasReposted: boolean, repostId: string | null }
   */
  getRepostStatus: async (postId) => {
    return api.get(`/api/photos/${postId}/repost-status`);
  },

  /**
   * Create a quote repost (repost with comment)
   * @param {string} postId - The ID of the post to repost
   * @param {string} comment - The comment text (required for quote repost)
   * @returns {Promise} API response
   */
  quoteRepost: async (postId, comment) => {
    if (!comment || !comment.trim()) {
      throw new Error('Comment is required for quote repost');
    }
    return api.post(`/api/photos/repost/${postId}`, { comment: comment.trim() });
  }
};

export default api;