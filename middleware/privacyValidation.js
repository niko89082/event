// middleware/privacyValidation.js - PHASE 2 COMPLETED: Enhanced privacy validation with self-contained constants

const { body, validationResult } = require('express-validator');

// ✅ SELF-CONTAINED: Privacy constants (no external dependencies)
const PRIVACY_LEVELS = {
  PUBLIC: 'public',
  FRIENDS: 'friends',
  PRIVATE: 'private'
};

const PRIVACY_PRESETS = {
  [PRIVACY_LEVELS.PUBLIC]: {
    canView: 'anyone',
    canJoin: 'anyone',
    canShare: 'attendees',
    canInvite: 'attendees',
    appearInFeed: true,
    appearInSearch: true,
    showAttendeesToPublic: true
  },
  [PRIVACY_LEVELS.FRIENDS]: {
    canView: 'followers',
    canJoin: 'followers',
    canShare: 'attendees',
    canInvite: 'attendees',
    appearInFeed: true,
    appearInSearch: true,
    showAttendeesToPublic: false
  },
  [PRIVACY_LEVELS.PRIVATE]: {
    canView: 'invited-only',
    canJoin: 'invited-only',
    canShare: 'attendees',
    canInvite: 'attendees',
    appearInFeed: false,
    appearInSearch: false,
    showAttendeesToPublic: false
  }
};

const isValidPrivacyLevel = (level) => {
  return Object.values(PRIVACY_LEVELS).includes(level);
};

const getPrivacyPreset = (level) => {
  return PRIVACY_PRESETS[level] || PRIVACY_PRESETS[PRIVACY_LEVELS.PUBLIC];
};

/**
 * PHASE 2 COMPLETED: Enhanced privacy level validation
 */
const validatePrivacyLevel = (req, res, next) => {
  try {
    console.log('🔍 PHASE 2: Validating privacy level...');
    console.log('📝 Raw privacy level from request:', req.body.privacyLevel);
    console.log('📝 Content-Type:', req.headers['content-type']);
    
    // Extract privacy level from various possible sources
    let privacyLevel = req.body.privacyLevel || 
                      req.body.privacy || 
                      req.body.privacySettings?.level ||
                      PRIVACY_LEVELS.PUBLIC; // Default
    
    console.log('📝 Extracted privacy level:', privacyLevel);
    console.log('📝 Type of privacy level:', typeof privacyLevel);

    // Normalize privacy level
    if (typeof privacyLevel === 'string') {
      privacyLevel = privacyLevel.toLowerCase().trim();
    } else {
      console.warn('⚠️ Privacy level is not a string, converting...');
      privacyLevel = String(privacyLevel).toLowerCase().trim();
    }

    // Validate against allowed levels
    if (!isValidPrivacyLevel(privacyLevel)) {
      console.warn(`⚠️ Invalid privacy level "${privacyLevel}", defaulting to "public"`);
      privacyLevel = PRIVACY_LEVELS.PUBLIC;
    }

    // Get privacy preset with standardized permissions
    const privacyPreset = getPrivacyPreset(privacyLevel);
    
    console.log(`✅ Privacy level validated: "${privacyLevel}"`);
    console.log('🔧 Applying privacy preset:', privacyPreset);

    // Store validated privacy level and calculated permissions
    req.validatedPrivacy = {
      privacyLevel,
      permissions: { ...privacyPreset }
    };

    // Log the final settings for debugging
    console.log('📊 Final privacy settings:', {
      privacyLevel: req.validatedPrivacy.privacyLevel,
      permissions: req.validatedPrivacy.permissions
    });

    next();
  } catch (error) {
    console.error('❌ Privacy validation error:', error);
    return res.status(400).json({ 
      message: 'Privacy validation failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Invalid privacy settings'
    });
  }
};

/**
 * PHASE 2: Apply privacy settings to event data
 */
const applyPrivacySettings = (eventData, validatedPrivacy) => {
  console.log('🔧 PHASE 2: Applying privacy settings to event...');
  
  // Set privacy level
  eventData.privacyLevel = validatedPrivacy.privacyLevel;
  
  // Set permissions based on privacy preset
  eventData.permissions = {
    ...validatedPrivacy.permissions
  };

  // Log final event privacy configuration
  console.log('📋 Final event privacy configuration:', {
    privacyLevel: eventData.privacyLevel,
    permissions: eventData.permissions
  });

  return eventData;
};

/**
 * PHASE 2: Log privacy enforcement for debugging
 */
const logPrivacyEnforcement = (eventId, privacyLevel, permissions) => {
  console.log('📊 PHASE 2: Privacy enforcement applied');
  console.log(`   Event ID: ${eventId}`);
  console.log(`   Privacy Level: ${privacyLevel}`);
  console.log(`   Permissions:`, JSON.stringify(permissions, null, 2));
  
  // Additional debugging for common issues
  if (privacyLevel === PRIVACY_LEVELS.PUBLIC && !permissions.appearInSearch) {
    console.warn('⚠️ WARNING: Public event not appearing in search - check privacy logic');
  }
  
  if (privacyLevel === PRIVACY_LEVELS.PRIVATE && permissions.appearInFeed) {
    console.warn('⚠️ WARNING: Private event appearing in feed - check privacy logic');
  }
  
  if (privacyLevel === PRIVACY_LEVELS.FRIENDS && permissions.canView === 'anyone') {
    console.warn('⚠️ WARNING: Friends event visible to anyone - check privacy logic');
  }
};

/**
 * PHASE 2: Skip validation middleware (for debugging)
 */
const skipValidation = (req, res, next) => {
  console.log('⚠️ SKIPPING VALIDATION - for debugging only');
  console.log('📝 Request body received:', JSON.stringify(req.body, null, 2));
  next();
};

module.exports = {
  validatePrivacyLevel,
  skipValidation,
  applyPrivacySettings,
  logPrivacyEnforcement,
  PRIVACY_PRESETS, // Export for backward compatibility
  PRIVACY_LEVELS   // Export privacy levels
};