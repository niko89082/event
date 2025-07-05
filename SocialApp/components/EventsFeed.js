// components/EventsFeed.js - FIXED: Use correct API endpoint for discover events
import React, { useEffect, useState, useContext, forwardRef, useImperativeHandle } from 'react';
import {
  View, FlatList, ActivityIndicator, StyleSheet, RefreshControl, Text,
} from 'react-native';
import api from '../services/api';
import EventCard from './EventCard';
import { AuthContext } from '../services/AuthContext';

const EventsFeed = forwardRef(({ navigation, refreshing: externalRefreshing, onRefresh: externalOnRefresh, feedType = "discover" }, ref) => {
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
    refresh: async () => {
      console.log('🔄 EventsFeed: Manual refresh triggered');
      return await fetchPage(1, true);
    }
  }));

  const fetchPage = async (pageNum, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (pageNum === 1) {
        setLoading(true);
      }

      console.log('🟡 [EventsFeed] fetching page', pageNum);
      
      // FIXED: Use /api/events with discovery parameters instead of /api/feed
      const res = await api.get(`/api/events?page=${pageNum}&limit=12&discover=true`);
      console.log('🟢 EventsFeed response:', res.status, 'events:', res.data.events?.length);

      const events = res.data.events || res.data || [];
      console.log('🟡 Events loaded:', events.length);

      if (pageNum === 1) {
        setData(events);
      } else {
        setData(prev => [...prev, ...events]);
      }
      
      setPage(res.data.page || pageNum);
      setTotalPages(res.data.totalPages || Math.ceil((res.data.total || events.length) / 12));
      setHasMore(res.data.hasMore || (pageNum * 12 < (res.data.total || events.length)));
      
    } catch (error) {
      console.log('❌ [EventsFeed] error:', error.response?.data || error.message);
      if (pageNum === 1) setData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAttend = async (event) => {
    try {
      await api.post(`/api/events/attend/${event._id}`);
      fetchPage(1, true); // Refresh to show updated attendance
    } catch (error) {
      console.error('Attend event error:', error);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loading && page < totalPages) {
      fetchPage(page + 1);
    }
  };

  const renderEvent = ({ item }) => (
    <EventCard 
      event={item}
      currentUserId={uid}
      navigation={navigation}
      onAttend={handleAttend}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No Events Found</Text>
      <Text style={styles.emptySubtitle}>
        Check back later for new events to discover.
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loading || page === 1) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#3797EF" />
      </View>
    );
  };

  if (loading && page === 1) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Discovering events...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      renderItem={renderEvent}
      keyExtractor={item => item._id}
      // NO numColumns for vertical layout
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing || externalRefreshing}
          onRefresh={externalOnRefresh || (() => fetchPage(1, true))}
          tintColor="#3797EF"
          colors={["#3797EF"]}
        />
      }
      ListEmptyComponent={renderEmptyState}
      ListFooterComponent={renderFooter}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.1}
      contentContainerStyle={data.length === 0 ? styles.emptyContainer : styles.container}
    />
  );
});

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default EventsFeed;