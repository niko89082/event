// components/CategoryEventSection.js - Phase 1: Updated for minimal event cards
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MinimalEventCard from './MinimalEventCard';
import api from '../services/api';
import categoryCacheService from '../services/CategoryCacheService';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CategoryEventSection({ 
  category, 
  navigation, 
  currentUserId,
  onEventsLoaded, // Callback to parent about event count
  refreshTrigger = 0, // External refresh trigger
  categoryConfig = {}, // Category configuration (icon, colors, priority)
  priority = 'normal' // Rendering priority for performance
}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(priority === 'high'); // High priority loads immediately
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [hasInitialized, setHasInitialized] = useState(false);
const CATEGORY_COLORS = {
  'Music': '#FF3B5C',       // Vibrant pink-red
  'Sports': '#00D9A3',      // Bright teal
  'Food': '#FF8C42',        // Vibrant orange
  'Party': '#9D4EDD',       // Bright purple
  'Social': '#3B82F6',      // Bright blue
  'Business': '#6366F1',    // Indigo
  'Entertainment': '#EC4899', // Hot pink
  'Art': '#F59E0B',         // Amber
  'Technology': '#0EA5E9',  // Sky blue
  'Education': '#14B8A6',   // Teal
  'Health': '#EF4444',      // Red
  'Travel': '#10B981',      // Emerald
  'Celebration': '#F97316', // Orange
  'Professional': '#64748B', // Slate
  'Meeting': '#8B5CF6',     // Violet
  'General': '#94A3B8'      // Gray
};

  useEffect(() => {
    // High priority categories load immediately
    if (priority === 'high') {
      fetchCategoryEvents();
    } else {
      // Normal priority categories load with slight delay for performance
      const timeout = setTimeout(() => {
        if (!hasInitialized) {
          setHasInitialized(true);
          setLoading(true);
          fetchCategoryEvents();
        }
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [category, refreshTrigger, priority]);

  const fetchCategoryEvents = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        // Clear cache on manual refresh
        categoryCacheService.clearCategoryCache(category);
      } else if (events.length === 0) {
        setLoading(true);
      }

      // Try to get cached events first (if not refreshing)
      if (!isRefresh) {
        const cachedEvents = categoryCacheService.getCachedEvents(category);
        if (cachedEvents) {
          setEvents(cachedEvents);
          setError(null);
          
          if (onEventsLoaded) {
            onEventsLoaded(category, cachedEvents.length);
          }
          
          setLoading(false);
          return;
        }
      }

      // Fetch from API using existing discover endpoint
      const response = await api.get('/api/events/discover', {
        params: {
          category: category,
          upcoming: true,
          limit: 10, // Limit for horizontal scrolling
          skip: 0
        }
      });

      // Check if response is an error (401, 403, etc.) before using data
      if (response.status >= 400) {
        throw new Error(`API error: ${response.status}`);
      }

      // Ensure we always get an array
      let categoryEvents = [];
      if (response.data) {
        if (Array.isArray(response.data.events)) {
          categoryEvents = response.data.events;
        } else if (Array.isArray(response.data)) {
          categoryEvents = response.data;
        }
      }
      
      // Cache the results
      categoryCacheService.setCategoryEvents(category, categoryEvents);
      
      setEvents(categoryEvents);
      setError(null);

      // Notify parent about event count for visibility logic
      if (onEventsLoaded) {
        onEventsLoaded(category, categoryEvents.length);
      }

    } catch (err) {
      console.error(`Error fetching ${category} events:`, err);
      setError(err);
      setEvents([]);
      
      if (onEventsLoaded) {
        onEventsLoaded(category, 0);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleEventPress = (event) => {
    navigation.navigate('EventDetailsScreen', { 
      eventId: event._id,
      event: event 
    });
  };

  const handleViewAll = () => {
    navigation.navigate('CategoryEventsScreen', { 
      category,
      events 
    });
  };

  const handleRefresh = () => {
    fetchCategoryEvents(true);
  };

  // PHASE 1: Don't render if no events (key requirement)
  if (loading && events.length === 0) {
    return (
      <View style={styles.loadingSection}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {categoryConfig.icon && (
              <View style={[styles.categoryIcon, { backgroundColor: categoryConfig.colors?.[0] + '20' || '#F0F0F0' }]}>
                <Ionicons 
                  name={categoryConfig.icon} 
                  size={18} 
                  color={categoryConfig.colors?.[0] || '#3797EF'} 
                />
              </View>
            )}
            <Text style={styles.categoryTitle}>{category}</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#3797EF" />
        </View>
      </View>
    );
  }

  // PHASE 1: Don't render if no events and not loading (key requirement)
  if (!loading && events.length === 0 && hasInitialized) {
    // Notify parent that this category has no events
    if (onEventsLoaded && !error) {
      onEventsLoaded(category, 0);
    }
    return null; // This ensures empty categories don't show up
  }

  // Don't render if not initialized yet (lazy loading for performance)
  if (!hasInitialized && priority !== 'high') {
    return null;
  }

  const renderEventCard = ({ item }) => (
    <MinimalEventCard
      event={item}
      onPress={handleEventPress}
      currentUserId={currentUserId}
    />
  );

  return (
    <View style={styles.container}>
      {/* Category Header */}
       <View style={styles.header}>
        {/* Colored Category Tag */}
        <View style={[
          styles.categoryTag, 
          { backgroundColor: CATEGORY_COLORS[category] || CATEGORY_COLORS.General }
        ]}>
          <Text style={styles.categoryTagText}>{category.toUpperCase()}</Text>
        </View>
        
        {/* VIEW MORE button */}
        {events.length > 0 && (
          <TouchableOpacity 
            style={styles.viewMoreButton}
            onPress={handleViewAll}
            activeOpacity={0.7}
          >
            <Text style={styles.viewMoreText}>VIEW MORE</Text>
            <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal Event Cards List */}
       <FlatList
  data={events}
  renderItem={renderEventCard}
  keyExtractor={(item) => item._id}
  
  // ✅ Horizontal scrolling
  horizontal={true}
  
  // ✅ Hide scroll indicators
  showsHorizontalScrollIndicator={false}
  showsVerticalScrollIndicator={false}
  scrollEnabled={true}
  
  // ✅ IMPROVED: Enable horizontal bouncing for better UX
  bounces={true}
  bouncesZoom={false}
  alwaysBounceVertical={false}
  alwaysBounceHorizontal={true}  // Enable horizontal bounce for natural feel
  
  // ✅ Lock to horizontal only
  directionalLockEnabled={true}
  pagingEnabled={false}
  
  // ✅ Smooth horizontal scrolling
  decelerationRate="normal"
  scrollEventThrottle={16}
  
  // ✅ Snap to cards for better UX
  snapToInterval={SCREEN_WIDTH * 0.55 + 12}
  snapToAlignment="start"
  
  // ✅ IMPROVED: Content styling with end padding
  contentContainerStyle={styles.listContainer}
  style={styles.flatListStyle}
  
  // Performance optimizations
  removeClippedSubviews={false} // ✅ FIXED: Disable to prevent card clipping
  maxToRenderPerBatch={5}
  initialNumToRender={3}
  windowSize={7}
  
  // Item layout calculation
  getItemLayout={(data, index) => {
    const CARD_WIDTH = SCREEN_WIDTH * 0.55;
    const CARD_SPACING = 12;
    const itemWidth = CARD_WIDTH + CARD_SPACING;
    return {length: itemWidth, offset: itemWidth * index, index};
  }}
/>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 0, // ✅ REMOVED: No margin between categories
    backgroundColor: '#FAFAFA',
    overflow: 'visible', // ✅ FIXED: Prevent clipping of event cards
  },
  loadingSection: {
    marginBottom: 0, // ✅ REMOVED: No margin between categories
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: '#FAFAFA',
    // Removed border divider for cleaner look
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    textTransform: 'uppercase', // Similar to "EVENT", "POLL" in reference
    letterSpacing: 0.5,
  },
  eventCount: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginRight: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
    listContainer: {
    paddingLeft: 16,
    paddingRight: 32,    // ✅ IMPROVED: Extra padding at end for better UX
    paddingTop: 10,
    paddingBottom: 16, // ✅ ADJUSTED: Reduced bottom padding for tighter spacing
    flexGrow: 0,
    // Remove fixed height to allow cards to display fully
  },
  flatListStyle: {
    overflow: 'visible', // ✅ FIXED: Ensure cards aren't clipped
  },
  loadingContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  categoryTag: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  categoryTagText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // Header styles are now defined above - this duplicate has been removed
});