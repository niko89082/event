// components/EventsHub.js - Enhanced with all tabs restored
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

const EVENTS_TABS = [
  { key: 'following', label: 'Following', icon: 'people-outline' },
  { key: 'discover', label: 'Discover', icon: 'compass-outline' },
  { key: 'nearby', label: 'Nearby', icon: 'location-outline' },
  { key: 'your-events', label: 'Your Events', icon: 'person-outline' }
];

const EventsHub = forwardRef(({ navigation }, ref) => {
  const { currentUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('following');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refresh: handleRefresh
  }));

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    
    try {
      // Add a small delay to ensure proper refresh
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // The individual feed components will handle their own refresh
    } catch (error) {
      console.error('EventsHub refresh error:', error);
      setError('Failed to refresh events');
    } finally {
      setRefreshing(false);
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
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        );
      case 'discover':
        return (
          <EventsFeed 
            navigation={navigation}
            currentUserId={currentUser?._id}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            feedType="discover"
          />
        );
      case 'nearby':
        return (
          <EventsFeed 
            navigation={navigation}
            currentUserId={currentUser?._id}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            feedType="nearby"
          />
        );
      case 'your-events':
        return (
          <EventsFeed 
            navigation={navigation}
            currentUserId={currentUser?._id}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            feedType="user"
            userId={currentUser?._id}
          />
        );
      default:
        return (
          <FollowingEventsFeed 
            navigation={navigation}
            currentUserId={currentUser?._id}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Tab Headers */}
      <View style={styles.tabContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
        >
          {EVENTS_TABS.map(tab => renderTabButton(tab.key, tab.label, tab.icon))}
        </ScrollView>
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {renderContent()}
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
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#F8F9FA',
    gap: 6,
  },
  activeTabButton: {
    backgroundColor: '#3797EF',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  activeTabButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
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