// utils/testConnection.js - Test API connection
import api from '../services/api';
import apiConfig from '../config/apiConfig';

/**
 * Test the API connection
 * Call this from anywhere to verify the connection is working
 */
export const testConnection = async () => {
  console.log('🧪 Testing API Connection...');
  console.log('   Base URL:', apiConfig.BASE_URL);
  console.log('   IP Address:', apiConfig.IP_ADDRESS);
  
  try {
    // Try a simple endpoint (adjust based on your API)
    const response = await api.get('/api/auth/test', { timeout: 5000 });
    console.log('✅ Connection successful!');
    console.log('   Status:', response.status);
    return { success: true, status: response.status };
  } catch (error) {
    console.error('❌ Connection test failed');
    console.error('   Error:', error.message);
    console.error('   Code:', error.code);
    
    if (error.networkDiagnostics) {
      console.error('   Diagnostics:', error.networkDiagnostics);
    }
    
    return { 
      success: false, 
      error: error.message,
      code: error.code,
      diagnostics: error.networkDiagnostics
    };
  }
};

/**
 * Get connection status info
 */
export const getConnectionInfo = () => {
  return {
    baseURL: apiConfig.BASE_URL,
    ipAddress: apiConfig.IP_ADDRESS,
    platform: require('react-native').Platform.OS,
  };
};

