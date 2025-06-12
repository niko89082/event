// components/NearbyEventsFeed.js - Location-based events feed
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import api from '../services/api';
import EventCard from './EventCard';

export default function NearbyEventsFeed({ navigation, currentUserId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [radius, setRadius] = useState(25); // km
  const [showRadiusControl, setShowRadiusControl] = useState(false);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  useEffect(() => {
    if (userLocation) {
      fetchNearbyEvents();
    }
  }, [userLocation, radius]);

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
          accuracy: location.coords.accuracy
        });
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.log('Location permission error:', error);
      setLoading(false);
    }
  };

  const fetchNearbyEvents = async (isRefresh = false) => {
    if (!userLocation) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const { data } = await api.get('/api/events', {
        params: {
          location: JSON.stringify(userLocation),
          radius: radius,
          limit: 20
        }
      });

      setEvents(data.events || data || []);

    } catch (error) {
      console.error('Nearby events fetch error:', error);
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAttend = async (event) => {
    try {
      await api.post(`/api/events/attend/${event._id}`);
      fetchNearbyEvents(true);
    } catch (error) {
      console.error('Attend event error:', error);
    }
  };

  const handleLocationRequest = () => {
    Alert.alert(
      'Enable Location',
      'Allow location access to discover events near you.',
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
        compact={false}
      />
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.headerTitle}>Events Near You</Text>
        {userLocation && (
          <TouchableOpacity
            style={styles.radiusButton}
            onPress={() => setShowRadiusControl(!showRadiusControl)}
            activeOpacity={0.8}
          >
            <Ionicons name="options-outline" size={20} color="#3797EF" />
            <Text style={styles.radiusButtonText}>{radius}km</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <Text style={styles.headerSubtitle}>
        {userLocation 
          ? `Showing events within ${radius}km of your location`
          : 'Enable location to see events near you'
        }
      </Text>

      {/* Radius Control - Simplified without Slider */}
      {showRadiusControl && userLocation && (
        <View style={styles.radiusControl}>
          <Text style={styles.radiusControlLabel}>Search radius</Text>
          <View style={styles.radiusOptions}>
            {[10, 25, 50, 100].map(option => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.radiusOption,
                  radius === option && styles.activeRadiusOption
                ]}
                onPress={() => setRadius(option)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.radiusOptionText,
                  radius === option && styles.activeRadiusOptionText
                ]}>
                  {option}km
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const renderLocationPermissionRequest = () => (
    <View style={styles.permissionContainer}>
      <View style={styles.permissionIconContainer}>
        <Ionicons name="location-outline" size={64} color="#C7C7CC" />
      </View>
      <Text style={styles.permissionTitle}>Location Access Required</Text>
      <Text style={styles.permissionSubtitle}>
        We need your location to show you events happening nearby. Your location is only used to find relevant events.
      </Text>
      
      <TouchableOpacity
        style={styles.enableLocationButton}
        onPress={handleLocationRequest}
        activeOpacity={0.8}
      >
        <Ionicons name="location" size={20} color="#FFFFFF" />
        <Text style={styles.enableLocationButtonText}>Enable Location</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.skipLocationButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <Text style={styles.skipLocationButtonText}>Maybe Later</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="location-outline" size={64} color="#C7C7CC" />
      </View>
      <Text style={styles.emptyTitle}>No events nearby</Text>
      <Text style={styles.emptySubtitle}>
        Try increasing your search radius or check back later
      </Text>
      
      <TouchableOpacity
        style={styles.increaseRadiusButton}
        onPress={() => {
          setRadius(Math.min(radius + 25, 100));
          setShowRadiusControl(true);
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="expand-outline" size={20} color="#3797EF" />
        <Text style={styles.increaseRadiusButtonText}>Expand Search Area</Text>
      </TouchableOpacity>
    </View>
  );

  // Show location permission request if not granted
  if (locationPermission !== 'granted' && locationPermission !== null) {
    return renderLocationPermissionRequest();
  }

  // Show loading while getting location
  if (loading && !userLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  // Show loading while fetching events
  if (loading && events.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Finding nearby events...</Text>
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
            onRefresh={() => fetchNearbyEvents(true)}
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
  },
  radiusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E1E8F7',
  },
  radiusButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
    marginLeft: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },

  // Radius Control - Simplified
  radiusControl: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  radiusControlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  radiusOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  radiusOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    alignItems: 'center',
  },
  activeRadiusOption: {
    backgroundColor: '#3797EF',
    borderColor: '#3797EF',
  },
  radiusOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  activeRadiusOptionText: {
    color: '#FFFFFF',
    fontWeight: '600',
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

  // Permission Request
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#F8F9FA',
  },
  permissionIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionSubtitle: {
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
    marginBottom: 12,
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
  skipLocationButton: {
    paddingVertical: 12,
  },
  skipLocationButtonText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
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
  increaseRadiusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
  },
  increaseRadiusButtonText: {
    color: '#3797EF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});