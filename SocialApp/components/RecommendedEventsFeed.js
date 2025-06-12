// components/RecommendedEventsFeed.js - Enhanced For You feed
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import api from '../services/api';
import EventCard from './EventCard';

export default function RecommendedEventsFeed({ navigation, currentUserId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [userLocation]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        
        setUserLocation({
          coordinates: [location.coords.longitude, location.coords.latitude],
          city: 'Current Location'
        });
      } else {
        // Fallback to recommendations without location
        fetchRecommendations();
      }
    } catch (error) {
      console.log('Location permission error:', error);
      fetchRecommendations();
    }
  };

  const fetchRecommendations = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const params = { limit: 20 };
      
      // Add location if available
      if (userLocation) {
        params.location = JSON.stringify(userLocation);
      }

      const { data } = await api.get('/api/events/recommendations', { params });
      setEvents(data || []);

    } catch (error) {
      console.error('Recommendations fetch error:', error);
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAttend = async (event) => {
    try {
      await api.post(`/api/events/attend/${event._id}`);
      fetchRecommendations(true);
    } catch (error) {
      console.error('Attend event error:', error);
    }
  };

  const handleLocationRequest = () => {
    Alert.alert(
      'Enable Location',
      'Allow location access to get personalized event recommendations near you.',
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Enable', onPress: requestLocationPermission }
      ]
    );
  };

  const renderEvent = ({ item }) => (
    <View style={styles.eventWrapper}>
      <EventCard
        event={item}
        currentUserId={currentUserId}
        navigation={navigation}
        onAttend={handleAttend}
        showRecommendationReason={true}
        compact={false}
      />
    </View>
  );

  const renderLocationBanner = () => {
    if (locationPermission === 'granted' || locationPermission === null) {
      return null;
    }

    return (
      <TouchableOpacity
        style={styles.locationBanner}
        onPress={handleLocationRequest}
        activeOpacity={0.8}
      >
        <View style={styles.locationBannerContent}>
          <Ionicons name="location-outline" size={20} color="#3797EF" />
          <View style={styles.locationBannerText}>
            <Text style={styles.locationBannerTitle}>Get Better Recommendations</Text>
            <Text style={styles.locationBannerSubtitle}>
              Enable location to see events near you
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Recommended for You</Text>
      <Text style={styles.headerSubtitle}>
        {userLocation 
          ? `Events personalized for you ${userLocation.city !== 'Current Location' ? `in ${userLocation.city}` : 'nearby'}`
          : 'Events based on your interests and activity'
        }
      </Text>
      {renderLocationBanner()}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="star-outline" size={64} color="#C7C7CC" />
      </View>
      <Text style={styles.emptyTitle}>No recommendations yet</Text>
      <Text style={styles.emptySubtitle}>
        {userLocation 
          ? 'Attend a few events to get better recommendations'
          : 'Enable location or attend events to get personalized recommendations'
        }
      </Text>
      
      {!userLocation && locationPermission !== 'granted' && (
        <TouchableOpacity
          style={styles.enableLocationButton}
          onPress={handleLocationRequest}
          activeOpacity={0.8}
        >
          <Ionicons name="location" size={20} color="#FFFFFF" />
          <Text style={styles.enableLocationButtonText}>Enable Location</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading && events.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Finding events for you...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={item => item._id}
        renderItem={renderEvent}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!loading ? renderEmptyState : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchRecommendations(true)}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          events.length === 0 && styles.emptyListContent
        ]}
        numColumns={2}
        columnWrapperStyle={events.length > 0 ? styles.row : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },

  // Header
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },

  // Location Banner
  locationBanner: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E1E8F7',
  },
  locationBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationBannerText: {
    flex: 1,
    marginLeft: 12,
  },
  locationBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
    marginBottom: 2,
  },
  locationBannerSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
  },

  // List
  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  eventWrapper: {
    width: '48%',
    marginBottom: 16,
  },

  // Empty State
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
    marginBottom: 32,
  },
  enableLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  enableLocationButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});