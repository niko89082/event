// components/ActivityFeedContainer.js - Data logic container (EventsHub pattern)
import React, { useState, useEffect, useCallback, useContext, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import useActivityStore from '../stores/activityStore';
import usePostsStore from '../stores/postsStore';
import api from '../services/api';
import ActivityList from './ActivityList';
import PostComposer from './PostComposer';

const ActivityFeedContainer = forwardRef(({
  navigation,
  refreshing: externalRefreshing = false,
  onRefresh: externalOnRefresh,
  onScroll: parentOnScroll,
  scrollEventThrottle = 16,
  debugValues = {},
}, ref) => {
  
  const { currentUser } = useContext(AuthContext);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [followingCount, setFollowingCount] = useState(0);

  // Store actions for activity handling
  const syncActivitiesFromFeed = useActivityStore(state => state.syncActivitiesFromFeed);
  const handleActivityAction = useActivityStore(state => state.handleActivityAction);

  // Extract currentUserId and validate
  const currentUserId = currentUser?._id;
  
  console.log('🎯 ActivityFeedContainer: currentUserId extracted:', {
    currentUserId,
    hasCurrentUser: !!currentUser,
  });

  useEffect(() => {
    if (currentUserId) {
      fetchPage(1, true);
    }
  }, [currentUserId]);

  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refresh: async () => {
      console.log('🔄 ActivityFeedContainer: Manual refresh triggered');
      return await fetchPage(1, true);
    }
  }));

  const fetchPage = async (pageNum, reset = false) => {
    if (loading || !currentUserId) return;

    try {
      setLoading(true);
      setError(null);

      console.log(`🟡 [ActivityFeedContainer] Fetching page ${pageNum}, reset: ${reset}`);

      const response = await api.get('/api/feed/activity', {
        params: { page: pageNum, limit: 15 },
      });

      const newActivities = response.data.activities || [];
      const metadata = response.data.metadata || {};

      console.log(`🟢 [ActivityFeedContainer] Received ${newActivities.length} activities:`, {
        total: newActivities.length,
        followingCount: metadata.userConnections?.followingCount || 0,
      });

      // Sync posts to centralized store for like state management with currentUserId
      const postsToSync = newActivities.filter(a => 
        a.activityType === 'regular_post' || 
        a.activityType === 'text_post' || 
        a.activityType === 'review_post' || 
        a.activityType === 'memory_post'
      );
      if (postsToSync.length > 0) {
        usePostsStore.getState().setPosts(postsToSync, currentUserId);
      }

      if (reset) {
        setActivities(newActivities);
        setPage(2);
        setFollowingCount(metadata.userConnections?.followingCount || 0);
        syncActivitiesFromFeed(newActivities);
      } else {
        setActivities(prev => [...prev, ...newActivities]);
        setPage(prev => prev + 1);
        syncActivitiesFromFeed(newActivities);
      }

      setHasMore(response.data.hasMore || false);

    } catch (err) {
      console.error('❌ [ActivityFeedContainer] Error:', err.response?.data || err.message);
      
      // Handle authentication errors gracefully
      if (err.response?.status === 401) {
        console.log('🔄 [ActivityFeedContainer] Authentication error - user may need to re-login');
        setError(null); // Don't show error for auth issues
        setActivities([]); // Clear activities
      } else {
        setError(err.response?.data?.message || 'Failed to load activities');
        
        if (activities.length === 0) {
          setError('Unable to load activities. Please try again.');
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    console.log('🔄 ActivityFeedContainer: Pull-to-refresh triggered');
    if (externalOnRefresh) {
      await externalOnRefresh();
    } else {
      await fetchPage(1, true);
    }
  }, [externalOnRefresh]);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore && activities.length > 0) {
      fetchPage(page);
    }
  }, [loading, hasMore, activities.length, page]);

  const handlePostCreated = useCallback((postData) => {
    console.log('🎉 Post created, refreshing feed:', postData);
    // Refresh the feed to show the new post
    if (currentUserId) {
      fetchPage(1, true);
    }
  }, [currentUserId]);

  const handleActivityLike = useCallback((postId, isLiked, likeCount) => {
    // Update the activity in the activities array
    setActivities(prev => prev.map(activity => {
      if (activity._id === postId) {
        return {
          ...activity,
          userLiked: isLiked,
          likeCount: likeCount,
          likes: isLiked 
            ? [...(activity.likes || []), currentUserId].filter(Boolean)
            : (activity.likes || []).filter(id => String(id) !== String(currentUserId))
        };
      }
      return activity;
    }));
  }, [currentUserId]);

  // Handle activity actions (friend requests, event invitations, etc.)
  const handleActivityActionPress = useCallback(async (activityId, action, actionData = {}) => {
    try {
      console.log(`🎯 ActivityFeedContainer: Handling action ${action} for activity ${activityId}`);
      
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
      console.error('❌ ActivityFeedContainer: Action error:', error);
      Alert.alert('Error', error.message || 'Failed to complete action');
    }
  }, [handleActivityAction]);

  const handleScroll = useCallback((event) => {
    // Pass scroll event to parent for header hiding
    if (parentOnScroll) {
      parentOnScroll(event);
    }
  }, [parentOnScroll]);

  // Show authentication error if no currentUserId
  if (!currentUserId) {
    console.warn('⚠️ ActivityFeedContainer: No currentUserId available - user may not be logged in');
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

  return (
    <ActivityList
      navigation={navigation}
      activities={activities}
      loading={loading}
      refreshing={refreshing || externalRefreshing}
      onRefresh={handleRefresh}
      onScroll={handleScroll}
      onLoadMore={handleLoadMore}
      onActivityAction={handleActivityActionPress}
      onActivityLike={handleActivityLike}
      friendsCount={followingCount}
      currentUserId={currentUserId}
      scrollEventThrottle={scrollEventThrottle}
      ListHeaderComponent={<PostComposer navigation={navigation} onPostCreated={handlePostCreated} debugValues={debugValues} />}
      debugValues={debugValues}
    />
  );
});

const styles = StyleSheet.create({
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

ActivityFeedContainer.displayName = 'ActivityFeedContainer';

export default ActivityFeedContainer;
