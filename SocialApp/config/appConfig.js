// SocialApp/config/appConfig.js - App configuration

export const APP_CONFIG = {
  // App URL for sharing links
  APP_URL: process.env.EXPO_PUBLIC_APP_URL || 'https://yourapp.com',
  
  // API endpoints
  API_BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
  
  // Feature flags
  FEATURES: {
    NATIVE_SHARING: true,
    FRIEND_SEARCH: true,
    ANALYTICS_TRACKING: true,
  },
  
  // Limits
  MAX_INVITE_USERS: 50,
  SEARCH_DEBOUNCE_MS: 300,
  MIN_SEARCH_LENGTH: 2,
};

export const getShareUrl = (eventId) => {
  return `${APP_CONFIG.APP_URL}/events/${eventId}`;
};

export const getEventInviteUrl = (eventId, invitationId) => {
  return `${APP_CONFIG.APP_URL}/events/${eventId}/invite/${invitationId}`;
};