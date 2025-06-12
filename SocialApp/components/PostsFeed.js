// components/EnhancedPostsFeed.js - NEW enhanced posts feed
import React, { useEffect, useState, useContext, forwardRef, useImperativeHandle } from 'react';
import {
  View, FlatList, ActivityIndicator, StyleSheet, RefreshControl, Text,
} from 'react-native';
import api from '../services/api';
import PostItem from './PostItem';
import { AuthContext } from '../services/AuthContext';

const EnhancedPostsFeed = forwardRef(({ navigation, refreshing: externalRefreshing, onRefresh: externalOnRefresh }, ref) => {
  const { currentUser } = useContext(AuthContext);
  const uid = currentUser?._id;

  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => { 
    fetchPage(1); 
  }, []);

  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refresh: () => fetchPage(1, true)
  }));

  const fetchPage = async (pageNum, isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      console.log('🟡 [EnhancedPostsFeed] fetching page', pageNum);
      
      const res = await api.get(`/api/feed/posts?page=${pageNum}&limit=12`);
      console.log('🟢 EnhancedPostsFeed response:', res.status, 'posts:', res.data.posts?.length);

      const posts = res.data.posts || [];

      if (pageNum === 1) {
        setData(posts);
      } else {
        setData(prev => [...prev, ...posts]);
      }
      
      setPage(res.data.page || pageNum);
      setTotalPages(res.data.totalPages || 1);
      setHasMore(res.data.hasMore || false);
      
    } catch (error) {
      console.log('❌ [EnhancedPostsFeed] error:', error.response?.data || error.message);
      if (pageNum === 1) setData([]);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
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
        // Pass event context props
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

  const handleRefresh = () => {
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

  if (data.length === 0 && !loading) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No posts yet</Text>
        <Text style={styles.emptySubtitle}>
          Follow some people to see their posts here, or attend events to see posts from other attendees
        </Text>
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
            refreshing={refreshing || externalRefreshing}
            onRefresh={handleRefresh}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={data.length === 0 ? styles.emptyList : styles.listContent}
      />
    </View>
  );
});

export default EnhancedPostsFeed;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  postWrapper: {
    marginBottom: 0, // PostItem already has margin
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyList: {
    flexGrow: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
});