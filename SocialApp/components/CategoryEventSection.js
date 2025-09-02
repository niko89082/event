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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MinimalEventCard from './MinimalEventCard';
import api from '../services/api';
import categoryCacheService from '../services/CategoryCacheService';

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
        <View style={styles.headerLeft}>
          {/* Category Icon */}
          {categoryConfig.icon && (
            <View style={[styles.categoryIcon, { backgroundColor: categoryConfig.colors?.[0] + '20' || '#F0F0F0' }]}>
              <Ionicons 
                name={categoryConfig.icon} 
                size={18} 
                color={categoryConfig.colors?.[0] || '#3797EF'} 
              />
            </View>
          )}
          <View style={styles.titleContainer}>
            <Text style={styles.categoryTitle}>{category}</Text>
            {/* PHASE 1: Show event count but NO attendee count as requested */}
            <Text style={styles.eventCount}>
              {events.length} event{events.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        
        {/* VIEW MORE button (similar to reference UI) */}
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
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#3797EF"
          />
        }
        // Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        initialNumToRender={3}
        windowSize={7}
        getItemLayout={(data, index) => (
          {length: 292, offset: 292 * index, index} // 280 card + 12 margin
        )}
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
  },
  loadingContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
});