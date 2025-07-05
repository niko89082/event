// SocialApp/components/PostsFeed.js - Enhanced with scroll event handling for animated header
import React, { useEffect, useState, useContext, forwardRef, useImperativeHandle, useCallback } from 'react';
import {
  View, FlatList, ActivityIndicator, StyleSheet, RefreshControl, Text, TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import PostItem from './PostItem';
import { AuthContext } from '../services/AuthContext';

const PostsFeed = forwardRef(({ 
  navigation, 
  refreshing: externalRefreshing, 
  onRefresh: externalOnRefresh,
  onScroll: parentOnScroll,
  scrollEventThrottle = 16 
}, ref) => {
  const { currentUser } = useContext(AuthContext);

  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => { 
    fetchPage(1); 
  }, []);

  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refresh: async () => {
      console.log('🔄 PostsFeed: Manual refresh triggered');
      return await fetchPage(1, true);
    }
  }));

  const fetchPage = async (pageNum, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      } else if (pageNum === 1) {
        setLoading(true);
        setError(null);
      }

      console.log('🟡 [PostsFeed] fetching page', pageNum);
      
      const res = await api.get(`/api/feed/posts?page=${pageNum}&limit=12`);
      console.log('🟢 PostsFeed response:', res.status, 'posts:', res.data.posts?.length);

      const posts = res.data.posts || [];
      const debug = res.data.debug || {};

      if (pageNum === 1) {
        setData(posts);
        setDebugInfo(debug);
      } else {
        setData(prev => [...prev, ...posts]);
      }
      
      setPage(res.data.page || pageNum);
      setTotalPages(res.data.totalPages || 1);
      setHasMore(res.data.hasMore || false);
      
    } catch (error) {
      console.log('❌ [PostsFeed] error:', error.response?.data || error.message);
      setError(error.response?.data?.message || 'Failed to load posts');
      if (pageNum === 1) {
        setData([]);
        setDebugInfo(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore && page < totalPages) {
      console.log('📄 Loading more posts, page:', page + 1);
      fetchPage(page + 1);
    }
  };

  const handleRefresh = async () => {
    if (externalOnRefresh) {
      await externalOnRefresh();
    } else {
      await fetchPage(1, true);
    }
  };

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

  const renderPost = ({ item }) => (
    <View style={styles.postWrapper}>
      <PostItem
        post={item}
        navigation={navigation}
        onDelete={handleDeletePost}
        currentUserId={currentUser?._id}
      />
    </View>
  );

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
              : "Follow some people or attend events to see posts from other attendees"
          }
        </Text>
        {debugInfo?.friendsCount === 0 && (
          <TouchableOpacity 
            style={styles.discoverButton}
            onPress={() => navigation.navigate('SearchScreen')}
          >
            <Text style={styles.discoverButtonText}>Discover People</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading && page === 1) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading posts...</Text>
      </View>
    );
  }

  if (error && data.length === 0) {
    return renderError();
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={item => item._id}
        renderItem={renderPost}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing || externalRefreshing || false}
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={data.length === 0 ? styles.emptyList : styles.listContent}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={() => {
          if (loading && page > 1) {
            return (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color="#3797EF" />
                <Text style={styles.loadingMoreText}>Loading more posts...</Text>
              </View>
            );
          }
          return null;
        }}
        // Enhanced props for better performance and UX
        bounces={true}
        alwaysBounceVertical={true}
        removeClippedSubviews={true}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={10}
        getItemLayout={null} // Let FlatList calculate this for variable heights
      />
    </View>
  );
});

export default PostsFeed;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  postWrapper: {
    marginBottom: 0, // PostItem handles its own margin
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#FFFFFF',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
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
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  discoverButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  discoverButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyList: {
    flexGrow: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
});