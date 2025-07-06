// SocialApp/components/EventsHub.js - FIXED: Always visible sub-tabs with better layout
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import FollowingEventsFeed from './FollowingEventsFeed';
import EventsFeed from './EventsFeed';

// Following and For You tabs
const EVENTS_TABS = [
  { key: 'following', label: 'Following', icon: 'people-outline' },
  { key: 'for-you', label: 'For You', icon: 'star-outline' },
];

const EventsHub = forwardRef(({ 
  navigation, 
  refreshing: externalRefreshing, 
  onRefresh: externalOnRefresh,
  onScroll: parentOnScroll,
  scrollEventThrottle = 16,
  headerStyle // Receive header animation style from parent
}, ref) => {
  const { currentUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('following');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refresh: async () => {
      console.log('🔄 EventsHub: Manual refresh triggered');
      await handleRefresh();
    }
  }));

  // Enhanced scroll handler that combines internal logic with parent callback
  const handleScroll = useCallback((event) => {
    // Call parent's scroll handler for header animation
    if (parentOnScroll) {
      parentOnScroll(event);
    }
  }, [parentOnScroll]);

  const handleRefresh = async () => {
    console.log('🔄 EventsHub: Refresh triggered for tab:', activeTab);
    setRefreshing(true);
    setError(null);
    
    try {
      // Add a small delay to ensure proper refresh
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // The individual feed components will handle their own refresh
      // This is mainly for coordinating the refresh state
    } catch (error) {
      console.error('EventsHub refresh error:', error);
      setError('Failed to refresh events');
    } finally {
      setRefreshing(false);
    }
  };

  // Internal refresh handler that works with external refresh
  const handleInternalRefresh = async () => {
    console.log('🔄 EventsHub: Pull-to-refresh triggered');
    if (externalOnRefresh) {
      await externalOnRefresh();
    } else {
      await handleRefresh();
    }
  };

  const renderTabButton = (tabKey, label, icon) => (
    <TouchableOpacity
      key={tabKey}
      style={[
        styles.tabButton,
        activeTab === tabKey && styles.activeTabButton
      ]}
      onPress={() => setActiveTab(tabKey)}
      activeOpacity={0.8}
    >
      <Ionicons 
        name={icon} 
        size={16} 
        color={activeTab === tabKey ? '#FFFFFF' : '#8E8E93'} 
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
      <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
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
    };

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
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* FIXED: Static tab bar that's always visible */}
      <View style={styles.stickyTabBarContainer}>
        <View style={styles.tabBar}>
          {EVENTS_TABS.map(tab => 
            renderTabButton(tab.key, tab.label, tab.icon)
          )}
        </View>
      </View>
      
      {/* Content area */}
      <View style={styles.contentContainer}>
        {renderActiveTabContent()}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // FIXED: Always visible sticky tab bar - properly spaced from main header
  stickyTabBarContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
    marginTop: 16, // Increased margin for better spacing from main header
    marginBottom: 16, // Added bottom margin to match top spacing
    paddingHorizontal: 16,
  },
  
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
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
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    minWidth: 80,
  },
  
  activeTabButton: {
    backgroundColor: '#3797EF',
    borderColor: '#3797EF',
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  
  tabButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
    marginLeft: 5,
  },
  
  activeTabButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Content container
  contentContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Loading and error states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
  },
  
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EventsHub;