// SocialApp/components/PostsFeed.js - Complete file updated for swipe functionality
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
      ListFooterComponent={renderFooter}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.1}
      contentContainerStyle={data.length === 0 ? styles.emptyContentContainer : styles.contentContainer}
      removeClippedSubviews={true}
      maxToRenderPerBatch={5}
      updateCellsBatchingPeriod={50}
      initialNumToRender={8}
      windowSize={10}
    />
  );
});

const styles = StyleSheet.create({
  // Loading states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },

  // Content containers
  contentContainer: {
    paddingBottom: 20,
  },
  emptyContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  // Post wrapper
  postWrapper: {
    marginBottom: 16,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  actionButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Error state
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
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

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
});

export default PostsFeed;