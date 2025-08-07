// utils/helpers.js - Utility functions for date formatting and other helpers

/**
 * Formats a date/time into a relative "x ago" format or absolute date
 * @param {string|Date} iso - ISO date string or Date object
 * @returns {string} - Formatted date string (e.g., "2m", "3h", "5d", or absolute date)
 */
export const niceDate = (iso) => {
  if (!iso) return '';
  
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  
  if (mins < 60) return `${mins || 1}m`;
  
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  
  // For older dates, return formatted date
  return new Date(iso).toLocaleDateString();
};

/**
 * Memory time formatter with nostalgic feel
 * @param {string|Date} iso - ISO date string or Date object
 * @returns {string} - Formatted memory time (e.g., "captured 5 days ago")
 */
export const formatMemoryTime = (iso) => {
  if (!iso) return '';
  
  const date = new Date(iso);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 1) return 'captured today';
  if (diffDays <= 7) return `captured ${diffDays} days ago`;
  if (diffDays <= 30) return `captured ${Math.ceil(diffDays / 7)} weeks ago`;
  if (diffDays <= 365) return `captured ${Math.ceil(diffDays / 30)} months ago`;
  return `captured ${Math.ceil(diffDays / 365)} years ago`;
};

/**
 * Get memory mood based on time elapsed
 * @param {string|Date} iso - ISO date string or Date object
 * @returns {Object} - Object with emoji and mood properties
 */
export const getMemoryMood = (iso) => {
  if (!iso) return { emoji: '📷', mood: 'unknown' };
  
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.ceil(Math.abs(now - date) / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 7) return { emoji: '✨', mood: 'fresh' };
  if (diffDays <= 30) return { emoji: '🌟', mood: 'recent' };
  if (diffDays <= 365) return { emoji: '💫', mood: 'nostalgic' };
  return { emoji: '🕰️', mood: 'vintage' };
};

/**
 * Get upload date display (Today, Yesterday, or formatted date)
 * @param {string|Date} iso - ISO date string or Date object
 * @returns {string} - Upload date display string
 */
export const getUploadDate = (iso) => {
  if (!iso) return '';
  
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  }
};

/**
 * Get relative time for a given date (similar to niceDate but more detailed)
 * @param {string|Date} dateString - Date string or Date object
 * @returns {string} - Relative time string
 */
export const getRelativeTime = (dateString) => {
  if (!dateString) return '';
  
  const now = new Date();
  const date = new Date(dateString);
  const diffInMs = now - date;
  const diffInHours = diffInMs / (1000 * 60 * 60);
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

  if (diffInHours < 1) {
    return 'Just now';
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)}h ago`;
  } else if (diffInDays < 7) {
    return `${Math.floor(diffInDays)}d ago`;
  } else {
    return date.toLocaleDateString();
  }
};

/**
 * Get mood color for memory posts
 * @param {string} mood - The mood string (fresh, recent, nostalgic, vintage)
 * @returns {string} - Color hex code
 */
export const getMoodColor = (mood) => {
  const colors = {
    fresh: '#34C759',     // Green
    recent: '#3797EF',    // Blue
    nostalgic: '#FF9500', // Orange
    vintage: '#AF52DE',   // Purple
    unknown: '#8E8E93'    // Gray
  };
  
  return colors[mood] || colors.unknown;
};

/**
 * Truncate text to a specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} - Truncated text with ellipsis if needed
 */
export const truncateText = (text, maxLength = 100) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength).trim() + '...';
};

/**
 * Capitalize first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} - Capitalized string
 */
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Format a number with commas (e.g., 1000 -> 1,000)
 * @param {number} num - Number to format
 * @returns {string} - Formatted number string
 */
export const formatNumber = (num) => {
  if (typeof num !== 'number') return '0';
  return num.toLocaleString();
};

/**
 * Get initials from a name
 * @param {string} name - Full name
 * @returns {string} - Initials (e.g., "John Doe" -> "JD")
 */
export const getInitials = (name) => {
  if (!name) return '??';
  
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2);
};

/**
 * Check if a string is a valid email
 * @param {string} email - Email string to validate
 * @returns {boolean} - True if valid email format
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Generate a random ID string
 * @param {number} length - Length of the ID (default: 8)
 * @returns {string} - Random ID string
 */
export const generateRandomId = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
};

/**
 * Debounce function to limit function execution frequency
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Check if a date is today
 * @param {string|Date} date - Date to check
 * @returns {boolean} - True if date is today
 */
export const isToday = (date) => {
  if (!date) return false;
  
  const today = new Date();
  const checkDate = new Date(date);
  
  return today.toDateString() === checkDate.toDateString();
};

/**
 * Check if a date is yesterday
 * @param {string|Date} date - Date to check
 * @returns {boolean} - True if date is yesterday
 */
export const isYesterday = (date) => {
  if (!date) return false;
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const checkDate = new Date(date);
  
  return yesterday.toDateString() === checkDate.toDateString();
};

/**
 * Get a placeholder image URL
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {string} text - Text to display in placeholder
 * @param {string} bgColor - Background color (hex without #)
 * @param {string} textColor - Text color (hex without #)
 * @returns {string} - Placeholder image URL
 */
export const getPlaceholderImage = (
  width = 400, 
  height = 400, 
  text = '?', 
  bgColor = 'CCCCCC', 
  textColor = '666666'
) => {
  return `https://placehold.co/${width}x${height}/${bgColor}/${textColor}?text=${encodeURIComponent(text)}`;
};

// Default export object with all functions
const helpers = {
  niceDate,
  formatMemoryTime,
  getMemoryMood,
  getUploadDate,
  getRelativeTime,
  getMoodColor,
  truncateText,
  capitalize,
  formatNumber,
  getInitials,
  isValidEmail,
  generateRandomId,
  debounce,
  isToday,
  isYesterday,
  getPlaceholderImage
};

export default helpers;