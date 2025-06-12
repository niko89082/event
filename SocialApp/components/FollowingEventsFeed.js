// components/FollowingEventsFeed.js - NEW following events feed
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import EventCard from './EventCard';

export default function FollowingEventsFeed({ navigation, currentUserId }) {
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

  const handleRefresh = () => {
    fetchEvents(1, true);
  };

  const renderEvent = ({ item }) => (
    <View style={styles.eventWrapper}>
      <EventCard
        event={item}
        currentUserId={currentUserId}
        navigation={navigation}
        onAttend={handleAttend}
        compact={false}
      />
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="people-outline" size={64} color="#C7C7CC" />
      </View>
      <Text style={styles.emptyTitle}>No events from friends</Text>
      <Text style={styles.emptySubtitle}>
        Follow more people to see their events here
      </Text>
      <TouchableOpacity
        style={styles.findFriendsButton}
        onPress={() => navigation.navigate('SearchScreen')}
        activeOpacity={0.8}
      >
        <Ionicons name="search" size={20} color="#FFFFFF" />
        <Text style={styles.findFriendsButtonText}>Find Friends</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && events.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    );
  }

  if (events.length === 0 && !loading) {
    return renderEmptyState();
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={item => item._id}
        renderItem={renderEvent}
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
        contentContainerStyle={styles.listContent}
        numColumns={2}
        columnWrapperStyle={styles.row}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  listContent: {
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  eventWrapper: {
    width: '48%',
    marginBottom: 16,
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  findFriendsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  findFriendsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});