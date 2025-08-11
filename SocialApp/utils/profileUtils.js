// SocialApp/utils/profileUtils.js - Profile picture utility functions

/**
 * Get profile picture URL with fallbacks
 * @param {string|object} profilePicture - Profile picture data
 * @returns {string|null} Profile picture URL or null
 */
export const getProfilePictureUrl = (profilePicture) => {
  if (!profilePicture) return null;
  
  // If it's already a string URL
  if (typeof profilePicture === 'string') {
    return profilePicture;
  }
  
  // If it's an object with URL property
  if (profilePicture.url) {
    return profilePicture.url;
  }
  
  // If it's an object with uri property (React Native Image)
  if (profilePicture.uri) {
    return profilePicture.uri;
  }
  
  return null;
};

/**
 * Get user display name with fallbacks
 * @param {object} user - User object
 * @returns {string} Display name
 */
export const getUserDisplayName = (user) => {
  if (!user) return 'Unknown User';
  
  return user.displayName || user.username || 'Unknown User';
};

/**
 * Get user initials for avatar placeholder
 * @param {object} user - User object
 * @returns {string} User initials
 */
export const getUserInitials = (user) => {
  if (!user) return '?';
  
  const displayName = getUserDisplayName(user);
  
  // Split name and get first letter of each word
  const nameParts = displayName.split(' ').filter(part => part.length > 0);
  
  if (nameParts.length >= 2) {
    // First and last name initials
    return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
  } else if (nameParts.length === 1) {
    // Single name - first letter
    return nameParts[0][0].toUpperCase();
  } else {
    return '?';
  }
};

/**
 * Check if user has a valid profile picture
 * @param {object} user - User object
 * @returns {boolean} True if user has profile picture
 */
export const hasProfilePicture = (user) => {
  return !!getProfilePictureUrl(user?.profilePicture);
};