// config/twilio.js - Twilio Configuration
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !twilioPhoneNumber) {
  console.warn('⚠️ Twilio credentials not configured. SMS functionality will not work.');
  console.warn('Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your .env file');
}

const twilioClient = accountSid && authToken 
  ? twilio(accountSid, authToken)
  : null;

module.exports = {
  twilioClient,
  twilioPhoneNumber,
  isConfigured: !!(accountSid && authToken && twilioPhoneNumber)
};

