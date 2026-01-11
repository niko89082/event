// components/events/FeaturedEventsSection.js - Horizontal scrolling featured events
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FeaturedEventCard from './FeaturedEventCard';
import CreateEventCard from './CreateEventCard';
import api from '../../services/api';
import { getMockFeaturedEvents } from './templates/MockEventData';

export default function FeaturedEventsSection({ navigation, useMockData = false }) {
  const [featuredEvents, setFeaturedEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (useMockData) {
      setFeaturedEvents(getMockFeaturedEvents());
      setLoading(false);
    } else {
      fetchFeaturedEvents();
    }
  }, [useMockData]);

  const fetchFeaturedEvents = async () => {
    try {
      setLoading(true);
      // Try to fetch featured events from backend
      try {
        const response = await api.get('/api/events/featured?limit=3');
        
        // Check if response is an error (401, 403, etc.) before using data
        if (response.status >= 400) {
          throw new Error(`API error: ${response.status}`);
        }
        
        if (response.data && response.data.events && Array.isArray(response.data.events)) {
          setFeaturedEvents(response.data.events);
        } else {
          // Fallback to mock data if endpoint doesn't exist or returns invalid data
          setFeaturedEvents(getMockFeaturedEvents());
        }
      } catch (error) {
        // If endpoint doesn't exist or returns error, use mock data
        console.log('Featured events endpoint not available, using mock data:', error.message);
        setFeaturedEvents(getMockFeaturedEvents());
      }
    } catch (error) {
      console.error('Error fetching featured events:', error);
      setFeaturedEvents(getMockFeaturedEvents());
    } finally {
      setLoading(false);
    }
  };

  const handleSeeAll = () => {
    // TODO: Navigate to featured events list screen
    console.log('See All featured events');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Featured Events</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#3797EF" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Featured Events</Text>
        <TouchableOpacity 
          onPress={handleSeeAll} 
          activeOpacity={0.7}
          style={styles.seeAllButton}
        >
          <Text style={styles.seeAll}>See All</Text>
          <Ionicons name="chevron-forward" size={16} color="#3797EF" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
        nestedScrollEnabled={true}
        directionalLockEnabled={true}
        scrollEnabled={true}
      >
        {featuredEvents.map((event) => (
          <FeaturedEventCard
            key={event._id}
            event={event}
            navigation={navigation}
          />
        ))}
        <CreateEventCard navigation={navigation} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 24,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.2,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(55, 151, 239, 0.1)',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 4,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
});

