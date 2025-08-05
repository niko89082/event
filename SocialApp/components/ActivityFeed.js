// components/ActivityFeed.js - Main Activity Feed Component
import React, { useState, useEffect, useCallback, useContext, forwardRef, useImperativeHandle } from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import useActivityStore from '../stores/activityStore';
import api from '../services/api';

// Import activity components
import CompletePostItem from './PostItem'; // Existing post component
import EventInvitationActivity from './activities/EventInvitationActivity';
import EventPhotoActivity from './activities/EventPhotoActivity';
import FriendEventActivity from './activities/FriendEventActivity';
import FriendRequestActivity from './activities/FriendRequestActivity';
import FriendRequestAcceptedActivity from './activities/FriendRequestAcceptedActivity';
import EventReminderActivity from './activities/EventReminderActivity';
import MemoryCreatedActivity from './activities/MemoryCreatedActivity';
import EventCreatedActivity from './activities/EventCreatedActivity';
import MemoryPhotoUploadActivity from './activities/MemoryPhotoUploadActivity';
import PhotoCommentActivity from './activities/PhotoCommentActivity';              // ✅ NEW
import MemoryPhotoCommentActivity from './activities/MemoryPhotoCommentActivity';


const ActivityFeed = forwardRef(({
  navigation,
  refreshing: externalRefreshing = false,
  onRefresh: externalOnRefresh,
  onScroll: parentOnScroll,
  scrollEventThrottle = 16,
}, ref) => {
  const { currentUser } = useContext(AuthContext);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [debugInfo, setDebugInfo] = useState(null);

  // Store actions for activity handling
  const syncActivitiesFromFeed = useActivityStore(state => state.syncActivitiesFromFeed);
  const handleActivityAction = useActivityStore(state => state.handleActivityAction);

  // ✅ CRITICAL FIX: Extract currentUserId and validate
  const currentUserId = currentUser?._id;
  
  // ✅ DEBUG: Log currentUserId state
  console.log('🎯 ActivityFeed: currentUserId extracted:', {
    currentUserId,
    hasCurrentUser: !!currentUser,
    currentUserObject: currentUser
  });

  useEffect(() => {
    fetchPage(1, true);
  }, []);

  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refresh: async () => {
      console.log('🔄 ActivityFeed: Manual refresh triggered');
      return await fetchPage(1, true);
    }
  }));

  const fetchPage = async (pageNum, reset = false) => {
    if (loading) return;

    try {
      setLoading(true);
      setError(null);

      console.log(`🟡 [ActivityFeed] Fetching page ${pageNum}, reset: ${reset}`);

      const response = await api.get('/api/feed/activity', {
        params: { page: pageNum, limit: 15 },
      });

      const newActivities = response.data.activities || [];
      const debug = response.data.debug || null;

      console.log(`🟢 [ActivityFeed] Received ${newActivities.length} activities:`, {
        activityTypes: debug?.activityCounts || {},
        total: debug?.activityCounts?.total || 0,
      });

      if (reset) {
        setData(newActivities);
        setPage(2);
        // SYNC WITH STORE
        syncActivitiesFromFeed(newActivities);
      } else {
        setData(prev => [...prev, ...newActivities]);
        setPage(prev => prev + 1);
        // SYNC WITH STORE
        syncActivitiesFromFeed(newActivities);
      }

      setHasMore(response.data.hasMore || false);
      setDebugInfo(debug);

    } catch (err) {
      console.error('❌ [ActivityFeed] Error:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Failed to load activities');
      
      if (data.length === 0) {
        setError('Unable to load activities. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    console.log('🔄 ActivityFeed: Refresh requested');
    setRefreshing(true);
    
    if (externalOnRefresh) {
      await externalOnRefresh();
    } else {
      await fetchPage(1, true);
    }
    
    setRefreshing(false);
  }, [externalOnRefresh]);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore && data.length > 0) {
      fetchPage(page);
    }
  }, [loading, hasMore, data.length, page]);

  // Handle activity actions (friend requests, event invitations, etc.)
  const handleActivityActionPress = useCallback(async (activityId, action, actionData = {}) => {
    try {
      console.log(`🎯 ActivityFeed: Handling action ${action} for activity ${activityId}`);
      
      // Use store action handler for optimistic updates
      await handleActivityAction(activityId, action, actionData);
      
      // Show success feedback
      switch (action) {
        case 'accept_friend_request':
          Alert.alert('Success', 'Friend request accepted!');
          break;
        case 'decline_friend_request':
          Alert.alert('Friend Request', 'Friend request declined');
          break;
        case 'accept_event_invitation':
          Alert.alert('Success', 'Event invitation accepted!');
          break;
        case 'decline_event_invitation':
          Alert.alert('Event Invitation', 'Event invitation declined');
          break;
        case 'send_friend_request':
          Alert.alert('Success', 'Friend request sent!');
          break;
        default:
          break;
      }
      
      // Refresh feed to get updated data
      await fetchPage(1, true);
      
    } catch (error) {
      console.error('❌ ActivityFeed: Action error:', error);
      Alert.alert('Error', error.message || 'Failed to complete action');
    }
  }, [handleActivityAction]);

  // ✅ UPDATED: Render different activity types
  const renderActivity = useCallback(({ item }) => {
  console.log('🎯 ActivityFeed: Rendering activity:', {
    activityId: item._id,
    activityType: item.activityType,
    currentUserId: currentUserId,
    hasCurrentUserId: !!currentUserId
  });
  
  // Common props for all activity components
  const commonProps = {
    activity: item,
    currentUserId: currentUserId,
    navigation: navigation,
    onAction: handleActivityActionPress,
  };

  switch (item.activityType) {
    case 'regular_post':
    case 'memory_post':
      // Use existing PostItem component for posts
      return (
        <View style={styles.activityWrapper}>
          <CompletePostItem 
            post={item} 
            currentUserId={currentUserId}
            navigation={navigation}
          />
        </View>
      );

    case 'event_invitation':
      return (
        <View style={styles.activityWrapper}>
          <EventInvitationActivity {...commonProps} />
        </View>
      );

    case 'event_created':
      return (
        <View style={styles.activityWrapper}>
          <EventCreatedActivity {...commonProps} />
        </View>
      );

    case 'event_photo_upload':
      return (
        <View style={styles.activityWrapper}>
          <EventPhotoActivity {...commonProps} />
        </View>
      );

    case 'friend_event_join':
      return (
        <View style={styles.activityWrapper}>
          <FriendEventActivity {...commonProps} />
        </View>
      );

    case 'friend_request':
      return (
        <View style={styles.activityWrapper}>
          <FriendRequestActivity {...commonProps} />
        </View>
      );

    case 'friend_request_accepted':
      return (
        <View style={styles.activityWrapper}>
          <FriendRequestAcceptedActivity {...commonProps} />
        </View>
      );

    case 'event_reminder':
      return (
        <View style={styles.activityWrapper}>
          <EventReminderActivity {...commonProps} />
        </View>
      );

    case 'memory_created':
      return (
        <View style={styles.activityWrapper}>
          <MemoryCreatedActivity {...commonProps} />
        </View>
      );

    case 'memory_photo_upload':
      return (
        <View style={styles.activityWrapper}>
          <MemoryPhotoUploadActivity {...commonProps} />
        </View>
      );

    // ✅ NEW PHASE 2 CASES: Comment activities
    case 'photo_comment':
      return (
        <View style={styles.activityWrapper}>
          <PhotoCommentActivity {...commonProps} />
        </View>
      );

    case 'memory_photo_comment':
      return (
        <View style={styles.activityWrapper}>
          <MemoryPhotoCommentActivity {...commonProps} />
        </View>
      );

    default:
      console.warn('⚠️ Unknown activity type:', item.activityType);
      return (
        <View style={styles.unknownActivityWrapper}>
          <Text style={styles.unknownActivityText}>
            Unknown activity type: {item.activityType}
          </Text>
        </View>
      );
  }
}, [navigation, currentUserId, handleActivityActionPress]);



  const renderFooter = () => {
    if (!loading || data.length === 0) return null;
    
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#3797EF" />
        <Text style={styles.footerText}>Loading more activities...</Text>
      </View>
    );
  };

  const handleScroll = useCallback((event) => {
    if (parentOnScroll) {
      parentOnScroll(event);
    }
  }, [parentOnScroll]);

  // ✅ ENHANCED: Show warning if no currentUserId
  if (!currentUserId) {
    console.warn('⚠️ ActivityFeed: No currentUserId available - user may not be logged in');
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="person-outline" size={48} color="#FF6B6B" />
        <Text style={styles.errorTitle}>Authentication Required</Text>
        <Text style={styles.errorMessage}>Please log in to view activities</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => navigation.navigate('LoginScreen')}
        >
          <Text style={styles.retryButtonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && data.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading activities...</Text>
      </View>
    );
  }

  if (error && data.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#FF6B6B" />
        <Text style={styles.errorTitle}>Oops!</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchPage(1, true)}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="flash-outline" size={48} color="#8E8E93" />
        <Text style={styles.emptyTitle}>No Activities Yet</Text>
        <Text style={styles.emptySubtitle}>
          Follow some friends or join events to see activities here!
        </Text>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('DiscoverScreen')}
        >
          <Text style={styles.actionButtonText}>Discover People</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      ref={ref}
      data={data}
      keyExtractor={(item) => item._id}
      renderItem={renderActivity}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.1}
      refreshControl={
        <RefreshControl
          refreshing={refreshing || externalRefreshing}
          onRefresh={handleRefresh}
          colors={['#3797EF']}
          tintColor="#3797EF"
        />
      }
      ListFooterComponent={renderFooter}
      onScroll={handleScroll}
      scrollEventThrottle={scrollEventThrottle}
      showsVerticalScrollIndicator={true}
      contentContainerStyle={data.length === 0 ? styles.emptyContentContainer : styles.contentContainer}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      windowSize={10}
    />
  );
});

const styles = StyleSheet.create({
  contentContainer: {
    paddingTop: 16,
    paddingBottom: 100,
  },
  emptyContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  
  // Activity wrappers
  activityWrapper: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  unknownActivityWrapper: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  unknownActivityText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
  },
  
  // Loading states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 250,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  
  // Footer loading
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  
  // Error states
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 200,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  
  // Action buttons
  actionButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

ActivityFeed.displayName = 'ActivityFeed';

export default ActivityFeed;