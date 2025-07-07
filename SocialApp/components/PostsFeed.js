// components/PostsFeed.js - PHASE 2: Updated to handle memory posts
import React, { useState, useEffect, useCallback, useContext } from 'react';
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
import PostItem from './PostItem'; // Updated PostItem with memory support

export default function PostsFeed({
  navigation,
  refreshing: externalRefreshing = false,
  onScroll: parentOnScroll,
  scrollEventThrottle = 16,
}) {
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

      // 🧠 PHASE 2: Log memory posts for debugging
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
      
      // Don't show error if we have some data already
      if (data.length === 0) {
        setError('Unable to load posts. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPage(1, true);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchPage(page);
    }
  }, [hasMore, loading, page]);

  const handleDeletePost = () => {
    fetchPage(1, true);
  };

  // Enhanced scroll handler that combines internal logic with parent callback
  const handleScroll = useCallback((event) => {
    // Call parent's scroll handler for header animation
    if (parentOnScroll) {
      parentOnScroll(event);
    }
    
    // Add any internal scroll logic here if needed
  }, [parentOnScroll]);

  // 🧠 PHASE 2: Enhanced renderPost to handle memory posts
  const renderPost = ({ item }) => {
    const isMemoryPost = item.postType === 'memory';
    
    console.log(`🔍 [PostsFeed] Rendering ${isMemoryPost ? 'memory' : 'regular'} post:`, {
      id: item._id,
      type: item.postType,
      user: item.user?.username,
      memoryTitle: isMemoryPost ? item.memoryInfo?.memoryTitle : null,
      url: item.url || item.paths?.[0]
    });

    return (
      <View style={styles.postWrapper}>
        <PostItem
          post={item}
          navigation={navigation}
          onDeletePost={handleDeletePost}
          currentUserId={currentUser?._id}
          // 🧠 PHASE 2: Pass memory-specific props
          showEventContext={!isMemoryPost} // Hide event context for memory posts
          eventContextSource={item.source}
        />
      </View>
    );
  };

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="cloud-offline-outline" size={64} color="#8E8E93" />
      <Text style={styles.errorTitle}>Connection Error</Text>
      <Text style={styles.errorMessage}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={() => fetchPage(1, true)}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmpty = () => {
    if (loading && page === 1) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="camera-outline" size={64} color="#8E8E93" />
        <Text style={styles.emptyTitle}>No Posts Yet</Text>
        <Text style={styles.emptySubtitle}>
          {debugInfo?.friendsCount === 0 
            ? "Follow some people to see their posts here"
            : debugInfo?.fallbackUsed 
              ? "Your friends haven't posted yet, but here are some trending posts!"
              : "Start following friends or create your first post!"
          }
        </Text>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('SearchScreen')}
        >
          <Text style={styles.actionButtonText}>
            {debugInfo?.friendsCount === 0 ? 'Find People' : 'Explore'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loading || page === 1) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#3797EF" />
        <Text style={styles.loadingText}>Loading more posts...</Text>
      </View>
    );
  };

  // 🧠 PHASE 2: Debug footer to show memory post stats
  const renderDebugFooter = () => {
    if (!debugInfo || !__DEV__) return null;
    
    return (
      <View style={styles.debugFooter}>
        <Text style={styles.debugText}>
          📊 Posts: {data.length} | Regular: {debugInfo.regularPosts} | Memory: {debugInfo.memoryPosts}
        </Text>
        <Text style={styles.debugText}>
          👥 Following: {debugInfo.followingCount} | Memories: {debugInfo.userMemoryCount}
        </Text>
      </View>
    );
  };

  // Show error state if there's an error
  if (error && data.length === 0) {
    return renderError();
  }

  // Show loading state on initial load
  if (loading && page === 1 && data.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading posts...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      renderItem={renderPost}
      keyExtractor={item => item._id}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing || externalRefreshing}
          onRefresh={handleRefresh}
          tintColor="#3797EF"
          colors={["#3797EF"]}
          title="Pull to refresh posts"
          titleColor="#8E8E93"
          progressBackgroundColor="#FFFFFF"
        />
      }
      onScroll={handleScroll}
      scrollEventThrottle={scrollEventThrottle}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={
        <View>
          {renderFooter()}
          {renderDebugFooter()}
        </View>
      }
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.1}
      contentContainerStyle={data.length === 0 ? styles.emptyList : styles.list}
      removeClippedSubviews={true}
      maxToRenderPerBatch={5}
      windowSize={10}
      initialNumToRender={3}
      getItemLayout={(data, index) => ({
        length: 500, // Approximate post height
        offset: 500 * index,
        index,
      })}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: 20,
  },
  emptyList: {
    flexGrow: 1,
  },
  postWrapper: {
    marginBottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
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
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  
  // 🧠 PHASE 2: Debug styles
  debugFooter: {
    backgroundColor: '#F8F9FA',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#E1E1E1',
  },
  debugText: {
    fontSize: 11,
    color: '#6C757D',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});