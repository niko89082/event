// constants/privacyConstants.js - Updated with corrected invitation rules

const PRIVACY_LEVELS = {
  PUBLIC: 'public',
  FRIENDS: 'friends', 
  PRIVATE: 'private'
};

const PERMISSION_VALUES = {
  // View permissions
  VIEW_ANYONE: 'anyone',
  VIEW_FOLLOWERS: 'followers',
  VIEW_INVITEES: 'invitees',
  VIEW_HOST_ONLY: 'host-only',

  // Join permissions
  JOIN_ANYONE: 'anyone',
  JOIN_FOLLOWERS: 'followers', 
  JOIN_INVITED: 'invited',
  JOIN_APPROVAL_REQUIRED: 'approval-required',

  // Share permissions
  SHARE_ANYONE: 'anyone',
  SHARE_ATTENDEES: 'attendees',
  SHARE_CO_HOSTS: 'co-hosts',
  SHARE_HOST_ONLY: 'host-only',

  // Invite permissions - UPDATED
  INVITE_ANYONE: 'anyone',        // Public events: anyone can invite
  INVITE_HOST_COHOST: 'host-cohost', // Friends/Private: only host and co-hosts
  INVITE_ATTENDEES: 'attendees',   // Legacy option (not used in new system)
  INVITE_HOST_ONLY: 'host-only'    // Strictest option
};

// UPDATED: Privacy presets with corrected invitation rules
const PRIVACY_PRESETS = {
  [PRIVACY_LEVELS.PUBLIC]: {
    canView: PERMISSION_VALUES.VIEW_ANYONE,
    canJoin: PERMISSION_VALUES.JOIN_ANYONE,
    canShare: PERMISSION_VALUES.SHARE_ANYONE,
    canInvite: PERMISSION_VALUES.INVITE_ANYONE, // ✅ Anyone can invite to public events
    appearInFeed: true,
    appearInSearch: true,
    showAttendeesToPublic: true
  },
  [PRIVACY_LEVELS.FRIENDS]: {
    canView: PERMISSION_VALUES.VIEW_FOLLOWERS,
    canJoin: PERMISSION_VALUES.JOIN_FOLLOWERS,
    canShare: PERMISSION_VALUES.SHARE_ATTENDEES,
    canInvite: PERMISSION_VALUES.INVITE_HOST_COHOST, // ✅ Only host/co-hosts can invite
    appearInFeed: true,
    appearInSearch: true,
    showAttendeesToPublic: false
  },
  [PRIVACY_LEVELS.PRIVATE]: {
    canView: PERMISSION_VALUES.VIEW_INVITEES,
    canJoin: PERMISSION_VALUES.JOIN_INVITED,
    canShare: PERMISSION_VALUES.SHARE_ATTENDEES,
    canInvite: PERMISSION_VALUES.INVITE_HOST_COHOST, // ✅ Only host/co-hosts can invite
    appearInFeed: false,
    appearInSearch: false,
    showAttendeesToPublic: false
  }
};

// UPDATED: Privacy level info with corrected invitation descriptions
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
      'Anyone can invite/share', // ✅ Updated - anyone includes attendees
      'Shareable on social media'
    ],
    invitationRules: {
      whoCanInvite: 'Anyone (hosts, co-hosts, attendees, non-attendees)',
      whoCanBeInvited: 'Anyone on the platform',
      restrictions: 'None - completely open invitations and sharing'
    }
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
      'Only host/co-hosts can invite', // ✅ Updated
      'Private sharing among friends'
    ],
    invitationRules: {
      whoCanInvite: 'Host and co-hosts only',
      whoCanBeInvited: 'Any friends of the host/co-hosts',
      restrictions: 'Regular attendees cannot invite others'
    }
  },
  [PRIVACY_LEVELS.PRIVATE]: {
    label: 'Private Event',
    description: 'Invitation only, controlled access',
    icon: 'lock-closed-outline',
    color: '#FF9500',
    features: [
      'Invitation required to join',
      'Hidden from public search',
      'Only host/co-hosts can invite', // ✅ Updated
      'Host controls all access',
      'Attendees can share with invitees'
    ],
    invitationRules: {
      whoCanInvite: 'Host and co-hosts only',
      whoCanBeInvited: 'Anyone (but requires invitation)',
      restrictions: 'Strict invitation control'
    }
  }
};

/**
 * Get invitation permission level based on privacy level
 * @param {string} privacyLevel - Event privacy level
 * @returns {string} Permission level for invitations
 */
const getInvitePermissionLevel = (privacyLevel) => {
  const preset = PRIVACY_PRESETS[privacyLevel];
  return preset ? preset.canInvite : PERMISSION_VALUES.INVITE_HOST_COHOST;
};

/**
 * Check if user can invite based on privacy level and user role
 * @param {string} privacyLevel - Event privacy level
 * @param {boolean} isHost - Is user the event host
 * @param {boolean} isCoHost - Is user a co-host
 * @param {boolean} isAttendee - Is user attending the event
 * @returns {boolean} Can user invite others
 */
const canUserInviteByPrivacy = (privacyLevel, isHost, isCoHost, isAttendee) => {
  // Host and co-hosts can always invite
  if (isHost || isCoHost) return true;
  
  // Check privacy level rules
  switch (privacyLevel) {
    case PRIVACY_LEVELS.PUBLIC:
      return true; // Anyone can invite to public events (including attendees and non-attendees)
    
    case PRIVACY_LEVELS.FRIENDS:
      return false; // Only host/co-hosts can invite to friends events
    
    case PRIVACY_LEVELS.PRIVATE:
      return false; // Only host/co-hosts can invite to private events
    
    default:
      return false; // Default to restrictive
  }
};

/**
 * Get user-friendly invitation rules explanation
 * @param {string} privacyLevel - Event privacy level
 * @returns {Object} Explanation of invitation rules
 */
const getInvitationRulesExplanation = (privacyLevel) => {
  const info = PRIVACY_LEVEL_INFO[privacyLevel];
  if (!info) {
    return {
      title: 'Invitation Rules',
      description: 'Standard invitation permissions apply',
      rules: []
    };
  }

  return {
    title: `${info.label} - Invitation Rules`,
    description: info.description,
    rules: [
      `Who can invite: ${info.invitationRules.whoCanInvite}`,
      `Who can be invited: ${info.invitationRules.whoCanBeInvited}`,
      `Restrictions: ${info.invitationRules.restrictions}`
    ]
  };
};

/**
 * Validation helpers
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
  getPrivacyLevelInfo,
  getInvitePermissionLevel,
  canUserInviteByPrivacy,
  getInvitationRulesExplanation
};