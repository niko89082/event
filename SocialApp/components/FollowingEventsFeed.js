// SocialApp/components/FollowingEventsFeed.js - FIXED: Content flows naturally under transparent headers
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
  scrollEventThrottle = 16
}) {
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

      // Correct API endpoint for following events
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

  // Enhanced scroll handler that combines internal logic with parent callback
  const handleScroll = useCallback((event) => {
    // Call parent's scroll handler for tab bar animation
    if (parentOnScroll) {
      parentOnScroll(event);
    }
    
    // Add any internal scroll logic here if needed
  }, [parentOnScroll]);

  const renderEventItem = ({ item }) => (
    <View style={styles.eventWrapper}>
      <EventCard 
        event={item}
        currentUserId={currentUserId}
        navigation={navigation}
        onAttend={handleAttend}
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
      When you're friends with people who create events, they'll appear here.
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
    // Update the FlatList with debug-enabled refresh positioning:
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
  contentContainerStyle={events.length === 0 ? styles.emptyContainer : styles.container}
  // ✅ ADD: Push refresh control below sub-tabs
  contentInset={{ top: 20 }} // REDUCED from 200 to 60
  scrollIndicatorInsets={{ top: 20 }} // REDUCED from 200 to 60
  // ✅ REMOVE: This duplicate onRefresh prop that's causing the error
  // onRefresh={() => { ... }} ← DELETE THIS LINE
  bounces={true}
  alwaysBounceVertical={true}
  removeClippedSubviews={true}
  initialNumToRender={5}
  maxToRenderPerBatch={5}
  windowSize={10}
/>
  );
}

const styles = StyleSheet.create({
  // ✅ STANDARDIZED: Use paddingTop instead of contentInset for consistency
  container: {
    paddingTop: 190,        // ✅ NEW: Standard top padding like other feeds
    paddingBottom: 20,      // ✅ KEEP: Existing bottom padding
    backgroundColor: 'transparent',
  },
  emptyContainer: {
    flexGrow: 1,
    paddingTop: 190,        // ✅ NEW: Consistent empty state padding
    backgroundColor: 'transparent',
  },
  eventWrapper: {
    marginBottom: 12,
    marginHorizontal: 16,
    backgroundColor: 'transparent',
  },
  
  // Loading states
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingTop: 250,        // ✅ KEEP: Higher padding for loading states
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
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
    backgroundColor: 'transparent',
  },
  emptyActions: {
  alignItems: 'center',
  gap: 12,
},
// Update these styles in FollowingEventsFeed.js:
emptyState: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 40,
  paddingTop: 20, // ✅ MOVED UP: Reduced from 50
  backgroundColor: 'transparent',
},
emptyTitle: {
  fontSize: 24, // ✅ MATCH ACTIVITY: Same as activity screen
  fontWeight: '700', // ✅ MATCH ACTIVITY: Same as activity screen
  color: '#000000', // ✅ MATCH ACTIVITY: Same as activity screen
  marginBottom: 8,
  textAlign: 'center',
},
emptySubtitle: {
  fontSize: 16, // ✅ MATCH ACTIVITY: Same as activity screen
  color: '#8E8E93', // ✅ MATCH ACTIVITY: Same as activity screen
  textAlign: 'center',
  lineHeight: 22, // ✅ MATCH ACTIVITY: Same as activity screen
  marginBottom: 32,
},
// ✅ ADD: New styles for improved actions
emptyActions: {
  alignItems: 'center',
  gap: 16, // ✅ INCREASED: More space between buttons
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
});