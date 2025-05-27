import { API_BASE_URL, PUBLISHABLE_KEY } from '@env';

console.log('🟡 Environment Check:');
console.log('API_BASE_URL:', API_BASE_URL);
console.log('PUBLISHABLE_KEY exists:', !!PUBLISHABLE_KEY);

if (!API_BASE_URL) {
  console.error('❌ API_BASE_URL is not defined in .env file');
}

if (!PUBLISHABLE_KEY) {
  console.error('❌ PUBLISHABLE_KEY is not defined in .env file');
}

export const checkEnvironment = () => {
  const issues = [];
  
  if (!API_BASE_URL) {
    issues.push('API_BASE_URL is missing from .env');
  }
  
  if (!PUBLISHABLE_KEY) {
    issues.push('PUBLISHABLE_KEY is missing from .env');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    config: {
      API_BASE_URL,
      PUBLISHABLE_KEY: !!PUBLISHABLE_KEY
    }
  };
};