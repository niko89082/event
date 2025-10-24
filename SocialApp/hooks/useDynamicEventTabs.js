// hooks/useDynamicEventTabs.js - Generate tab configuration based on user's event participation
import { useMemo } from 'react';

/**
 * Generate dynamic tab configuration for EventsHub
 * @param {boolean} hasHostingEvents - Whether user has events they're hosting/cohosting
 * @param {boolean} hasAttendingEvents - Whether user has events they're attending
 * @returns {Array} Array of tab objects with key, label, and icon
 */
export const useDynamicEventTabs = (hasHostingEvents, hasAttendingEvents) => {
  const dynamicTabs = useMemo(() => {
    const baseTabs = [
      { key: 'following', label: 'Friends', icon: 'people-outline' },
      { key: 'for-you', label: 'For You', icon: 'star-outline' }
    ];

    const additionalTabs = [];

    // Add hosting tab if user has hosting events (including cohosts)
    if (hasHostingEvents) {
      additionalTabs.push({
        key: 'hosting',
        label: 'Hosting',
        icon: 'calendar' // Using 'calendar' - represents organized events
      });
    }

    // Add attending tab if user has attending events
    if (hasAttendingEvents) {
      additionalTabs.push({
        key: 'attending',
        label: 'Attending',
        icon: 'checkmark-circle' // Filled checkmark for confirmed attendance
      });
    }

    const allTabs = [...baseTabs, ...additionalTabs];

    console.log('🏷️ Dynamic tabs generated:', {
      hasHostingEvents,
      hasAttendingEvents,
      tabCount: allTabs.length,
      tabKeys: allTabs.map(t => t.key),
      tabLabels: allTabs.map(t => t.label)
    });

    return allTabs;
  }, [hasHostingEvents, hasAttendingEvents]);

  // Additional utility data
  const tabInfo = useMemo(() => ({
    totalTabs: dynamicTabs.length,
    hasCustomTabs: hasHostingEvents || hasAttendingEvents,
    customTabCount: (hasHostingEvents ? 1 : 0) + (hasAttendingEvents ? 1 : 0),
    tabKeys: dynamicTabs.map(tab => tab.key),
    tabLabels: dynamicTabs.map(tab => tab.label)
  }), [dynamicTabs, hasHostingEvents, hasAttendingEvents]);

  return {
    tabs: dynamicTabs,
    info: tabInfo
  };
};

/**
 * Get the default active tab based on available tabs
 * Prioritizes user-specific content over discovery content
 * @param {boolean} hasHostingEvents
 * @param {boolean} hasAttendingEvents
 * @returns {string} Default tab key
 */
export const getDefaultActiveTab = (hasHostingEvents, hasAttendingEvents) => {
  // Priority order: hosting -> attending -> following -> for-you
  if (hasHostingEvents) {
    return 'hosting';
  }
  
  if (hasAttendingEvents) {
    return 'attending';
  }
  
  // Default to following for discovery
  return 'following';
};

/**
 * Check if a tab key is valid for the current user's event state
 * @param {string} tabKey - The tab key to validate
 * @param {boolean} hasHostingEvents
 * @param {boolean} hasAttendingEvents
 * @returns {boolean} Whether the tab is valid/should be shown
 */
export const isValidTab = (tabKey, hasHostingEvents, hasAttendingEvents) => {
  switch (tabKey) {
    case 'following':
    case 'for-you':
      return true; // These are always valid
    case 'hosting':
      return hasHostingEvents;
    case 'attending':
      return hasAttendingEvents;
    default:
      return false;
  }
};

/**
 * Get the next valid tab when a tab becomes invalid
 * Useful when user leaves their last event or deletes their last hosted event
 * @param {string} currentTab - Current active tab
 * @param {boolean} hasHostingEvents
 * @param {boolean} hasAttendingEvents
 * @returns {string} Next valid tab key
 */
export const getNextValidTab = (currentTab, hasHostingEvents, hasAttendingEvents) => {
  // If current tab is still valid, keep it
  if (isValidTab(currentTab, hasHostingEvents, hasAttendingEvents)) {
    return currentTab;
  }

  // Otherwise, get the default tab for current state
  return getDefaultActiveTab(hasHostingEvents, hasAttendingEvents);
};