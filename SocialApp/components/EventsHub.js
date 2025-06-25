// SocialApp/components/EventsHub.js - ENHANCED: Better refresh support
import React, { useState, useEffect, forwardRef, useImperativeHandle, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import FollowingEventsFeed from './FollowingEventsFeed';
import EventsFeed from './EventsFeed';

// SIMPLIFIED: Only Following and For You tabs as discussed
const EVENTS_TABS = [
  { key: 'following', label: 'Following', icon: 'people-outline' },
  { key: 'for-you', label: 'For You', icon: 'star-outline' },
];

const EventsHub = forwardRef(({ navigation, refreshing: externalRefreshing, onRefresh: externalOnRefresh }, ref) => {
  const { currentUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('following');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // ENHANCED: Expose refresh method to parent with better async handling
  useImperativeHandle(ref, () => ({
    refresh: async () => {
      console.log('🔄 EventsHub: Manual refresh triggered');
      await handleRefresh();
    }
  }));

  // ENHANCED: Better refresh handling
  const handleRefresh = async () => {
    console.log('🔄 EventsHub: Refresh triggered for tab:', activeTab);
    setRefreshing(true);
    setError(null);
    
    try {
      // Add a small delay to ensure proper refresh
      await new Promise(resolve => setTimeout(resolve, 500));
      
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
      <Text 
        style={[
          styles.tabButtonText,
          activeTab === tabKey && styles.activeTabButtonText
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRefresh}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    switch (activeTab) {
      case 'following':
        return (
          <FollowingEventsFeed 
            navigation={navigation}
            currentUserId={currentUser?._id}
            refreshing={refreshing || externalRefreshing}
            onRefresh={handleInternalRefresh}
          />
        );
      case 'for-you':
      default:
        return (
          <EventsFeed 
            navigation={navigation}
            currentUserId={currentUser?._id}
            refreshing={refreshing || externalRefreshing}
            onRefresh={handleInternalRefresh}
            feedType="discover"
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Tab Headers */}
      <View style={styles.tabContainer}>
        <View style={styles.tabScrollContent}>
          {EVENTS_TABS.map(tab => renderTabButton(tab.key, tab.label, tab.icon))}
        </View>
      </View>

      {/* Content - Enhanced with refresh control */}
      <View style={styles.contentContainer}>
        <ScrollView
          style={styles.scrollContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || externalRefreshing || false}
              onRefresh={handleInternalRefresh}
              tintColor="#3797EF"
              colors={["#3797EF"]}
              title="Pull to refresh"
              titleColor="#8E8E93"
            />
          }
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
        >
          {renderContent()}
        </ScrollView>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  tabContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabScrollContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    minWidth: 120,
    justifyContent: 'center',
  },
  activeTabButton: {
    backgroundColor: '#E3F2FD',
  },
  tabButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
    marginLeft: 6,
  },
  activeTabButtonText: {
    color: '#3797EF',
  },
  contentContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    minHeight: 300,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default EventsHub;