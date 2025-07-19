// utils/errorResponses.js - Consistent error responses for QR check-in system

/**
 * Standard error response format for the QR check-in system
 */
class CheckInError extends Error {
  constructor(message, errorCode, statusCode = 400, additionalData = {}) {
    super(message);
    this.name = 'CheckInError';
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.additionalData = additionalData;
  }
}

/**
 * Predefined error responses for common check-in scenarios
 */
const ERROR_RESPONSES = {
  // QR Code Errors
  INVALID_QR_FORMAT: {
    message: 'Invalid QR code format',
    errorCode: 'INVALID_QR_FORMAT',
    statusCode: 400
  },
  
  QR_PARSE_ERROR: {
    message: 'Unable to read QR code',
    errorCode: 'QR_PARSE_ERROR', 
    statusCode: 400
  },

  // User Errors
  USER_NOT_FOUND: {
    message: 'User not found or QR code is invalid',
    errorCode: 'USER_NOT_FOUND',
    statusCode: 404
  },

  SCANNING_OWN_CODE: {
    message: 'You cannot scan your own QR code',
    errorCode: 'SCANNING_OWN_CODE',
    statusCode: 400
  },

  // Event Errors
  EVENT_NOT_FOUND: {
    message: 'Event not found',
    errorCode: 'EVENT_NOT_FOUND',
    statusCode: 404
  },

  // Registration Errors
  USER_NOT_REGISTERED: {
    message: 'User is not registered for this event',
    errorCode: 'USER_NOT_REGISTERED',
    statusCode: 400
  },

  NOT_REGISTERED: {
    message: 'You are not registered for this event',
    errorCode: 'NOT_REGISTERED',
    statusCode: 400
  },

  // Check-in Status Errors
  ALREADY_CHECKED_IN: {
    message: 'User is already checked in',
    errorCode: 'ALREADY_CHECKED_IN',
    statusCode: 400
  },

  // Form Errors
  FORM_REQUIRED: {
    message: 'Form must be completed before checking in',
    errorCode: 'FORM_REQUIRED',
    statusCode: 400
  },

  // Permission Errors
  INSUFFICIENT_PERMISSIONS: {
    message: 'Only hosts and co-hosts can check in attendees',
    errorCode: 'INSUFFICIENT_PERMISSIONS',
    statusCode: 403
  },

  SELF_CHECKIN_NOT_ALLOWED: {
    message: 'Hosts cannot check themselves in via QR scanning',
    errorCode: 'SELF_CHECKIN_NOT_ALLOWED',
    statusCode: 400
  },

  // System Errors
  SERVER_ERROR: {
    message: 'Server error during check-in',
    errorCode: 'SERVER_ERROR',
    statusCode: 500
  }
};

/**
 * Create a standardized error response
 * @param {string} errorType - Error type from ERROR_RESPONSES
 * @param {Object} additionalData - Additional data to include in response
 * @returns {Object} Formatted error response
 */
function createErrorResponse(errorType, additionalData = {}) {
  const errorTemplate = ERROR_RESPONSES[errorType];
  
  if (!errorTemplate) {
    return {
      success: false,
      message: 'Unknown error occurred',
      errorCode: 'UNKNOWN_ERROR',
      ...additionalData
    };
  }

  return {
    success: false,
    message: errorTemplate.message,
    errorCode: errorTemplate.errorCode,
    ...additionalData
  };
}

/**
 * Send a standardized error response
 * @param {Object} res - Express response object
 * @param {string} errorType - Error type from ERROR_RESPONSES
 * @param {Object} additionalData - Additional data to include in response
 */
function sendErrorResponse(res, errorType, additionalData = {}) {
  const errorTemplate = ERROR_RESPONSES[errorType];
  const statusCode = errorTemplate?.statusCode || 500;
  
  const response = createErrorResponse(errorType, additionalData);
  
  console.error(`❌ Check-in error [${errorType}]:`, response.message, additionalData);
  
  return res.status(statusCode).json(response);
}

/**
 * Success response for check-in operations
 * @param {Object} res - Express response object
 * @param {Object} data - Success data
 */
function sendSuccessResponse(res, data) {
  const response = {
    success: true,
    message: data.message || 'Check-in successful',
    ...data
  };

  console.log('✅ Check-in success:', response.message, { userId: data.user?._id });
  
  return res.json(response);
}

/**
 * Middleware to handle CheckInError instances
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function checkInErrorHandler(error, req, res, next) {
  if (error instanceof CheckInError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      errorCode: error.errorCode,
      ...error.additionalData
    });
  }
  
  // For non-CheckInError instances, pass to default error handler
  next(error);
}

/**
 * Validation helper for QR check-in requirements
 */
class CheckInValidator {
  /**
   * Validate user permissions for checking in others
   * @param {Object} user - Current user
   * @param {Object} event - Event object with host and coHosts
   * @returns {boolean} True if user can check in others
   */
  static canCheckInOthers(user, event) {
    const isHost = String(event.host._id) === String(user._id);
    const isCoHost = event.coHosts.some(coHost => 
      String(coHost._id) === String(user._id)
    );
    return isHost || isCoHost;
  }

  /**
   * Check if user is registered for event
   * @param {string} userId - User ID to check
   * @param {Object} event - Event object with attendees
   * @returns {boolean} True if user is registered
   */
  static isUserRegistered(userId, event) {
    return event.attendees.some(attendee => 
      String(attendee._id) === String(userId)
    );
  }

  /**
   * Check if user is already checked in
   * @param {string} userId - User ID to check
   * @param {Object} event - Event object with checkedIn users
   * @returns {boolean} True if user is already checked in
   */
  static isUserCheckedIn(userId, event) {
    return event.checkedIn.some(user => 
      String(user._id) === String(userId)
    );
  }

  /**
   * Validate form requirements
   * @param {Object} event - Event object
   * @param {string} userId - User ID to check
   * @returns {Promise<boolean>} True if form is completed or not required
   */
  static async validateFormRequirements(event, userId) {
    if (!event.requiresFormForCheckIn || !event.checkInForm) {
      return true; // No form required
    }

    const FormSubmission = require('../models/FormSubmission');
    const hasSubmittedForm = await FormSubmission.findOne({
      form: event.checkInForm,
      user: userId,
      event: event._id
    });

    return !!hasSubmittedForm;
  }
}

module.exports = {
  CheckInError,
  ERROR_RESPONSES,
  createErrorResponse,
  sendErrorResponse,
  sendSuccessResponse,
  checkInErrorHandler,
  CheckInValidator
};