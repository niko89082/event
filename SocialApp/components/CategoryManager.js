// components/CategoryManager.js - Phase 1: Enhanced category management with empty filtering
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CategoryEventSection from './CategoryEventSection';
import api from '../services/api';
import categoryCacheService from '../services/CategoryCacheService';

// Category configuration with priority and icons
const CATEGORY_CONFIG = {
  'Music': { priority: 10, icon: 'musical-notes', colors: ['#FF6B6B', '#FF8E8E'] },
  'Party': { priority: 9, icon: 'sparkles', colors: ['#4ECDC4', '#6FE8E0'] },
  'Social': { priority: 8, icon: 'people', colors: ['#45B7D1', '#66C5F0'] },
  'Club': { priority: 7, icon: 'business', colors: ['#96CEB4', '#A8D8C7'] },
  'Sports': { priority: 6, icon: 'fitness', colors: ['#FECA57', '#FED569'] },
  'Food': { priority: 6, icon: 'restaurant', colors: ['#FF9FF3', '#FFB3F7'] },
  'Business': { priority: 5, icon: 'briefcase', colors: ['#54A0FF', '#74B9FF'] },
  'Entertainment': { priority: 5, icon: 'film', colors: ['#5F27CD', '#7C4DFF'] },
  'Art': { priority: 4, icon: 'color-palette', colors: ['#00D2D3', '#1DD1A1'] },
  'Technology': { priority: 4, icon: 'laptop', colors: ['#FF3838', '#FF6B6B'] },
  'Education': { priority: 3, icon: 'school', colors: ['#FFD93D', '#FFE55C'] },
  'Health': { priority: 3, icon: 'heart', colors: ['#6C5CE7', '#A29BFE'] },
  'Travel': { priority: 2, icon: 'airplane', colors: ['#FD79A8', '#FDCB6E'] },
  'Celebration': { priority: 2, icon: 'gift', colors: ['#E17055', '#FDCB6E'] },
  'Professional': { priority: 1, icon: 'medal', colors: ['#2D3436', '#636E72'] },
  'Meeting': { priority: 1, icon: 'chatbubbles', colors: ['#74B9FF', '#0984E3'] },
  'General': { priority: 0, icon: 'calendar', colors: ['#DDD', '#999'] }, // Lowest priority
};

// PHASE 1: Minimum events required to show a category (KEY REQUIREMENT)
const MIN_EVENTS_THRESHOLD = 1;

// Maximum categories to show initially (performance optimization)
const MAX_INITIAL_CATEGORIES = 6;

export default function CategoryManager({ 
  navigation, 
  currentUserId, 
  refreshTrigger = 0,
  onCategoriesLoaded,
  style,
  showAllCategories = false,
  onShowAllToggle
}) {
  const [categoryData, setCategoryData] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showAllCategoriesState, setShowAllCategories] = useState(showAllCategories);

  // Load category counts on mount and refresh trigger
  useEffect(() => {
    loadCategoryCounts();
  }, [refreshTrigger]);

  // PHASE 1: Filter categories with events and sort by priority
  const filteredAndSortedCategories = useMemo(() => {
    const categoriesWithEvents = Object.entries(categoryData)
      .filter(([category, count]) => count >= MIN_EVENTS_THRESHOLD) // KEY: Only show categories with events
      .sort(([categoryA, countA], [categoryB, countB]) => {
        // Sort by priority first, then by count
        const priorityA = CATEGORY_CONFIG[categoryA]?.priority || 0;
        const priorityB = CATEGORY_CONFIG[categoryB]?.priority || 0;
        
        if (priorityA !== priorityB) {
          return priorityB - priorityA; // Higher priority first
        }
        
        return countB - countA; // Then by event count
      });
    
    return categoriesWithEvents.map(([category, count]) => category);
  }, [categoryData]);

  // PHASE 1: Determine which categories to display
  const displayedCategories = showAllCategoriesState 
    ? filteredAndSortedCategories 
    : filteredAndSortedCategories.slice(0, MAX_INITIAL_CATEGORIES);

  const loadCategoryCounts = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setRefreshing(forceRefresh);

      // Try cache first if not forcing refresh
      if (!forceRefresh) {
        const cachedCounts = categoryCacheService.getCategoryCounts();
        if (cachedCounts) {
          setCategoryData(cachedCounts);
          setError(null);
          
          if (onCategoriesLoaded) {
            const visibleCount = Object.values(cachedCounts).filter(count => count >= MIN_EVENTS_THRESHOLD).length;
            onCategoriesLoaded(visibleCount, cachedCounts);
          }

          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      // Fetch from API using existing endpoint
      const response = await api.get('/api/events/category-counts');
      const counts = response.data.categoryCounts || {};

      // Cache the results
      categoryCacheService.setCategoryCounts(counts);

      setCategoryData(counts);
      setError(null);

      // Notify parent about loaded categories
      if (onCategoriesLoaded) {
        const visibleCount = Object.values(counts).filter(count => count >= MIN_EVENTS_THRESHOLD).length;
        onCategoriesLoaded(visibleCount, counts);
      }

      console.log('✅ Category counts loaded:', counts);

    } catch (err) {
      console.error('❌ Error loading category counts:', err);
      setError(err);
      setCategoryData({});
      
      if (onCategoriesLoaded) {
        onCategoriesLoaded(0, {});
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle individual category events loaded
  const handleCategoryEventsLoaded = useCallback((category, eventCount) => {
    setCategoryData(prev => {
      const updated = {
        ...prev,
        [category]: eventCount
      };
      
      // Notify parent of updates
      if (onCategoriesLoaded) {
        const visibleCount = Object.values(updated).filter(count => count >= MIN_EVENTS_THRESHOLD).length;
        onCategoriesLoaded(visibleCount, updated);
      }
      
      return updated;
    });
  }, [onCategoriesLoaded]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    loadCategoryCounts(true);
  }, []);

  // Handle show more/less categories
  const toggleShowAllCategories = useCallback(() => {
    const newState = !showAllCategoriesState;
    setShowAllCategories(newState);
    if (onShowAllToggle) {
      onShowAllToggle(newState);
    }
  }, [showAllCategoriesState, onShowAllToggle]);

  // Loading state
  if (loading && Object.keys(categoryData).length === 0) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading event categories...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error && Object.keys(categoryData).length === 0) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#FF3B30" />
          <Text style={styles.errorTitle}>Unable to Load Events</Text>
          <Text style={styles.errorText}>
            Please check your connection and try again
          </Text>
        </View>
      </View>
    );
  }

  // PHASE 1: Empty state - no categories with events (KEY REQUIREMENT)
  if (filteredAndSortedCategories.length === 0) {
    return (
      <View style={[styles.container, style]}>
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#3797EF"
            />
          }
          contentContainerStyle={styles.emptyScrollContainer}
        >
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>No Events Available</Text>
            <Text style={styles.emptySubtext}>
              Check back later for new events in your area
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#3797EF"
          />
        }
        // Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={3}
        initialNumToRender={3}
        windowSize={5}
      >
        {/* PHASE 1: Render Category Sections (only categories with events) */}
        {displayedCategories.map((category, index) => (
          <CategoryEventSection
            key={`${category}-${refreshTrigger}`} // Force re-render on refresh
            category={category}
            navigation={navigation}
            currentUserId={currentUserId}
            onEventsLoaded={handleCategoryEventsLoaded}
            refreshTrigger={refreshTrigger}
            categoryConfig={CATEGORY_CONFIG[category]}
            // Lazy load categories below the fold for performance
            priority={index < 3 ? 'high' : 'normal'}
          />
        ))}

        {/* Show All/Less Categories Toggle */}
        {filteredAndSortedCategories.length > MAX_INITIAL_CATEGORIES && (
          <View style={styles.showAllContainer}>
            <TouchableOpacity 
              style={styles.showAllButton} 
              onPress={toggleShowAllCategories}
              activeOpacity={0.7}
            >
              <Text style={styles.showAllText}>
                {showAllCategoriesState 
                  ? `Show Less Categories` 
                  : `Show All ${filteredAndSortedCategories.length} Categories`
                }
              </Text>
              <Ionicons 
                name={showAllCategoriesState ? "chevron-up" : "chevron-down"} 
                size={16} 
                color="#3797EF" 
                style={styles.showAllIcon}
              />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF3B30',
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyScrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  showAllContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  showAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    // Card-like shadow
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  showAllText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3797EF',
    marginRight: 8,
  },
  showAllIcon: {
    marginLeft: 4,
  },
});