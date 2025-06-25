// SocialApp/components/PostsFeed.js - FIXED: Proper pull-to-refresh implementation
import React, { useEffect, useState, useContext, forwardRef, useImperativeHandle } from 'react';
import {
  View, FlatList, ActivityIndicator, StyleSheet, RefreshControl, Text, TouchableOpacity, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import PostItem from './PostItem';
import { AuthContext } from '../services/AuthContext';

const PostsFeed = forwardRef(({ navigation, refreshing: externalRefreshing, onRefresh: externalOnRefresh }, ref) => {
  const { currentUser } = useContext(AuthContext);
  const uid = currentUser?._id;

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

  // ENHANCED: Expose refresh method to parent with better async handling
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

  const handleDeletePost = () => {
    fetchPage(1, true);
  };

  const renderPost = ({ item }) => (
    <View style={styles.postWrapper}>
      <PostItem  
        post={item} 
        currentUserId={uid} 
        navigation={navigation}
        onDeletePost={handleDeletePost}
        showEventContext={item.source === 'event_attendee'}
        eventContextSource={item.source}
      />
    </View>
  );

  const handleLoadMore = () => {
    if (hasMore && !loading && page < totalPages) {
      fetchPage(page + 1);
    }
  };

  // FIXED: Enhanced refresh handler that works with both internal and external refresh
  const handleRefresh = async () => {
    console.log('🔄 PostsFeed: Pull-to-refresh triggered');
    
    if (externalOnRefresh) {
      // If parent provides refresh handler, use it
      await externalOnRefresh();
    } else {
      // Otherwise use internal refresh
      await fetchPage(1, true);
    }
  };

  const handleRetry = () => {
    setError(null);
    fetchPage(1, true);
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
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (data.length === 0 && !loading) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="images-outline" size={64} color="#C7C7CC" />
        <Text style={styles.emptyTitle}>No posts yet</Text>
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={data.length === 0 ? styles.emptyList : styles.listContent}
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
        // FIXED: Important props for better refresh experience
        bounces={true}
        alwaysBounceVertical={true}
        scrollEventThrottle={16}
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