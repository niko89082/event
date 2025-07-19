// constants/privacyConstants.js - PHASE 1: Single source of truth for privacy settings
// Create this new file to standardize privacy across your entire app

/**
 * PHASE 1 COMPLETED: Standardized Privacy Levels (3 only)
 */
const PRIVACY_LEVELS = {
  PUBLIC: 'public',
  FRIENDS: 'friends',
  PRIVATE: 'private'
};

/**
 * PHASE 1 COMPLETED: Standardized Permission Values
 * These match your Event schema exactly
 */
const PERMISSION_VALUES = {
  CAN_VIEW: {
    ANYONE: 'anyone',
    FOLLOWERS: 'followers',
    INVITED_ONLY: 'invited-only'
  },
  CAN_JOIN: {
    ANYONE: 'anyone',
    FOLLOWERS: 'followers',
    APPROVAL_REQUIRED: 'approval-required',
    INVITED_ONLY: 'invited-only'
  },
  CAN_SHARE: {
    ANYONE: 'anyone',
    ATTENDEES: 'attendees',
    HOST_ONLY: 'host-only'
  },
  CAN_INVITE: {
    ANYONE: 'anyone',
    ATTENDEES: 'attendees',
    HOST_ONLY: 'host-only'
  }
};

/**
 * PHASE 1 COMPLETED: Standardized Privacy Presets
 * These are used across middleware, routes, and frontend components
 */
const PRIVACY_PRESETS = {
  [PRIVACY_LEVELS.PUBLIC]: {
    canView: PERMISSION_VALUES.CAN_VIEW.ANYONE,
    canJoin: PERMISSION_VALUES.CAN_JOIN.ANYONE,
    canShare: PERMISSION_VALUES.CAN_SHARE.ATTENDEES,
    canInvite: PERMISSION_VALUES.CAN_INVITE.ATTENDEES,
    appearInFeed: true,
    appearInSearch: true,
    showAttendeesToPublic: true
  },
  [PRIVACY_LEVELS.FRIENDS]: {
    canView: PERMISSION_VALUES.CAN_VIEW.FOLLOWERS,
    canJoin: PERMISSION_VALUES.CAN_JOIN.FOLLOWERS,
    canShare: PERMISSION_VALUES.CAN_SHARE.ATTENDEES,
    canInvite: PERMISSION_VALUES.CAN_INVITE.ATTENDEES,
    appearInFeed: true,
    appearInSearch: true,
    showAttendeesToPublic: false
  },
  [PRIVACY_LEVELS.PRIVATE]: {
    canView: PERMISSION_VALUES.CAN_VIEW.INVITED_ONLY,
    canJoin: PERMISSION_VALUES.CAN_JOIN.INVITED_ONLY,
    canShare: PERMISSION_VALUES.CAN_SHARE.ATTENDEES,
    canInvite: PERMISSION_VALUES.CAN_INVITE.ATTENDEES,
    appearInFeed: false,
    appearInSearch: false,
    showAttendeesToPublic: false
  }
};

/**
 * PHASE 1: Privacy Level Display Information
 */
const PRIVACY_LEVEL_INFO = {
  [PRIVACY_LEVELS.PUBLIC]: {
    label: 'Public Event',
    description: 'Anyone can discover and join this event',
    icon: 'globe-outline',
    color: '#34C759',
    features: [
      'Appears in search results',
      'Visible in public feed',
      'Anyone can join',
      'Attendees can invite others',
      'Shareable on social media'
    ]
  },
  [PRIVACY_LEVELS.FRIENDS]: {
    label: 'Friends Only',
    description: 'Only your followers can see and join',
    icon: 'people-outline',
    color: '#3797EF',
    features: [
      'Visible to followers only',
      'Followers can join directly',
      'Limited discovery',
      'Attendees can invite followers',
      'Private sharing'
    ]
  },
  [PRIVACY_LEVELS.PRIVATE]: {
    label: 'Private Event',
    description: 'Invitation only, but attendees can share',
    icon: 'lock-closed-outline',
    color: '#FF9500',
    features: [
      'Invitation required to join',
      'Hidden from public search',
      'Attendees can invite others',
      'Host controls initial invites',
      'Shareable with invites'
    ]
  }
};

/**
 * PHASE 1: Validation helpers
 */
const isValidPrivacyLevel = (level) => {
  return Object.values(PRIVACY_LEVELS).includes(level);
};

const getPrivacyPreset = (level) => {
  return PRIVACY_PRESETS[level] || PRIVACY_PRESETS[PRIVACY_LEVELS.PUBLIC];
};

const getPrivacyLevelInfo = (level) => {
  return PRIVACY_LEVEL_INFO[level] || PRIVACY_LEVEL_INFO[PRIVACY_LEVELS.PUBLIC];
};

module.exports = {
  PRIVACY_LEVELS,
  PERMISSION_VALUES,
  PRIVACY_PRESETS,
  PRIVACY_LEVEL_INFO,
  isValidPrivacyLevel,
  getPrivacyPreset,
  getPrivacyLevelInfo
};