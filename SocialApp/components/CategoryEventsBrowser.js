// components/CategoryEventsBrowser.js - NEW category browser
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../services/api';
import EventCard from './EventCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // 2 columns with margins

const CATEGORIES = [
  { name: 'Music', icon: 'musical-notes', colors: ['#FF6B6B', '#FF8E8E'] },
  { name: 'Sports', icon: 'football', colors: ['#4ECDC4', '#6FE8E0'] },
  { name: 'Food', icon: 'restaurant', colors: ['#45B7D1', '#66C5F0'] },
  { name: 'Arts', icon: 'color-palette', colors: ['#96CEB4', '#A8D8C7'] },
  { name: 'Tech', icon: 'laptop', colors: ['#FECA57', '#FED569'] },
  { name: 'Business', icon: 'briefcase', colors: ['#FF9FF3', '#FFB3F7'] },
  { name: 'Health', icon: 'fitness', colors: ['#54A0FF', '#74B9FF'] },
  { name: 'Education', icon: 'library', colors: ['#5F27CD', '#7C4DFF'] },
  { name: 'Travel', icon: 'airplane', colors: ['#00D2D3', '#1DD1A1'] },
  { name: 'Gaming', icon: 'game-controller', colors: ['#FF3838', '#FF6B6B'] },
  { name: 'Fashion', icon: 'shirt', colors: ['#FFD93D', '#FFE55C'] },
  { name: 'Outdoor', icon: 'leaf', colors: ['#6C5CE7', '#A29BFE'] }
];

export default function CategoryEventsBrowser({ navigation, currentUserId }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryEvents, setCategoryEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (selectedCategory) {
      fetchCategoryEvents(selectedCategory);
    }
  }, [selectedCategory]);

  const fetchCategoryEvents = async (category, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const { data } = await api.get(`/api/events?category=${category}&limit=20`);
      setCategoryEvents(data.events || data || []);

    } catch (error) {
      console.error('Category events fetch error:', error);
      setCategoryEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCategoryPress = (category) => {
    setSelectedCategory(category.name);
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setCategoryEvents([]);
  };

  const handleAttend = async (event) => {
    try {
      await api.post(`/api/events/attend/${event._id}`);
      fetchCategoryEvents(selectedCategory, true);
    } catch (error) {
      console.error('Attend event error:', error);
    }
  };

  const renderCategory = ({ item }) => (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => handleCategoryPress(item)}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={item.colors}
        style={styles.categoryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name={item.icon} size={32} color="#FFFFFF" />
        <Text style={styles.categoryTitle}>{item.name}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderEvent = ({ item }) => (
    <View style={styles.eventWrapper}>
      <EventCard
        event={item}
        currentUserId={currentUserId}
        navigation={navigation}
        onAttend={handleAttend}
        compact={false}
      />
    </View>
  );

  const renderCategoryHeader = () => (
    <View style={styles.categoryHeader}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleBackToCategories}
        activeOpacity={0.8}
      >
        <Ionicons name="chevron-back" size={24} color="#3797EF" />
        <Text style={styles.backButtonText}>Categories</Text>
      </TouchableOpacity>
      <Text style={styles.categoryHeaderTitle}>{selectedCategory} Events</Text>
    </View>
  );

  // Show category events if a category is selected
  if (selectedCategory) {
    return (
      <View style={styles.container}>
        {renderCategoryHeader()}
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3797EF" />
            <Text style={styles.loadingText}>Loading {selectedCategory.toLowerCase()} events...</Text>
          </View>
        ) : categoryEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="calendar-outline" size={64} color="#C7C7CC" />
            </View>
            <Text style={styles.emptyTitle}>No {selectedCategory.toLowerCase()} events</Text>
            <Text style={styles.emptySubtitle}>
              Check back later or try a different category
            </Text>
          </View>
        ) : (
          <FlatList
            data={categoryEvents}
            keyExtractor={item => item._id}
            renderItem={({ item }) => (
              <EventCard 
                event={item}
                currentUserId={currentUserId}
                navigation={navigation}
                onAttend={handleAttend}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.eventsListContent}
          />
        )}
      </View>
    );
  }

  // Show categories grid
  return (
    <View style={styles.container}>
      <View style={styles.categoriesHeader}>
        <Text style={styles.categoriesTitle}>Browse by Category</Text>
        <Text style={styles.categoriesSubtitle}>Discover events that match your interests</Text>
      </View>
      
      <FlatList
        data={CATEGORIES}
        keyExtractor={item => item.name}
        renderItem={renderCategory}
        numColumns={2}
        columnWrapperStyle={styles.categoriesRow}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  
  // Categories Header
  categoriesHeader: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
  },
  categoriesTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  categoriesSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Categories Grid
  categoriesContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  categoriesRow: {
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: CARD_WIDTH,
    height: 120,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
    textAlign: 'center',
  },

  // Category Events View
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3797EF',
    fontWeight: '500',
    marginLeft: 4,
  },
  categoryHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
  },

  // Events List
  eventsListContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
});