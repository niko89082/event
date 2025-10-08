// components/EventsHub.js - Updated with dynamic tabs (PRESERVING ALL ANIMATIONS)
import React, { useState, useEffect, forwardRef, useImperativeHandle, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import FollowingEventsFeed from './FollowingEventsFeed';
import EventsFeed from './EventsFeed';
// ✅ NEW: Import new feed components
import HostingEventsFeed from './HostingEventsFeed';
import AttendingEventsFeed from './AttendingEventsFeed';
// ✅ NEW: Import dynamic tab hooks
import { useUserEvents } from '../hooks/useUserEvents';
import { useDynamicEventTabs, getDefaultActiveTab, getNextValidTab } from '../hooks/useDynamicEventTabs';
import useEventStore from '../stores/eventStore'; // Import centralized store

// ❌ REMOVED: Static EVENTS_TABS array - now dynamic
// Following and For You tabs (can add more in the future)
// const EVENTS_TABS = [
//   { key: 'following', label: 'Following', icon: 'people-outline' },
//   { key: 'for-you', label: 'For You', icon: 'star-outline' },
//   // ADD MORE TABS HERE IN THE FUTURE:
//   // { key: 'nearby', label: 'Nearby', icon: 'location-outline' },
//   // { key: 'trending', label: 'Trending', icon: 'trending-up-outline' },
// ];


const EventsHub = forwardRef(({ 
  navigation, 
  refreshing: externalRefreshing, 
  onRefresh: externalOnRefresh,
  onScroll: parentOnScroll,
  scrollEventThrottle = 16,
  getSubTabStyle,
  subTabTranslateY,
}, ref) => {
  const { currentUser } = useContext(AuthContext);
  
    console.log('🏗️ EventsHub render:', {
    currentUserId: currentUser?._id,
    currentUserExists: !!currentUser,
    currentUserIdExists: !!currentUser?._id
  });

  // ✅ NEW: Dynamic tab logic
 const { 
    hasHostingEvents, 
    hasAttendingEvents, 
    hostingEvents,
    attendingEvents,
    loading: userEventsLoading,
    error: userEventsError,
    refresh: refreshUserEvents,
    summary // Add summary for debugging
  } = useUserEvents(currentUser?._id);
  
   console.log('🎯 EventsHub user events state:', {
    hasHostingEvents,
    hasAttendingEvents,
    hostingEventsCount: hostingEvents?.length,
    attendingEventsCount: attendingEvents?.length,
    userEventsLoading,
    userEventsError,
    summary
  });
  
  const { tabs: dynamicTabs } = useDynamicEventTabs(hasHostingEvents, hasAttendingEvents);
  
  
  console.log('🏷️ EventsHub dynamic tabs:', {
    tabCount: dynamicTabs.length,
    tabKeys: dynamicTabs.map(t => t.key),
    hasHostingTab: dynamicTabs.some(t => t.key === 'hosting'),
    hasAttendingTab: dynamicTabs.some(t => t.key === 'attending')
  });
  
  // ✅ NEW: Smart default tab selection (but start with 'following' to match original)
  const [activeTab, setActiveTab] = useState('following');
  
  
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
 useEffect(() => {
    console.log('🔄 EventsHub: Checking tab validity...', {
      currentActiveTab: activeTab,
      hasHostingEvents,
      hasAttendingEvents,
      dynamicTabsCount: dynamicTabs.length
    });

    const currentTabValid = dynamicTabs.some(tab => tab.key === activeTab);
    if (!currentTabValid) {
      const nextValidTab = getNextValidTab(activeTab, hasHostingEvents, hasAttendingEvents);
      console.log(`🔄 EventsHub: Switching from invalid tab "${activeTab}" to "${nextValidTab}"`);
      setActiveTab(nextValidTab);
    }
  }, [activeTab, hasHostingEvents, hasAttendingEvents, dynamicTabs]);
  // Get centralized store state and actions
  const {
    loading: storeLoading,
    error: storeError,
    getFeedCache,
    updateFeedCache,
    syncEventsFromFeed,
    needsRefresh,
    clearEvents
  } = useEventStore();

  // ✅ NEW: Update active tab when user events change
  useEffect(() => {
    const currentTabValid = dynamicTabs.some(tab => tab.key === activeTab);
    if (!currentTabValid) {
      const nextValidTab = getNextValidTab(activeTab, hasHostingEvents, hasAttendingEvents);
      console.log(`🔄 EventsHub: Switching from invalid tab "${activeTab}" to "${nextValidTab}"`);
      setActiveTab(nextValidTab);
    }
  }, [activeTab, hasHostingEvents, hasAttendingEvents, dynamicTabs]);

  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refresh: async () => {
      console.log('🔄 EventsHub: Manual refresh triggered');
      await refreshUserEvents();
    }
  }));

  // Enhanced scroll handler that combines internal logic with parent callback
  const handleScroll = useCallback((event) => {
    // Call parent's scroll handler for tab bar animation
    if (parentOnScroll) {
      parentOnScroll(event);
    }
  }, [parentOnScroll]);

   useEffect(() => {
    console.log('🔄 EventsHub: Checking tab validity...', {
      currentActiveTab: activeTab,
      hasHostingEvents,
      hasAttendingEvents,
      dynamicTabsCount: dynamicTabs.length
    });

    const currentTabValid = dynamicTabs.some(tab => tab.key === activeTab);
    if (!currentTabValid) {
      const nextValidTab = getNextValidTab(activeTab, hasHostingEvents, hasAttendingEvents);
      console.log(`🔄 EventsHub: Switching from invalid tab "${activeTab}" to "${nextValidTab}"`);
      setActiveTab(nextValidTab);
    }
  }, [activeTab, hasHostingEvents, hasAttendingEvents, dynamicTabs]);

  // Internal refresh handler that works with external refresh
  const handleInternalRefresh = async () => {
    console.log('🔄 EventsHub: Pull-to-refresh triggered');
    if (externalOnRefresh) {
      await externalOnRefresh();
    } else {
      await refreshUserEvents();
    }
  };

  // Handle tab change - cache previous tab data
  const handleTabChange = (newTab) => {
    console.log('🔄 EventsHub: Tab changed from', activeTab, 'to', newTab);
    setActiveTab(newTab);
    setError(null);
  };

  // Listen for store errors
  useEffect(() => {
    if (storeError && !error) {
      setError(storeError);
    }
  }, [storeError, error]);

  // Handle user logout - clear events
  useEffect(() => {
    if (!currentUser) {
      clearEvents();
    }
  }, [currentUser, clearEvents]);

  const renderTabButton = (tabKey, label, icon) => (
    <TouchableOpacity
      key={tabKey}
      style={[
        styles.tabButton,
        activeTab === tabKey && styles.activeTabButton
      ]}
      onPress={() => handleTabChange(tabKey)}
      activeOpacity={0.8}
    >
      <Ionicons 
        name={icon} 
        size={16} 
        color={activeTab === tabKey ? '#FFFFFF' : '#3797EF'} 
      />
      <Text style={[
        styles.tabButtonText,
        activeTab === tabKey && styles.activeTabButtonText
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="cloud-offline-outline" size={64} color="#8E8E93" />
      <Text style={styles.errorTitle}>Connection Error</Text>
      <Text style={styles.errorMessage}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={refreshUserEvents}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  const renderActiveTabContent = () => {
    if (error) {
      return renderError();
    }

    // Pass scroll handling and refresh props to child components
    const commonProps = {
      navigation,
      currentUserId: currentUser?._id,
      refreshing: refreshing || externalRefreshing,
      onRefresh: handleInternalRefresh,
      onScroll: handleScroll,
      scrollEventThrottle,
      // Store integration props
      useEventStore: true, // Flag to enable store usage in child components
      activeTab, // Pass active tab for cache management
    };

    // ✅ UPDATED: Enhanced switch statement with new feed components
    switch (activeTab) {
      case 'following':
        return (
          <FollowingEventsFeed
            {...commonProps}
          />
        );
      case 'for-you':
        return (
          <EventsFeed
            {...commonProps}
            feedType="discover"
          />
        );
      case 'hosting':
        return (
          <HostingEventsFeed
            {...commonProps}
          />
        );
      case 'attending':
        return (
          <AttendingEventsFeed
            {...commonProps}
          />
        );
      default:
        return null;
    }
  };
if (!currentUser?._id) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading user data...</Text>
        </View>
      </View>
    );
  }
  // ✅ NEW: Show loading state while determining which tabs to show
  if (userEventsLoading && dynamicTabs.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading your events...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 🚫 UNCHANGED: Sub-tabs with DIRECT animation value - PRESERVING ALL ANIMATIONS */}
      <Animated.View style={[
        styles.unifiedSubTabsContainer, 
        { transform: [{ translateY: subTabTranslateY || 0 }] } // USE the direct animated value
      ]}>
        <ScrollView 
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subTabScrollContent}
          style={styles.subTabScrollView}
        >
          <View style={styles.subTabBar}>
            {/* ✅ UPDATED: Use dynamic tabs instead of static EVENTS_TABS */}
            {dynamicTabs.map(tab => 
              renderTabButton(tab.key, tab.label, tab.icon)
            )}
          </View>
        </ScrollView>
      </Animated.View>
      
      {/* Content area - flows naturally */}
      <View style={styles.contentContainer}>
        {renderActiveTabContent()}
      </View>
    </View>
  );
});

// 🚫 UNCHANGED: All styles preserved exactly as they were from the original file
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // TRANSPARENT!
  },
  
  // GLASSMORPHISM: Sub-tabs with frosted glass effect
unifiedSubTabsContainer: {
  position: 'absolute',
  top: 144, // Position below main tabs (safe area + fixed header + main tabs)
  left: 0,
  right: 0,
  zIndex: 100,
  // ✅ MAKE TRANSPARENT: Remove glassmorphism background
  backgroundColor: 'transparent', // ✅ CHANGED: From rgba background to transparent
  // ✅ REMOVE: All glassmorphism effects for the container
  // backgroundColor: Platform.OS === 'ios' 
  //   ? 'rgba(255, 255, 255, 0.25)' 
  //   : 'rgba(255, 255, 255, 0.3)',
  // ...(Platform.OS === 'ios' && {
  //   backdropFilter: 'blur(40px) saturate(200%) contrast(120%)',
  // }),
  // borderBottomWidth: 0.5,
  // borderBottomColor: 'rgba(255, 255, 255, 0.18)',
  // shadowColor: 'rgba(31, 38, 135, 0.37)',
  // shadowOffset: { width: 0, height: 8 },
  // shadowOpacity: 1,
  // shadowRadius: 32,
  // elevation: 8,
  height: 56, // Fixed height for consistent spacing
},
  
  // NEW: Horizontal scroll view for sub-tabs
  subTabScrollView: {
    flex: 1,
  },
  
  subTabScrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    minWidth: '100%', // Ensure it takes full width when there are few tabs
  },
  
  subTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12, // Space between oval tabs
  },
  
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20, // Oval shape
    // GLASSMORPHISM: Enhanced glass effect for buttons
    backgroundColor: Platform.OS === 'ios' 
      ? 'rgba(255, 255, 255, 0.2)' 
      : 'rgba(255, 255, 255, 0.25)',
    ...(Platform.OS === 'ios' && {
      backdropFilter: 'blur(20px) saturate(180%)',
    }),
    borderWidth: 1,
    borderColor: 'rgba(55, 151, 239, 0.2)', // Subtle blue border
    minWidth: 80,
    // GLASSMORPHISM: Subtle shadow
    shadowColor: 'rgba(31, 38, 135, 0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  
  activeTabButton: {
    backgroundColor: Platform.OS === 'ios' 
      ? 'rgba(55, 151, 239, 0.8)' // Glass effect even when active
      : 'rgba(55, 151, 239, 0.9)',
    ...(Platform.OS === 'ios' && {
      backdropFilter: 'blur(20px) saturate(180%)',
    }),
    borderColor: 'rgba(255, 255, 255, 0.3)',
    // GLASSMORPHISM: Enhanced shadow when active
    shadowColor: 'rgba(55, 151, 239, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  
  tabButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3797EF', // BLUE THEME
    marginLeft: 5,
    textAlign: 'center',
    lineHeight: 16,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  
  activeTabButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },

  // Content container - starts from top, flows under all headers
  contentContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  // Loading and error states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingTop: 250,
  },
  
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: 'transparent',
    paddingTop: 250,
  },
  
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  
  errorMessage: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  
  retryButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EventsHub;