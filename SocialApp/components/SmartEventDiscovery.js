// components/SmartEventDiscovery.js - AI-Powered Event Discovery
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import EventCard from './EventCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DISCOVERY_CATEGORIES = [
  { key: 'smart', label: 'For You', icon: 'star-outline', color: '#3797EF' },
  { key: 'friends', label: 'Friends Activity', icon: 'people-outline', color: '#34C759' },
  { key: 'nearby', label: 'Nearby', icon: 'location-outline', color: '#FF9500' },
  { key: 'trending', label: 'Trending', icon: 'trending-up-outline', color: '#FF3B30' },
  { key: 'weather', label: 'Weather Perfect', icon: 'partly-sunny-outline', color: '#00C9FF' }
];

export default function SmartEventDiscovery({ navigation, currentUserId }) {
  const [activeCategory, setActiveCategory] = useState('smart');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [weatherData, setWeatherData] = useState(null);

  useEffect(() => {
    fetchDiscoveryEvents();
    getCurrentLocationAndWeather();
  }, [activeCategory]);

  const getCurrentLocationAndWeather = async () => {
    try {
      const mockLocation = {
        coordinates: [-74.006, 40.7128], // NYC coordinates
        city: 'New York'
      };
      
      const mockWeather = {
        temperature: 22,
        condition: 'sunny',
        humidity: 65,
        description: 'Perfect weather for outdoor activities!'
      };

      setUserLocation(mockLocation);
      setWeatherData(mockWeather);
    } catch (error) {
      console.log('Location/Weather fetch failed:', error);
    }
  };

  const fetchDiscoveryEvents = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      let endpoint = '/api/events';
      let params = { limit: 20 };

      switch (activeCategory) {
        case 'smart':
          endpoint = '/api/events/recommendations';
          if (userLocation) {
            params.location = JSON.stringify(userLocation);
          }
          if (weatherData) {
            params.weather = JSON.stringify(weatherData);
          }
          break;
        
        case 'friends':
          endpoint = '/api/events/friends-activity';
          params.limit = 15;
          break;
        
        case 'nearby':
          if (userLocation) {
            params.location = JSON.stringify(userLocation);
            params.radius = 25; // 25km radius
          }
          break;
        
        case 'trending':
          params.sortBy = 'popularity';
          params.timeframe = 'week';
          break;
        
        case 'weather':
          if (weatherData) {
            params.weather = JSON.stringify(weatherData);
            params.weatherOptimized = true;
          }
          break;
      }

      const { data } = await api.get(endpoint, { params });
      setEvents(data || []);

    } catch (error) {
      console.error('Discovery fetch error:', error);
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAttend = async (event) => {
    try {
      await api.post(`/api/events/attend/${event._id}`);
      fetchDiscoveryEvents(true); // Refresh to show updated state
    } catch (error) {
      console.error('Attend event error:', error);
    }
  };

  const renderCategoryTab = ({ item }) => {
    const isActive = activeCategory === item.key;
    
    return (
      <TouchableOpacity
        style={[
          styles.categoryTab,
          isActive && [styles.activeCategoryTab, { borderBottomColor: item.color }]
        ]}
        onPress={() => setActiveCategory(item.key)}
        activeOpacity={0.8}
      >
        <Ionicons 
          name={item.icon} 
          size={20} 
          color={isActive ? item.color : '#8E8E93'} 
        />
        <Text style={[
          styles.categoryTabText,
          isActive && [styles.activeCategoryTabText, { color: item.color }]
        ]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEventCard = ({ item, index }) => (
    <View style={[
      styles.eventCardContainer,
      index % 2 === 0 ? styles.leftCard : styles.rightCard
    ]}>
      <EventCard
        event={item}
        currentUserId={currentUserId}
        navigation={navigation}
        onAttend={handleAttend}
        compact={false}
        showRecommendationReason={activeCategory === 'smart'}
      />
    </View>
  );

  const renderDiscoveryHeader = () => {
    const currentCategory = DISCOVERY_CATEGORIES.find(c => c.key === activeCategory);
    
    return (
      <View style={styles.discoveryHeader}>
        <View style={styles.headerTitleContainer}>
          <Ionicons 
            name={currentCategory?.icon || 'star-outline'} 
            size={24} 
            color={currentCategory?.color || '#3797EF'} 
          />
          <Text style={styles.headerTitle}>
            {getHeaderTitle()}
          </Text>
        </View>
        <Text style={styles.headerSubtitle}>
          {getHeaderSubtitle()}
        </Text>
        {renderWeatherBanner()}
      </View>
    );
  };

  const getHeaderTitle = () => {
    switch (activeCategory) {
      case 'smart': return 'Recommended for You';
      case 'friends': return 'Friend Activity';
      case 'nearby': return 'Events Near You';
      case 'trending': return 'Trending Events';
      case 'weather': return 'Perfect Weather Events';
      default: return 'Discover Events';
    }
  };

  const getHeaderSubtitle = () => {
    switch (activeCategory) {
      case 'smart': return 'Personalized recommendations based on your interests and activity';
      case 'friends': return 'See what your friends are attending and hosting';
      case 'nearby': return userLocation ? `Events within 25km of ${userLocation.city}` : 'Events in your area';
      case 'trending': return 'Popular events everyone\'s talking about this week';
      case 'weather': return weatherData ? `Perfect for today's ${weatherData.condition} weather` : 'Weather-optimized event suggestions';
      default: return 'Find events you\'ll love';
    }
  };

  const renderWeatherBanner = () => {
    if (activeCategory !== 'weather' || !weatherData) return null;

    return (
      <View style={styles.weatherBanner}>
        <Ionicons name="partly-sunny" size={20} color="#00C9FF" />
        <Text style={styles.weatherText}>
          {weatherData.temperature}°C • {weatherData.description}
        </Text>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons 
        name={DISCOVERY_CATEGORIES.find(c => c.key === activeCategory)?.icon || 'calendar-outline'} 
        size={80} 
        color="#C7C7CC" 
      />
      <Text style={styles.emptyTitle}>
        {getEmptyStateTitle()}
      </Text>
      <Text style={styles.emptySubtitle}>
        {getEmptyStateSubtitle()}
      </Text>
      {activeCategory === 'friends' && (
        <TouchableOpacity 
          style={styles.emptyActionButton}
          onPress={() => navigation.navigate('SearchScreen')}
          activeOpacity={0.8}
        >
          <Text style={styles.emptyActionText}>Find Friends to Follow</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const getEmptyStateTitle = () => {
    switch (activeCategory) {
      case 'smart': return 'No recommendations yet';
      case 'friends': return 'No friend activity';
      case 'nearby': return 'No nearby events';
      case 'trending': return 'No trending events';
      case 'weather': return 'No weather-perfect events';
      default: return 'No events found';
    }
  };

  const getEmptyStateSubtitle = () => {
    switch (activeCategory) {
      case 'smart': return 'Attend a few events to get better recommendations';
      case 'friends': return 'Follow friends to see their event activity here';
      case 'nearby': return 'Try expanding your search radius or check back later';
      case 'trending': return 'Check back later for popular events';
      case 'weather': return 'No events optimized for current weather conditions';
      default: return 'Try a different category or check back later';
    }
  };

  if (loading && events.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Discovering amazing events...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Category Tabs */}
      <FlatList
        data={DISCOVERY_CATEGORIES}
        renderItem={renderCategoryTab}
        keyExtractor={item => item.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryTabs}
      />

      {/* Events List */}
      <FlatList
        data={events}
        renderItem={renderEventCard}
        keyExtractor={item => item._id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchDiscoveryEvents(true)}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
      }
      ListHeaderComponent={renderDiscoveryHeader}
      ListEmptyComponent={renderEmptyState}
      contentContainerStyle={[
        styles.eventsList,
        events.length === 0 && styles.emptyList
      ]}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },

  // Category Tabs
  categoryTabs: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeCategoryTab: {
    backgroundColor: '#F0F8FF',
    borderBottomWidth: 2,
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginLeft: 6,
  },
  activeCategoryTabText: {
    fontWeight: '600',
  },

  // Discovery Header
  discoveryHeader: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginLeft: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },

  // Weather Banner
  weatherBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FBFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  weatherText: {
    fontSize: 14,
    color: '#00C9FF',
    fontWeight: '500',
    marginLeft: 8,
  },

  // Events List
  eventsList: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  eventRow: {
    justifyContent: 'space-between',
  },
  eventCardContainer: {
    width: (SCREEN_WIDTH - 32) / 2,
    marginBottom: 16,
  },
  leftCard: {
    marginRight: 8,
  },
  rightCard: {
    marginLeft: 8,
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyActionButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyList: {
    flexGrow: 1,
  },
});