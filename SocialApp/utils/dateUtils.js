export const validateAndFormatDate = (dateInput, fallback = 'Just now') => {
  try {
    if (!dateInput) return fallback;
    
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', dateInput);
      return fallback;
    }
    
    return date;
  } catch (error) {
    console.error('Date validation error:', error);
    return fallback;
  }
};

export const safeRelativeTime = (dateInput) => {
  const date = validateAndFormatDate(dateInput);
  if (typeof date === 'string') return date; // fallback string
  
  const now = new Date();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  
  return date.toLocaleDateString();
};