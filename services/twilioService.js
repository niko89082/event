// services/twilioService.js - Twilio SMS Service
const { twilioClient, twilioPhoneNumber, isConfigured } = require('../config/twilio');

/**
 * Format phone number to E.164 format
 * @param {string} phoneNumber - Phone number to format
 * @returns {string} Formatted phone number
 */
const formatPhoneNumber = (phoneNumber) => {
  // Remove all non-numeric characters
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // If it starts with 1 and has 11 digits, it's already in the right format
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  
  // If it has 10 digits, assume US number and add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  
  // If it already starts with +, return as is
  if (phoneNumber.startsWith('+')) {
    return phoneNumber;
  }
  
  // Otherwise, add + prefix
  return `+${cleaned}`;
};

/**
 * Generate a 6-digit verification code
 * @returns {string} 6-digit code
 */
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send SMS verification code
 * @param {string} phoneNumber - Phone number to send to
 * @param {string} code - Verification code
 * @returns {Promise<Object>} Twilio response
 */
const sendVerificationCode = async (phoneNumber, code) => {
  if (!isConfigured) {
    console.error('❌ Twilio is not configured. Cannot send SMS.');
    throw new Error('SMS service is not configured');
  }

  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    console.log(`📱 Sending verification code to ${formattedPhone}`);

    const message = await twilioClient.messages.create({
      body: `Your verification code is: ${code}. This code will expire in 10 minutes.`,
      from: twilioPhoneNumber,
      to: formattedPhone
    });

    console.log(`✅ SMS sent successfully. SID: ${message.sid}`);
    return {
      success: true,
      messageSid: message.sid,
      to: formattedPhone
    };
  } catch (error) {
    console.error('❌ Error sending SMS:', error.message);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
};

/**
 * Send 2FA code via SMS
 * @param {string} phoneNumber - Phone number to send to
 * @param {string} code - 2FA code
 * @returns {Promise<Object>} Twilio response
 */
const send2FACode = async (phoneNumber, code) => {
  if (!isConfigured) {
    console.error('❌ Twilio is not configured. Cannot send SMS.');
    throw new Error('SMS service is not configured');
  }

  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    console.log(`🔐 Sending 2FA code to ${formattedPhone}`);

    const message = await twilioClient.messages.create({
      body: `Your 2FA login code is: ${code}. Do not share this code with anyone.`,
      from: twilioPhoneNumber,
      to: formattedPhone
    });

    console.log(`✅ 2FA SMS sent successfully. SID: ${message.sid}`);
    return {
      success: true,
      messageSid: message.sid,
      to: formattedPhone
    };
  } catch (error) {
    console.error('❌ Error sending 2FA SMS:', error.message);
    throw new Error(`Failed to send 2FA SMS: ${error.message}`);
  }
};

module.exports = {
  formatPhoneNumber,
  generateVerificationCode,
  sendVerificationCode,
  send2FACode
};

