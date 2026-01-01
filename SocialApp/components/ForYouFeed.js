// components/ForYouFeed.js - "For You" personalized feed with mixed content
import React, { useState, useEffect, useCallback, useContext, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import ActivityList from './ActivityList';
import PostComposer from './PostComposer';

const ForYouFeed = forwardRef(({
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

  // Extract currentUserId and validate
  const currentUserId = currentUser?._id;
  
  console.log('🎯 ForYouFeed: currentUserId extracted:', {
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
      console.log('🔄 ForYouFeed: Manual refresh triggered');
      return await fetchPage(1, true);
    }
  }));

  const fetchPage = async (pageNum, reset = false) => {
    if (loading || !currentUserId) return;

    try {
      setLoading(true);
      setError(null);

      console.log(`🟡 [ForYouFeed] Fetching page ${pageNum}, reset: ${reset}`);

      // Use activity endpoint with for-you parameter, or create new endpoint later
      // For now, use the activity endpoint which includes mixed content
      const response = await api.get('/api/feed/activity', {
        params: { page: pageNum, limit: 15, feedType: 'for-you' },
      });

      const newActivities = response.data.activities || [];
      const metadata = response.data.metadata || {};

      console.log(`🟢 [ForYouFeed] Received ${newActivities.length} activities:`, {
        total: newActivities.length,
        followingCount: metadata.userConnections?.followingCount || 0,
      });

      if (reset) {
        setActivities(newActivities);
        setPage(2);
        setFollowingCount(metadata.userConnections?.followingCount || 0);
      } else {
        setActivities(prev => [...prev, ...newActivities]);
        setPage(prev => prev + 1);
      }

      setHasMore(response.data.hasMore || false);

    } catch (err) {
      console.error('❌ [ForYouFeed] Error:', err.response?.data || err.message);
      
      // Handle authentication errors gracefully
      if (err.response?.status === 401) {
        console.log('🔄 [ForYouFeed] Authentication error - user may need to re-login');
        setError(null);
        setActivities([]);
      } else {
        setError(err.response?.data?.message || 'Failed to load feed');
        
        if (activities.length === 0) {
          setError('Unable to load feed. Please try again.');
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    console.log('🔄 ForYouFeed: Pull-to-refresh triggered');
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
    console.log('🎉 Post created, adding to feed immediately:', postData);
    
    // Transform post data to activity format
    let activityType = 'regular_post';
    if (postData.postType === 'text') {
      activityType = 'text_post';
    } else if (postData.review && postData.review.type) {
      activityType = 'review_post';
    }
    
    const newActivity = {
      ...postData,
      activityType: activityType,
      timestamp: postData.createdAt || postData.uploadDate || new Date().toISOString(),
      user: currentUser, // Ensure user info is included
      userLiked: false,
      likeCount: 0,
      commentCount: 0,
    };
    
    // Immediately prepend the new post to the activities array
    setActivities(prev => [newActivity, ...prev]);
    
    // Optionally refresh in background to get updated counts, but don't wait
    // This gives immediate feedback while ensuring data is fresh
    setTimeout(() => {
      fetchPage(1, true);
    }, 1000);
  }, [currentUser]);

  const handleScroll = useCallback((event) => {
    // Pass scroll event to parent for header hiding
    if (parentOnScroll) {
      parentOnScroll(event);
    }
  }, [parentOnScroll]);

  // Show authentication error if no currentUserId
  if (!currentUserId) {
    console.warn('⚠️ ForYouFeed: No currentUserId available - user may not be logged in');
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="person-outline" size={48} color="#FF6B6B" />
        <Text style={styles.errorTitle}>Authentication Required</Text>
        <Text style={styles.errorMessage}>Please log in to view your feed</Text>
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
      onActivityAction={() => {}}
      friendsCount={followingCount}
      currentUserId={currentUserId}
      scrollEventThrottle={scrollEventThrottle}
      ListHeaderComponent={<PostComposer navigation={navigation} onPostCreated={handlePostCreated} />}
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

ForYouFeed.displayName = 'ForYouFeed';

export default ForYouFeed;

