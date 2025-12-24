// SocialApp/components/FollowingEventsFeed.js - FIXED: Now includes cohosted events in Friends tab
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import EventCard from './EventCard';

export default function FollowingEventsFeed({ 
  navigation, 
  currentUserId, 
  refreshing: externalRefreshing, 
  onRefresh: externalOnRefresh,
  onScroll: parentOnScroll,
  scrollEventThrottle = 16,
  activeTab // ✅ NEW: Know when this tab is visible
}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false); // ✅ Track if we've loaded once

  // ✅ IMPROVED: Only fetch on mount or when tab becomes active for first time
  useEffect(() => {
    if (activeTab === 'following' && !hasInitiallyLoaded) {
      console.log('📱 FollowingEventsFeed: Initial load (tab is active)');
      fetchEvents(1);
      setHasInitiallyLoaded(true);
    }
  }, [activeTab, hasInitiallyLoaded]);

  const fetchEvents = async (pageNum, isRefresh = false) => {
  try {
    console.log('🔥🔥🔥 FRONTEND: Starting fetchEvents 🔥🔥🔥');
    console.log('🔥 pageNum:', pageNum, 'isRefresh:', isRefresh);
    
    if (isRefresh) {
      setRefreshing(true);
    } else if (pageNum === 1) {
      setLoading(true);
    }

    // STEP 1: Test the debug endpoint first
    console.log('🔥 CALLING DEBUG ENDPOINT...');
    try {
      const debugResponse = await api.get('/api/events/debug-friends');
      console.log('🔥 DEBUG RESPONSE:', debugResponse.data);
    } catch (debugError) {
      console.log('🔥 DEBUG ENDPOINT ERROR:', debugError.message);
    }

    // STEP 2: Call the main endpoints
    console.log('🔥 CALLING MAIN ENDPOINTS...');
    
    const [friendsResponse, cohostResponse] = await Promise.all([
      api.get(`/api/events/following-events?page=${pageNum}&limit=12`).then(response => {
        console.log('🔥 FOLLOWING-EVENTS RESPONSE:', response.data);
        return response;
      }).catch(error => {
        console.log('🔥 FOLLOWING-EVENTS ERROR:', error.message);
        return { data: { events: [], page: pageNum, hasMore: false } };
      }),
      
      api.get(`/api/events/cohost-invites?page=${pageNum}&limit=12`).then(response => {
        console.log('🔥 COHOST-INVITES RESPONSE:', response.data);
        return response;
      }).catch(error => {
        console.log('🔥 COHOST-INVITES ERROR:', error.message);
        return { data: { events: [], page: pageNum, hasMore: false } };
      })
    ]);

    const friendsEvents = friendsResponse.data.events || [];
    const cohostEvents = cohostResponse.data.events || [];

    console.log('🔥 EXTRACTED EVENTS:', {
      friendsEvents: friendsEvents.length,
      cohostEvents: cohostEvents.length
    });

    // Combine and deduplicate events
    const eventMap = new Map();
    
    // Add friends' events
    friendsEvents.forEach(event => {
      console.log('🔥 Adding friend event:', event.title);
      eventMap.set(event._id, {
        ...event,
        isFriendsEvent: true,
        isCohostedByMe: false
      });
    });
    
    // Add cohosted events
    cohostEvents.forEach(event => {
      console.log('🔥 Adding cohost event:', event.title);
      const existing = eventMap.get(event._id);
      eventMap.set(event._id, {
        ...event,
        isFriendsEvent: !existing ? true : existing.isFriendsEvent,
        isCohostedByMe: true
      });
    });

    const combinedEvents = Array.from(eventMap.values());
    
    console.log('🔥 FINAL COMBINED EVENTS:', {
      totalUnique: combinedEvents.length,
      eventTitles: combinedEvents.map(e => e.title)
    });
    
    // Sort by event time (nearest first)
    combinedEvents.sort((a, b) => new Date(a.time) - new Date(b.time));
    
    if (pageNum === 1) {
      setEvents(combinedEvents);
    } else {
      setEvents(prev => {
        const prevMap = new Map(prev.map(e => [e._id, e]));
        combinedEvents.forEach(event => {
          prevMap.set(event._id, event);
        });
        return Array.from(prevMap.values()).sort((a, b) => new Date(a.time) - new Date(b.time));
      });
    }
    
    // Use the more restrictive hasMore to avoid infinite loading
    const hasMoreFriends = friendsResponse.data.hasMore || false;
    const hasMoreCohosts = cohostResponse.data.hasMore || false;
    setHasMore(hasMoreFriends || hasMoreCohosts);
    setPage(Math.max(friendsResponse.data.page || pageNum, cohostResponse.data.page || pageNum));

    console.log('✅ FollowingEventsFeed: Combined events loaded', {
      friendsCount: friendsEvents.length,
      cohostsCount: cohostEvents.length,
      totalUnique: combinedEvents.length,
      page: pageNum
    });

  } catch (error) {
    console.error('🔥 MAIN fetchEvents error:', error);
    if (pageNum === 1) setEvents([]);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

  const handleAttend = async (event) => {
    try {
      await api.post(`/api/events/attend/${event._id}`);
      // ✅ IMPROVED: Force refresh to get updated data immediately
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

  // Enhanced scroll handler that combines internal logic with parent callback
  const handleScroll = useCallback((event) => {
    // Call parent's scroll handler for tab bar animation
    if (parentOnScroll) {
      parentOnScroll(event);
    }
    
    // Add any internal scroll logic here if needed
  }, [parentOnScroll]);

  // 🔧 FIX: Enhanced event item with cohost indicator
  const renderEventItem = ({ item }) => (
    <View style={styles.eventWrapper}>
      <EventCard 
        event={item}
        currentUserId={currentUserId}
        navigation={navigation}
        onAttend={handleAttend}
        // 🆕 NEW: Show cohost badge in friends feed
        showFriendsBadge={true}
        friendsContext={{
          isFriendsEvent: item.isFriendsEvent,
          isCohostedByMe: item.isCohostedByMe
        }}
      />
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="people-outline" size={64} color="#C7C7CC" />
      </View>
      <Text style={styles.emptyTitle}>No Events from Friends</Text>
      <Text style={styles.emptySubtitle}>
        When friends create events or add you as a co-host, they'll appear here.
      </Text>
      
      <TouchableOpacity 
        style={styles.createSuggestion}
        onPress={() => navigation.navigate('CreateEventScreen')}
        activeOpacity={0.8}
      >
        <Ionicons name="add-circle" size={18} color="#3797EF" />
        <Text style={styles.createSuggestionText}>Create an event</Text>
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

  if (loading && page === 1) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading events from friends...</Text>
      </View>
    );
  }

  console.log('🔍 FollowingEventsFeed Refresh Debug:', {
    contentPaddingTop: 190,
    subTabPosition: 144,
    subTabHeight: 56,
    expectedRefreshPosition: 144 + 56,
    currentRefreshBehavior: 'appears at scroll container top (wrong)',
    needsContentInset: true
  });

  console.log('🔄 Refresh Distance Debug:', {
    oldContentInset: 200,
    newContentInset: 60,
    contentPadding: 190,
    totalGapBefore: '60 + 190 = 250px (much better than 390px)',
    userExperience: 'Should be much easier to reach refresh'
  });

  return (
    <FlatList
      data={events}
      renderItem={renderEventItem}
      keyExtractor={item => item._id}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing || externalRefreshing}
          onRefresh={() => {
            console.log('🔄 FollowingEventsFeed: Refresh triggered, should appear below sub-tabs');
            handleRefresh();
          }}
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
      contentContainerStyle={events.length === 0 ? 
        { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 0, paddingBottom: 0, minHeight: '100%' } : 
        { paddingTop: 220, paddingBottom: 100 }
      }
      contentInset={{ top: 10 }}
      scrollIndicatorInsets={{ top: 10 }}
      bounces={true}
      alwaysBounceVertical={true}
    />
  );
}

const styles = StyleSheet.create({
  eventWrapper: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,  // ✅ FIXED: Match ActivityScreen - centered
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 0,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F2F2F7',
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
  createSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: 'rgba(55, 151, 239, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(55, 151, 239, 0.3)',
    marginTop: 0,
  },
  createSuggestionText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#3797EF',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});