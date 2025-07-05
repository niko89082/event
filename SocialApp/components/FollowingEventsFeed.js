// components/FollowingEventsFeed.js - FIXED: Correct API endpoint and vertical layout
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import EventCard from './EventCard';

export default function FollowingEventsFeed({ navigation, currentUserId, refreshing: externalRefreshing, onRefresh: externalOnRefresh }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchEvents(1);
  }, []);

  const fetchEvents = async (pageNum, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (pageNum === 1) {
        setLoading(true);
      }

      // FIXED: Correct API endpoint
      const { data } = await api.get(`/api/events/following-events?page=${pageNum}&limit=12`);
      
      if (pageNum === 1) {
        setEvents(data.events || []);
      } else {
        setEvents(prev => [...prev, ...(data.events || [])]);
      }
      
      setPage(data.page || pageNum);
      setHasMore(data.hasMore || false);

    } catch (error) {
      console.error('Following events fetch error:', error);
      if (pageNum === 1) setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAttend = async (event) => {
    try {
      await api.post(`/api/events/attend/${event._id}`);
      // Refresh to show updated attendance
      fetchEvents(1, true);
    } catch (error) {
      console.error('Attend event error:', error);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      fetchEvents(page + 1);
    }
  };

  const handleRefresh = async () => {
    if (externalOnRefresh) {
      await externalOnRefresh();
    } else {
      await fetchEvents(1, true);
    }
  };

  const renderEventItem = ({ item }) => (
    <EventCard 
      event={item}
      currentUserId={currentUserId}
      navigation={navigation}
      onAttend={handleAttend}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="people-outline" size={64} color="#C7C7CC" />
      </View>
      <Text style={styles.emptyTitle}>No Events from Friends</Text>
      <Text style={styles.emptySubtitle}>
        When people you follow create events, they'll appear here.
      </Text>
      <TouchableOpacity 
        style={styles.discoverButton}
        onPress={() => navigation.navigate('SearchScreen')}
        activeOpacity={0.8}
      >
        <Text style={styles.discoverButtonText}>Discover Events</Text>
      </TouchableOpacity>
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
        <Text style={styles.loadingText}>Loading events from friends...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={events}
      renderItem={renderEventItem}
      keyExtractor={item => item._id}
      // FIXED: NO numColumns for vertical layout
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing || externalRefreshing}
          onRefresh={handleRefresh}
          tintColor="#3797EF"
          colors={["#3797EF"]}
        />
      }
      ListEmptyComponent={renderEmptyState}
      ListFooterComponent={renderFooter}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.1}
      contentContainerStyle={events.length === 0 ? styles.emptyContainer : styles.container}
    />
  );
}

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
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
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
  discoverButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  discoverButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});