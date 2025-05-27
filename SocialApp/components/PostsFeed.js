// components/PostsFeed.js
import React, { useEffect, useState, useContext } from 'react';
import {
  View, FlatList, ActivityIndicator, StyleSheet, RefreshControl, Text,
} from 'react-native';
import api             from '../services/api';
import PostItem        from './PostItem';
import { AuthContext } from '../services/AuthContext';

export default function PostsFeed({ navigation }) {
  const { currentUser } = useContext(AuthContext);
  const uid             = currentUser?._id;

  const [data, setData]         = useState([]);
  const [page, setPage]         = useState(1);
  const [pages, setPages]       = useState(1);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { 
    fetchPage(1); 
  }, []);

  const fetchPage = async (pageNum, isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      console.log('🟡 [PostsFeed] fetching page', pageNum);
      
      const res = await api.get(`/api/feed?page=${pageNum}&limit=12`);
      console.log('🟢 PostsFeed response:', res.status, 'items:', res.data.feed?.length);

      // Filter only posts (items with uploadDate)
      const posts = (res.data.feed || []).filter(item => item.uploadDate);
      console.log('🟡 Filtered posts:', posts.length);

      if (pageNum === 1) {
        setData(posts);
      } else {
        setData(prev => [...prev, ...posts]);
      }
      
      setPage(res.data.page || pageNum);
      setPages(res.data.totalPages || 1);
      
    } catch (error) {
      console.log('❌ [PostsFeed] error:', error.response?.data || error.message);
      if (pageNum === 1) setData([]);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  };

  const handleDeletePost = () => {
    fetchPage(1, true);
  };

  const renderPost = ({ item }) => (
    <PostItem  
      post={item} 
      currentUserId={uid} 
      navigation={navigation}
      onDeletePost={handleDeletePost}
    />
  );

  const handleLoadMore = () => {
    if (page < pages && !loading) {
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
          Follow some people to see their posts here
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
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={data.length === 0 ? styles.emptyList : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
});