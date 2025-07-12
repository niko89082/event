// SocialApp/components/PostsFeed.js - FIXED: Pass currentUserId to PostItem
import React, { useState, useEffect, useCallback, useContext, forwardRef, useImperativeHandle } from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import PostItem from './PostItem';

const PostsFeed = forwardRef(({
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

  // ✅ CRITICAL FIX: Extract currentUserId and validate
  const currentUserId = currentUser?._id;
  
  // ✅ DEBUG: Log currentUserId state
  console.log('🎯 PostsFeed: currentUserId extracted:', {
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
      console.log('🔄 PostsFeed: Manual refresh triggered');
      return await fetchPage(1, true);
    }
  }));

  const fetchPage = async (pageNum, reset = false) => {
    if (loading) return;

    try {
      setLoading(true);
      setError(null);

      console.log(`🟡 [PostsFeed] Fetching page ${pageNum}, reset: ${reset}`);

      const response = await api.get('/api/feed/posts', {
        params: { page: pageNum, limit: 10 },
      });

      const newPosts = response.data.posts || [];
      const debug = response.data.debug || null;

      console.log(`🟢 [PostsFeed] Received ${newPosts.length} posts:`, {
        regularPosts: debug?.regularPosts || 0,
        memoryPosts: debug?.memoryPosts || 0,
        total: debug?.totalPosts || 0,
      });

      const memoryPosts = newPosts.filter(post => post.postType === 'memory');
      if (memoryPosts.length > 0) {
        console.log(`🧠 [PostsFeed] Memory posts received:`, memoryPosts.map(p => ({
          id: p._id,
          memoryTitle: p.memoryInfo?.memoryTitle,
          uploader: p.user?.username,
          url: p.url
        })));
      }

      if (reset) {
        setData(newPosts);
        setPage(2);
      } else {
        setData(prev => [...prev, ...newPosts]);
        setPage(prev => prev + 1);
      }

      setHasMore(response.data.hasMore || false);
      setDebugInfo(debug);

    } catch (err) {
      console.error('❌ [PostsFeed] Error:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Failed to load posts');
      
      if (data.length === 0) {
        setError('Unable to load posts. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    console.log('🔄 PostsFeed: Refresh requested');
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

  // ✅ CRITICAL FIX: Pass currentUserId to PostItem and add debugging
  const renderPost = useCallback(({ item }) => {
    console.log('🎯 PostsFeed: Rendering post with currentUserId:', {
      postId: item._id,
      currentUserId: currentUserId,
      hasCurrentUserId: !!currentUserId
    });
    
    return (
      <View style={styles.postWrapper}>
        <PostItem 
          post={item} 
          currentUserId={currentUserId} // ✅ CRITICAL: Pass currentUserId
          navigation={navigation}
          onLike={(postId, liked) => {
            setData(prev => prev.map(post =>
              post._id === postId ? { ...post, liked, likesCount: post.likesCount + (liked ? 1 : -1) } : post
            ));
          }}
          // ✅ ENHANCED: Add post update callback
          onPostUpdate={(postId, updates) => {
            console.log('📊 PostsFeed: Updating post', { postId, updates });
            setData(prev => prev.map(post =>
              post._id === postId ? { ...post, ...updates } : post
            ));
          }}
        />
      </View>
    );
  }, [navigation, currentUserId]); // ✅ Add currentUserId as dependency

  const renderFooter = () => {
    if (!loading || data.length === 0) return null;
    
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#3797EF" />
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
    console.warn('⚠️ PostsFeed: No currentUserId available - user may not be logged in');
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="person-outline" size={48} color="#FF6B6B" />
        <Text style={styles.errorTitle}>Authentication Required</Text>
        <Text style={styles.errorMessage}>Please log in to view posts</Text>
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
        <Text style={styles.loadingText}>Loading posts...</Text>
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
        <Ionicons name="camera-outline" size={48} color="#8E8E93" />
        <Text style={styles.emptyTitle}>No Posts Yet</Text>
        <Text style={styles.emptySubtitle}>Follow some friends or create your first post to get started!</Text>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('CreatePostScreen')}
        >
          <Text style={styles.actionButtonText}>Create Post</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      ref={ref}
      data={data}
      keyExtractor={(item) => item._id}
      renderItem={renderPost}
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
      contentContainerStyle={data.length === 0 ? styles.emptyList : styles.list}
      style={styles.feedContainer}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustContentInsets={false}
      removeClippedSubviews={true}
      maxToRenderPerBatch={5}
      windowSize={10}
      initialNumToRender={3}
    />
  );
});

const styles = StyleSheet.create({
  // Container with proper top padding
  feedContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  
  list: {
    paddingTop: 114, // Account for headers
    paddingBottom: 20,
    backgroundColor: 'transparent',
  },
  
  emptyList: {
    flexGrow: 1,
    paddingTop: 114,
    backgroundColor: 'transparent',
  },
  
  postWrapper: {
    marginBottom: 0,
    backgroundColor: 'transparent',
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: 'transparent',
    paddingTop: 250,
  },
  
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
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
  
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
    backgroundColor: 'transparent',
    paddingTop: 250,
  },
  
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  
  actionButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});

export default PostsFeed;