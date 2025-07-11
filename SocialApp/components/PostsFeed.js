// SocialApp/components/PostsFeed.js - FIXED: No more scrollable header overlap
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

  const renderPost = useCallback(({ item }) => (
    <View style={styles.postWrapper}>
      <PostItem 
        post={item} 
        navigation={navigation}
        onLike={(postId, liked) => {
          setData(prev => prev.map(post =>
            post._id === postId ? { ...post, liked, likesCount: post.likesCount + (liked ? 1 : -1) } : post
          ));
        }}
      />
    </View>
  ), [navigation]);

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
      // FIXED: Use contentContainerStyle with paddingTop instead of contentInset
      // This creates non-scrollable padding that positions content correctly from the start
      style={styles.feedContainer}
      // MODERN: Content flows naturally under transparent headers
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
  // FIXED: Container with proper top padding
  feedContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  
  list: {
    paddingTop: 114, // MOVED UP: 10px higher (was 124)
    paddingBottom: 20,
    backgroundColor: 'transparent',
  },
  
  emptyList: {
    flexGrow: 1,
    paddingTop: 114, // MOVED UP: 10px higher (was 124)
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
    paddingTop: 250, // Account for headers
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
    paddingTop: 250, // Account for headers
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
    paddingTop: 250, // Account for headers
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