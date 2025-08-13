// components/EventsFeed.js - FIXED: Use correct feed API endpoints
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import EventCard from './EventCard';
import useEventStore from '../stores/eventStore';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const PAGE_SIZE = 10;

export default function EventsFeed({
  navigation,
  currentUserId,
  feedType = 'discover',
  refreshing: externalRefreshing = false,
  onRefresh: externalOnRefresh,
  onScroll,
  scrollEventThrottle = 16,
  useEventStore: useStoreFlag = true,
  activeTab,
}) {  
  console.log('🔍 EventsFeed component mounted with feedType:', feedType);
  // Centralized store integration
  const {
    getFeedCache,
    updateFeedCache,
    appendToFeedCache,
    syncEventsFromFeed,
    toggleRSVP,
    needsRefresh,
    setLoading: setStoreLoading,
    setError: setStoreError,
    loading: storeLoading,
    error: storeError
  } = useEventStore();

  // Local state
  const [localEvents, setLocalEvents] = useState([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localRefreshing, setLocalRefreshing] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Refs
  const flatListRef = useRef(null);
  const isMounted = useRef(true);
  // Determine data source - use store cache if available and flag is enabled
  const useStore = useStoreFlag && currentUserId;
  const feedCache = useStore ? getFeedCache(feedType) : null;
  const events = useStore && feedCache?.data?.length > 0 ? feedCache.data : localEvents;
  const loading = useStore ? storeLoading : localLoading;
  const refreshing = useStore ? externalRefreshing : localRefreshing;
  const error = useStore ? storeError : localError;

  // Set mounted flag
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // FIXED: Enhanced fetch events with correct API endpoint
  const fetchEvents = useCallback(async (isRefresh = false, pageNum = 1) => {
    if (!isMounted.current) return;

    try {
      // Set loading states
      if (isRefresh) {
        if (useStore) {
          setStoreLoading(true);
        } else {
          setLocalRefreshing(true);
        }
      } else if (pageNum === 1) {
        if (useStore) {
          setStoreLoading(true);
        } else {
          setLocalLoading(true);
        }
      } else {
        setLoadingMore(true);
      }

      // Clear errors
      if (useStore) {
        setStoreError(null);
      } else {
        setLocalError(null);
      }

      // FIXED: Use correct API endpoint based on your routes
      let apiEndpoint;
      let apiParams = {
        page: pageNum,
        limit: PAGE_SIZE,
      };

      // Map feedType to correct API endpoint
      switch (feedType) {
        case 'following':
          apiEndpoint = '/api/feed/events';
          break;
        case 'discover':
        case 'for-you':
        default:
          // Use the events feed endpoint for discover
          apiEndpoint = '/api/feed/events';
          break;
      }

      console.log(`✅ EventsFeed: Using API endpoint: ${apiEndpoint} for feedType: ${feedType}`);

      // API call with correct endpoint
      const response = await api.get(apiEndpoint, {
        params: apiParams
      });

      if (!isMounted.current) return;

      // FIXED: Handle the response format from your feed routes
      const newEvents = response.data.events || [];
      const hasMoreData = response.data.hasMore !== false && newEvents.length === PAGE_SIZE;

      console.log(`✅ EventsFeed: Fetched ${newEvents.length} events for ${feedType}, page ${pageNum}`);

      if (useStore) {
        // Store integration - update cache
        if (isRefresh || pageNum === 1) {
          // Replace cache with fresh data
          updateFeedCache(feedType, newEvents, hasMoreData);
          // Sync with main events store
          syncEventsFromFeed(newEvents, currentUserId);
        } else {
          // Append to existing cache
          appendToFeedCache(feedType, newEvents);
          // Sync new events with main store
          syncEventsFromFeed(newEvents, currentUserId);
        }
      } else {
        // Local state only
        if (isRefresh || pageNum === 1) {
          setLocalEvents(newEvents);
        } else {
          setLocalEvents(prev => [...prev, ...newEvents]);
        }
      }

      setHasMore(hasMoreData);
      setPage(pageNum);

    } catch (error) {
      if (!isMounted.current) return;

      console.error(`❌ EventsFeed error (${feedType}):`, error);
      
      // FIXED: Better error handling for different API responses
      let errorMessage = 'Failed to load events';
      
      if (error.response?.status === 404) {
        errorMessage = 'Feed endpoint not found';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (!error.response) {
        errorMessage = 'Network connection error';
      }
      
      if (useStore) {
        setStoreError(errorMessage);
      } else {
        setLocalError(errorMessage);
      }

      // Show user-friendly error for network issues
      if (!error.response) {
        Alert.alert('Connection Error', 'Please check your internet connection and try again.');
      }
    } finally {
      if (!isMounted.current) return;

      // Clear loading states
      if (useStore) {
        setStoreLoading(false);
      } else {
        setLocalLoading(false);
        setLocalRefreshing(false);
      }
      setLoadingMore(false);
    }
  }, [feedType, currentUserId, useStore, setStoreLoading, setStoreError, updateFeedCache, appendToFeedCache, syncEventsFromFeed]);

  // Check if we need to fetch data
  const shouldFetchData = useCallback(() => {
    if (!useStore) return true; // Always fetch for local state
    
    const cache = getFeedCache(feedType);
    if (!cache.data || cache.data.length === 0) return true;
    if (needsRefresh(CACHE_DURATION)) return true;
    
    return false;
  }, [useStore, feedType, getFeedCache, needsRefresh]);

  // Initial load and refresh on focus
  useFocusEffect(
    useCallback(() => {
      if (shouldFetchData()) {
        console.log(`🔄 EventsFeed: Loading ${feedType} feed...`);
        fetchEvents(false, 1);
      } else {
        console.log(`✅ EventsFeed: Using cached ${feedType} feed`);
      }
    }, [feedType, shouldFetchData, fetchEvents])
  );

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    console.log(`🔄 EventsFeed: Refreshing ${feedType} feed...`);
    
    if (externalOnRefresh) {
      await externalOnRefresh();
    } else {
      await fetchEvents(true, 1);
    }
  }, [feedType, externalOnRefresh, fetchEvents]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore || loading) return;
    
    console.log(`📄 EventsFeed: Loading more ${feedType} events, page ${page + 1}...`);
    fetchEvents(false, page + 1);
  }, [loadingMore, hasMore, loading, feedType, page, fetchEvents]);

  // Enhanced RSVP handler using centralized store
  const handleAttend = useCallback(async (eventData) => {
    if (!currentUserId) {
      Alert.alert('Error', 'Please log in to join events');
      return;
    }

    if (!useStore) {
      // FIXED: Use correct API endpoints for non-store mode
      try {
        if (eventData.type === 'request') {
          await api.post(`/api/events/request-join/${eventData.eventId}`, {
            message: eventData.message || 'I would like to join this event.'
          });
        } else {
          await api.post(`/api/events/attend/${eventData._id}`);
        }
        // Refresh to get updated data
        await fetchEvents(true, 1);
      } catch (error) {
        throw error;
      }
      return;
    }

    // Use centralized store
    const result = await toggleRSVP(eventData._id, currentUserId, eventData);
    
    if (result.type === 'request') {
      Alert.alert('Request Sent', 'Your join request has been sent to the event host.');
    } else if (result.type === 'payment_required') {
      Alert.alert(
        'Payment Required',
        'This event requires payment. You\'ll be redirected to the event details.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Continue', 
            onPress: () => navigation.navigate('EventDetailsScreen', { eventId: eventData._id })
          }
        ]
      );
    } else if (result.type === 'permission_denied') {
      Alert.alert('Access Denied', result.error);
    } else if (!result.success) {
      throw new Error(result.error);
    }
    
    // Store automatically updates UI, no need for manual refresh
  }, [currentUserId, useStore, toggleRSVP, navigation, fetchEvents]);

  // Render event item
  const renderEvent = useCallback(({ item, index }) => (
    <EventCard
      event={item}
      currentUserId={currentUserId}
      navigation={navigation}
      onAttend={handleAttend}
      showRecommendationReason={feedType === 'discover'}
      compact={false}
    />
  ), [currentUserId, navigation, handleAttend, feedType]);

  // Render loading footer
  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#3797EF" />
        <Text style={styles.footerLoaderText}>Loading more events...</Text>
      </View>
    );
  }, [loadingMore]);

  // Render empty state
const renderEmptyState = useCallback(() => {
  if (loading) return null;

  const isForYou = feedType === 'discover' || feedType === 'for-you';
  
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons 
          name={isForYou ? "calendar-outline" : "people-outline"} 
          size={64} 
          color="#C7C7CC" 
        />
      </View>
      
      <Text style={styles.emptyTitle}>
        {isForYou ? 'No Events Yet' : 'No Events from Friends'}
      </Text>
      
      <Text style={styles.emptySubtitle}>
        {isForYou 
          ? 'Be the first to create something amazing in your area!'
          : 'When you\'re friends with people who create events, they\'ll appear here.'
        }
      </Text>
      
      <TouchableOpacity 
        style={styles.createEventButton}
        onPress={() => navigation.navigate('CreateEventScreen')}
        activeOpacity={0.8}
      >
        <Ionicons name="add-circle" size={18} color="#3797EF" />
        <Text style={styles.createEventButtonText}>Create an event</Text>
      </TouchableOpacity>
    </View>
  );
}, [loading, feedType, navigation]);
  // Render error state
  const renderErrorState = useCallback(() => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Failed to load events</Text>
      <Text style={styles.errorMessage}>{error}</Text>
      <TouchableOpacity 
        style={styles.retryButton} 
        onPress={() => fetchEvents(true, 1)}
      >
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  ), [error, fetchEvents]);

  // Main loading state
  if (loading && events.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    );
  }

  // Error state
  if (error && events.length === 0) {
    return renderErrorState();
  }
console.log('🔍 EventsFeed Refresh Debug:', {
  feedType,
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
  // Main feed
  return (
  <View style={styles.container}>
    <FlatList
  ref={flatListRef}
  data={events}
  keyExtractor={(item) => item._id}
  renderItem={renderEvent}
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        console.log(`🔄 EventsFeed (${feedType}): Refresh triggered, should appear below sub-tabs`);
        handleRefresh();
      }}
      tintColor="#3797EF"
      colors={["#3797EF"]}
      title="Pull to refresh"
      titleColor="#8E8E93"
      progressBackgroundColor="#FFFFFF"
    />
  }
  onEndReached={handleLoadMore}
  onEndReachedThreshold={0.5}
  onScroll={onScroll}
  scrollEventThrottle={scrollEventThrottle}
  ListFooterComponent={renderFooter}
  ListEmptyComponent={renderEmptyState}
  showsVerticalScrollIndicator={false}
  contentContainerStyle={[
    styles.listContent,
    events.length === 0 && styles.emptyListContent
  ]}
  // ✅ ADD: Push refresh control below sub-tabs
  contentInset={{ top: 20 }} // REDUCED from 200 to 60
  scrollIndicatorInsets={{ top: 20 }} // REDUCED from 200 to 60
  bounces={true}
  alwaysBounceVertical={true}
  removeClippedSubviews={true}
  maxToRenderPerBatch={5}
  updateCellsBatchingPeriod={50}
  windowSize={10}
  getItemLayout={undefined}
/>
  </View>
);
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  // ✅ STANDARDIZED: Reduced paddingTop from 200 to 190 for consistency
  listContent: {
    paddingTop: 190,     // ✅ CHANGED: From 200 to 190 to match other event feeds
    paddingBottom: 100,
  },
  // ✅ STANDARDIZED: Also update empty state for consistency
  emptyListContent: {
    paddingTop: 190,     // ✅ CHANGED: From 200 to 190 to match other event feeds
    paddingBottom: 100,
    minHeight: '100%',   // ✅ KEEP: From Phase 1 fix
  },
  
  // Loading states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 250,     // ✅ KEEP: Loading states use higher padding
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  
  // Footer loading
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  
  // Error states
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 250,     // ✅ KEEP: Error states use higher padding
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 50,      // ✅ KEEP: Relative padding within emptyListContent
  },
  // Action buttons
  actionButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
secondaryButton: {
  backgroundColor: 'transparent',
  borderWidth: 1.5,
  borderColor: '#3797EF',
  shadowOpacity: 0,
  elevation: 0,
},
secondaryButtonText: {
  color: '#3797EF',
  fontWeight: '600',
},







// Update/add these styles in EventsFeed.js:
emptyContainer: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 40,
  paddingTop: 20, // ✅ MOVED UP: Reduced from 50
},
emptyIconContainer: {
  width: 120,
  height: 120,
  borderRadius: 60,
  backgroundColor: 'rgba(248, 249, 250, 0.8)',
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: 24,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 2,
},
emptyTitle: {
  fontSize: 24, // ✅ MATCH ACTIVITY: Same as activity screen
  fontWeight: '700', // ✅ MATCH ACTIVITY: Same as activity screen
  color: '#000000', // ✅ MATCH ACTIVITY: Same as activity screen
  marginBottom: 8,
  textAlign: 'center',
},
createEventButton: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20, // ✅ MATCH FRIENDS: Same as createSuggestion
  paddingVertical: 12, // ✅ MATCH FRIENDS: Same as createSuggestion
  borderRadius: 25, // ✅ MATCH FRIENDS: Same rounded style
  backgroundColor: 'rgba(55, 151, 239, 0.1)', // ✅ MATCH FRIENDS: Light blue background
  borderWidth: 1.5,
  borderColor: 'rgba(55, 151, 239, 0.3)',
  marginTop: 8, // ✅ KEEP: Space from subtitle
  // Remove shadow properties to match friends style
},
createEventButtonText: {
  fontSize: 15, // ✅ MATCH FRIENDS: Same as createSuggestionText
  color: '#3797EF', // ✅ MATCH FRIENDS: Blue color
  marginLeft: 8,
  fontWeight: '600', // ✅ MATCH FRIENDS: Same weight
},
// ✅ NEW: Styles for friends tab actions
emptyActions: {
  alignItems: 'center',
  gap: 16, // ✅ INCREASED: More space between buttons
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
createSuggestion: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20, // ✅ INCREASED: More visible
  paddingVertical: 12, // ✅ INCREASED: More visible
  borderRadius: 25,
  backgroundColor: 'rgba(55, 151, 239, 0.1)', // ✅ IMPROVED: Light blue background
  borderWidth: 1.5,
  borderColor: 'rgba(55, 151, 239, 0.3)',
},
createSuggestionText: {
  fontSize: 15, // ✅ INCREASED: More visible
  color: '#3797EF', // ✅ IMPROVED: Blue color to match theme
  marginLeft: 8,
  fontWeight: '600', // ✅ IMPROVED: Bolder text
},
emptySubtitle: {
  fontSize: 16, // ✅ MATCH ACTIVITY: Same as activity screen
  color: '#8E8E93', // ✅ MATCH ACTIVITY: Same as activity screen
  textAlign: 'center',
  lineHeight: 22, // ✅ MATCH ACTIVITY: Same as activity screen
  marginBottom: 32,
},
});