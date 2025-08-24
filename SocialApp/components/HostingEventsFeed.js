// components/HostingEventsFeed.js - Events user is hosting or cohosting
import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import EventCard from './EventCard';
import api from '../services/api';
import useEventStore from '../stores/eventStore';

export default function HostingEventsFeed({
  navigation,
  currentUserId,
  refreshing: externalRefreshing,
  onRefresh: externalOnRefresh,
  onScroll: parentOnScroll,
  scrollEventThrottle = 16,
  useEventStore: enableStore = true,
  activeTab
}) {
  const { currentUser } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  // Event store integration (if enabled)
  const {
    getFeedCache,
    updateFeedCache,
    addEvent,
    needsRefresh
  } = enableStore ? useEventStore() : {};

  const userId = currentUserId || currentUser?._id;

  useEffect(() => {
    if (userId) {
      fetchEvents(1, true);
    }
  }, [userId]);

const fetchEvents = async (pageNum = 1, isRefresh = false) => {
  if (!userId) return;

  try {
    setLoading(pageNum === 1);
    setError(null);

    console.log(`🔥 HostingEventsFeed: Fetching hosting events for user ${userId}, page ${pageNum}`);

    // ✅ FIX: Use the same multi-source approach as useUserEvents
    const [hostedResponse, userResponse] = await Promise.all([
      // Method 1: Use the working user events endpoint (same as useUserEvents)
      api.get(`/api/users/${userId}/events`, {
        params: {
          type: 'hosted',
          includePast: false,
          limit: 50  // Get all hosted events
        }
      }).catch(error => {
        console.warn('❌ User hosted events fetch failed:', error.message);
        return { data: { events: [] } };
      }),

      // Method 2: Get user profile for cohosted events
      api.get(`/api/profile/${userId}`).catch(error => {
        console.warn('❌ User profile fetch failed:', error.message);
        return { data: { attendingEvents: [] } };
      })
    ]);

    const hostedEvents = hostedResponse.data.events || [];
    const user = userResponse.data;

    console.log(`🎯 HostingEventsFeed Raw Data:`, {
      directHostedEvents: hostedEvents.length,
      userAttendingEvents: user.attendingEvents?.length || 0,
      userId
    });

    // Find events where user is cohosting (in attendingEvents but listed as cohost)
    const cohostEvents = (user.attendingEvents || []).filter(event => {
      // Must be upcoming
      if (new Date(event.time) <= new Date()) return false;

      // Must not be the main host
      if (String(event.host._id || event.host) === String(userId)) return false;

      // Must be listed as cohost
      return event.coHosts?.some(cohost => 
        String(cohost._id || cohost) === String(userId)
      );
    });

    console.log(`🎯 HostingEventsFeed Filtered Data:`, {
      hostedEvents: hostedEvents.length,
      cohostEvents: cohostEvents.length,
      hostedTitles: hostedEvents.map(e => e.title),
      cohostTitles: cohostEvents.map(e => e.title)
    });

    // Combine hosted and cohosted events, remove duplicates
    const allHostingEvents = [...hostedEvents, ...cohostEvents];
    const uniqueEvents = allHostingEvents.filter((event, index, self) => 
      index === self.findIndex(e => e._id === event._id)
    );

    // Sort by date (upcoming first)
    uniqueEvents.sort((a, b) => new Date(a.time) - new Date(b.time));

    console.log(`🎯 HostingEventsFeed Final Events:`, {
      totalUnique: uniqueEvents.length,
      eventTitles: uniqueEvents.map(e => e.title),
      eventIds: uniqueEvents.map(e => e._id)
    });

    if (pageNum === 1) {
      setEvents(uniqueEvents);
      
      // Update event store cache if enabled
      if (enableStore && updateFeedCache) {
        updateFeedCache('hosting', uniqueEvents, true);
      }
    } else {
      setEvents(prev => [...prev, ...uniqueEvents]);
    }

    // Update pagination
    setHasMore(uniqueEvents.length === 20);
    setPage(pageNum);

    // Add individual events to store if enabled
    if (enableStore && addEvent) {
      uniqueEvents.forEach(event => addEvent(event, userId));
    }

    console.log(`✅ HostingEventsFeed: Loaded ${uniqueEvents.length} hosting events (${hostedEvents.length} hosted + ${cohostEvents.length} cohosted)`);

  } catch (error) {
    console.error('❌ HostingEventsFeed fetch error:', error);
    setError('Failed to load hosting events');
    setEvents([]);
  } finally {
    setLoading(false);
  }
};

  const handleRefresh = async () => {
    console.log('🔄 HostingEventsFeed: Pull-to-refresh triggered');
    setRefreshing(true);
    
    try {
      if (externalOnRefresh) {
        await externalOnRefresh();
      } else {
        await fetchEvents(1, true);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore && events.length > 0) {
      fetchEvents(page + 1, false);
    }
  };

  // Enhanced scroll handler that combines internal logic with parent callback
  const handleScroll = useCallback((event) => {
    // Call parent's scroll handler for tab bar animation
    if (parentOnScroll) {
      parentOnScroll(event);
    }
  }, [parentOnScroll]);

  const handleAttend = async (event) => {
    try {
      await api.post(`/api/events/attend/${event._id}`);
      await fetchEvents(1, true); // Refresh to get updated data
    } catch (error) {
      console.error('Attend event error:', error);
      Alert.alert('Error', 'Failed to join event');
    }
  };

  const handleEventPress = (event) => {
    navigation.navigate('EventDetailsScreen', { 
      eventId: event._id,
      event: event 
    });
  };

  const renderEventItem = ({ item }) => {
    // Determine if user is host or cohost
    const isMainHost = String(item.host._id || item.host) === String(userId);
    const isCohost = item.coHosts?.some(cohost => 
      String(cohost._id || cohost) === String(userId)
    );

    return (
      <View style={styles.eventWrapper}>
        <EventCard 
          event={item}
          currentUserId={userId}
          navigation={navigation}
          onAttend={handleAttend}
          onPress={() => handleEventPress(item)}
          showHostingBadge={true}
          hostingType={isMainHost ? 'hosting' : 'cohosting'}
        />
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="star-outline" size={64} color="#C7C7CC" />
      </View>
      <Text style={styles.emptyTitle}>No Hosting Events</Text>
      <Text style={styles.emptySubtitle}>
        Events you create or co-host will appear here.
      </Text>
      <TouchableOpacity 
        style={styles.createButton}
        onPress={() => navigation.navigate('CreateEventScreen')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={20} color="#FFFFFF" />
        <Text style={styles.createButtonText}>Create Event</Text>
      </TouchableOpacity>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="cloud-offline-outline" size={64} color="#C7C7CC" />
      </View>
      <Text style={styles.emptyTitle}>Connection Error</Text>
      <Text style={styles.emptySubtitle}>{error}</Text>
      <TouchableOpacity 
        style={styles.retryButton}
        onPress={() => fetchEvents(1, true)}
        activeOpacity={0.8}
      >
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!loading || page === 1) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#3797EF" />
        <Text style={styles.loadingText}>Loading more events...</Text>
      </View>
    );
  };

  if (error) {
    return renderError();
  }

  if (loading && page === 1) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading hosting events...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={events}
      renderItem={renderEventItem}
      keyExtractor={item => item._id}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing || externalRefreshing}
          onRefresh={handleRefresh}
          tintColor="#3797EF"
          colors={["#3797EF"]}
          title="Pull to refresh events"
          titleColor="#8E8E93"
          progressBackgroundColor="#FFFFFF"
        />
      }
      onScroll={handleScroll}
      scrollEventThrottle={scrollEventThrottle}
      ListEmptyComponent={renderEmptyState}
      ListFooterComponent={renderFooter}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.1}
      contentContainerStyle={events.length === 0 ? styles.emptyContainer : styles.contentContainer}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={10}
      initialNumToRender={8}
    />
  );
}

const styles = StyleSheet.create({
  // ✅ FIXED: Increased paddingTop from 140 to 190 for consistent positioning
  contentContainer: {
    paddingTop: 190,     // ✅ CHANGED: From 140 to 190 to match standard
    paddingBottom: 20,   // ✅ KEEP: Existing bottom padding
  },
  // ✅ FIXED: Also update empty container for consistency
  emptyContainer: {
    flex: 1,
    paddingTop: 190,     // ✅ CHANGED: From 140 to 190 to match standard
  },
  eventWrapper: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  
  // Loading states
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 250,     // ✅ KEEP: Loading states use higher padding (already correct)
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  
  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,      // ✅ KEEP: Relative padding within emptyContainer
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F6F6F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Error state
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,      // ✅ KEEP: Relative padding within container
  },
  retryButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 24,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
});