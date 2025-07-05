// SocialApp/components/EventsHub.js - Enhanced with scroll event handling for animated header
import React, { useState, useEffect, forwardRef, useImperativeHandle, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import FollowingEventsFeed from './FollowingEventsFeed';
import EventsFeed from './EventsFeed';

// Following and For You tabs as in existing structure
const EVENTS_TABS = [
  { key: 'following', label: 'Following', icon: 'people-outline' },
  { key: 'for-you', label: 'For You', icon: 'star-outline' },
];

const EventsHub = forwardRef(({ 
  navigation, 
  refreshing: externalRefreshing, 
  onRefresh: externalOnRefresh,
  onScroll: parentOnScroll,
  scrollEventThrottle = 16 
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
        size={18} 
        color={activeTab === tabKey ? '#3797EF' : '#8E8E93'} 
      />
      <Text style={[
        styles.tabButtonText,
        activeTab === tabKey && styles.activeTabButtonText
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderActiveTab = () => {
    const commonProps = {
      navigation,
      refreshing: refreshing || externalRefreshing || false,
      onRefresh: handleInternalRefresh,
      onScroll: handleScroll,
      scrollEventThrottle,
    };

    switch (activeTab) {
      case 'following':
        return <FollowingEventsFeed {...commonProps} />;
      case 'for-you':
        return <EventsFeed {...commonProps} />;
      default:
        return null;
    }
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="cloud-offline-outline" size={64} color="#8E8E93" />
        <Text style={styles.errorTitle}>Connection Error</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Selection */}
      <View style={styles.tabsContainer}>
        {EVENTS_TABS.map(tab => 
          renderTabButton(tab.key, tab.label, tab.icon)
        )}
      </View>

      {/* Active Tab Content */}
      <View style={styles.contentContainer}>
        {renderActiveTab()}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // Tab Selection
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
  },
  activeTabButton: {
    backgroundColor: '#E8F4FD',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginLeft: 6,
  },
  activeTabButtonText: {
    color: '#3797EF',
    fontWeight: '600',
  },
  
  // Content
  contentContainer: {
    flex: 1,
  },
  
  // Error state styles
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