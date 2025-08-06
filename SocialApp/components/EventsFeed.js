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
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import EventCard from './EventCard';
import useEventStore from '../stores/eventStore';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const PAGE_SIZE = 10;

export default function EventsFeed({
  navigation,
  currentUserId,
  feedType = 'discover', // 'discover', 'following', 'nearby', etc.
  refreshing: externalRefreshing = false,
  onRefresh: externalOnRefresh,
  onScroll,
  scrollEventThrottle = 16,
  useEventStore: useStoreFlag = true,
  activeTab,
}) {
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

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>
          {feedType === 'following' ? 'No events from friends' : 'No events found'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {feedType === 'following' 
            ? 'Follow some friends to see their events here' 
            : 'Check back later for new events in your area'
          }
        </Text>
      </View>
    );
  }, [loading, feedType]);

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
            onRefresh={handleRefresh}
            tintColor="#3797EF"
            colors={["#3797EF"]}
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
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
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
});