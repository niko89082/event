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
  'Music': '#FF6B6B',
  'Sports': '#4ECDC4', 
  'Food': '#45B7D1',
  'Party': '#A8E6CF',
  'Social': '#FFD93D',
  'Business': '#6C5CE7',
  'Entertainment': '#FD79A8',
  'Art': '#FDCB6E',
  'Technology': '#74B9FF',
  'Education': '#81ECEC',
  'Health': '#55A3FF',
  'Travel': '#00B894',
  'Celebration': '#E17055',
  'Professional': '#636E72',
  'Meeting': '#A29BFE',
  'General': '#DDD'
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

      const categoryEvents = response.data.events || response.data || [];
      
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
  
  // ✅ STRICT: Horizontal scrolling only
  horizontal={true}
  
  // ✅ STRICT: Disable all vertical movement
  showsHorizontalScrollIndicator={false}
  showsVerticalScrollIndicator={false}
  scrollEnabled={true}
  
  // ✅ CRITICAL: Prevent any vertical scrolling or bouncing
  bounces={false}           // No bouncing at all
  bouncesZoom={false}
  alwaysBounceVertical={false}
  alwaysBounceHorizontal={false}  // Also disable horizontal bounce for strict control
  
  // ✅ STRICT: Lock to horizontal only
  directionalLockEnabled={true}   // iOS: Lock to one direction
  pagingEnabled={false}          // Disable paging to prevent weird behavior
  
  // ✅ ENHANCED: Smooth horizontal scrolling
  decelerationRate="normal"
  scrollEventThrottle={16}
  
  // ✅ OPTIONAL: Snap to cards (comment out if it feels too restrictive)
  snapToInterval={SCREEN_WIDTH * 0.55 + 12}
  snapToAlignment="start"
  
  // ✅ LAYOUT: Content styling
  contentContainerStyle={styles.listContainer}
  
  // ✅ NO REFRESH: Removed RefreshControl completely
  
  // Performance optimizations
  removeClippedSubviews={true}
  maxToRenderPerBatch={5}
  initialNumToRender={3}
  windowSize={7}
  
  // Item layout calculation
  getItemLayout={(data, index) => {
    const CARD_WIDTH = SCREEN_WIDTH * 0.62;  // Updated for new card width
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
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  loadingSection: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
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
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginRight: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
    listContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 0,        // ✅ CRITICAL: Prevent container from growing vertically
    height: 160,        // ✅ FIXED: Set exact height to match card height
  },
  loadingContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  categoryTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  categoryTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // ✅ UPDATE: Modify existing header style
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,          // ✅ CHANGED: More padding for tag style
    paddingBottom: 12,       // ✅ CHANGED: Less bottom padding
    // Remove borderBottom for cleaner tag look
  },
});