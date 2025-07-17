// scripts/checkEnv.js - Environment variable checker
require('dotenv').config();

function checkEnvironment() {
  console.log('🔍 Checking environment variables...');
  
  // Check for MongoDB URI
  const mongoVars = ['MONGO_URI', 'MONGODB_URI', 'DATABASE_URL'];
  let mongoUri = null;
  
  for (const varName of mongoVars) {
    if (process.env[varName]) {
      mongoUri = process.env[varName];
      console.log(`✅ Found MongoDB URI in ${varName}`);
      console.log(`   Value: ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`);
      break;
    }
  }
  
  if (!mongoUri) {
    console.log('❌ No MongoDB URI found!');
    console.log('   Looking for: MONGO_URI, MONGODB_URI, or DATABASE_URL');
    console.log('   Please add one to your .env file');
    console.log('   Example: MONGO_URI=mongodb://localhost:27017/your-database');
    return false;
  }
  
  // Check .env file exists
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(process.cwd(), '.env');
  
  if (fs.existsSync(envPath)) {
    console.log('✅ .env file found');
  } else {
    console.log('⚠️ .env file not found (using system environment)');
  }
  
  // List all environment variables that might be relevant
  console.log('\n📋 Relevant environment variables:');
  const relevantVars = [
    'NODE_ENV',
    'PORT',
    'MONGO_URI', 
    'MONGODB_URI',
    'DATABASE_URL',
    'JWT_SECRET'
  ];
  
  relevantVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      // Hide sensitive values
      const displayValue = varName.includes('URI') || varName.includes('SECRET') 
        ? value.substring(0, 10) + '***' 
        : value;
      console.log(`   ${varName}: ${displayValue}`);
    } else {
      console.log(`   ${varName}: (not set)`);
    }
  });
  
  return true;
}

if (require.main === module) {
  const isValid = checkEnvironment();
  process.exit(isValid ? 0 : 1);
}

module.exports = { checkEnvironment };