// components/AttendingEventsFeed.js - Events user is attending (not hosting/cohosting)
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

export default function AttendingEventsFeed({
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
      if (isRefresh) {
        setPage(1);
        setHasMore(true);
        setError(null);
      }

      setLoading(pageNum === 1);

      // Fetch user profile to get attending events
      const userResponse = await api.get(`/api/profile/${userId}`);
      const user = userResponse.data;

      // Filter attending events to only include:
      // 1. Upcoming events (future dates)
      // 2. Events where user is NOT the host
      // 3. Events where user is NOT a cohost
      const attendingEvents = (user.attendingEvents || []).filter(event => {
        // Must be upcoming
        if (new Date(event.time) <= new Date()) return false;

        // Must not be the main host
        if (String(event.host._id || event.host) === String(userId)) return false;

        // Must not be a cohost
        const isCohost = event.coHosts?.some(cohost => 
          String(cohost._id || cohost) === String(userId)
        );
        if (isCohost) return false;

        return true;
      });

      // Sort by date (upcoming first)
      attendingEvents.sort((a, b) => new Date(a.time) - new Date(b.time));

      // Handle pagination (slice for current page)
      const startIndex = pageNum === 1 ? 0 : (pageNum - 1) * 20;
      const endIndex = startIndex + 20;
      const paginatedEvents = attendingEvents.slice(startIndex, endIndex);

      if (pageNum === 1) {
        setEvents(paginatedEvents);
        
        // Update event store cache if enabled
        if (enableStore && updateFeedCache) {
          updateFeedCache('attending', paginatedEvents, true);
        }
      } else {
        setEvents(prev => [...prev, ...paginatedEvents]);
      }

      // Update pagination
      setHasMore(endIndex < attendingEvents.length);
      setPage(pageNum);

      // Add individual events to store if enabled
      if (enableStore && addEvent) {
        paginatedEvents.forEach(event => addEvent(event, userId));
      }

      console.log(`✅ Attending events fetched: ${paginatedEvents.length} events (total ${attendingEvents.length} attending)`);

    } catch (error) {
      console.error('Attending events fetch error:', error);
      setError('Failed to load attending events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    console.log('🔄 AttendingEventsFeed: Pull-to-refresh triggered');
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

  const handleLeaveEvent = async (event) => {
    Alert.alert(
      'Leave Event',
      `Are you sure you want to leave "${event.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Leave', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/events/attend/${event._id}`);
              // ✅ IMPROVED: Force refresh to get updated data immediately
              await fetchEvents(1, true);
            } catch (error) {
              console.error('Leave event error:', error);
              Alert.alert('Error', 'Failed to leave event');
            }
          }
        }
      ]
    );
  };

  const handleEventPress = (event) => {
    navigation.navigate('EventDetailsScreen', { 
      eventId: event._id,
      event: event 
    });
  };

  const renderEventItem = ({ item }) => {
    return (
      <View style={styles.eventWrapper}>
        <EventCard 
          event={item}
          currentUserId={userId}
          navigation={navigation}
          onAttend={() => handleLeaveEvent(item)} // Show leave option for attending events
          onPress={() => handleEventPress(item)}
          showAttendingBadge={true}
          attendeeActionLabel="Leave"
          attendeeActionStyle="destructive"
        />
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="checkmark-circle-outline" size={64} color="#C7C7CC" />
      </View>
      <Text style={styles.emptyTitle}>No Upcoming Events</Text>
      <Text style={styles.emptySubtitle}>
        Events you're attending will appear here.
      </Text>
      <TouchableOpacity 
        style={styles.discoverButton}
        onPress={() => navigation.navigate('SearchScreen')}
        activeOpacity={0.8}
      >
        <Ionicons name="search" size={20} color="#FFFFFF" />
        <Text style={styles.discoverButtonText}>Discover Events</Text>
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
        <Text style={styles.loadingText}>Loading attending events...</Text>
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
      contentInset={{ top: 20 }}
      scrollIndicatorInsets={{ top: 20 }}
      bounces={true}
      alwaysBounceVertical={true}
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
    paddingBottom: 100,  // ✅ CHANGED: Increased from 20 to 100 to prevent bottom clipping
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
  discoverButton: {
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
  discoverButtonText: {
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