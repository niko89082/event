// components/EventDiscoverySuggestions.js - Event Discovery Component
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';

export default function EventDiscoverySuggestions({ navigation }) {
  const { currentUser } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [joiningEvents, setJoiningEvents] = useState(new Set());

  useEffect(() => {
    // Only fetch if user is authenticated
    if (currentUser?._id) {
      fetchEventRecommendations();
    }
  }, [currentUser?._id]);

  const fetchEventRecommendations = async () => {
    try {
      setLoading(true);
      
      // Fetch event recommendations from the API
      const response = await api.get('/api/events/recommendations', {
        params: { limit: 3 } // Show 3 events max
      });
      
      setEvents(response.data.events || []);
    } catch (error) {
      console.error('Error fetching event recommendations:', error);
      // Don't show error to user, just use empty array
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const getMockEvents = () => [
    {
      _id: 'mock_event_1',
      title: 'Tech Meetup 2024',
      description: 'Join us for an evening of networking and tech talks',
      coverImage: null,
      time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      location: 'San Francisco, CA',
      attendees: ['user1', 'user2', 'user3'],
      category: 'Technology'
    },
    {
      _id: 'mock_event_2',
      title: 'Art Gallery Opening',
      description: 'Contemporary art exhibition featuring local artists',
      coverImage: null,
      time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      location: 'Downtown Gallery',
      attendees: ['user4', 'user5'],
      category: 'Arts'
    },
    {
      _id: 'mock_event_3',
      title: 'Fitness Bootcamp',
      description: 'High-intensity workout session in the park',
      coverImage: null,
      time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      location: 'Central Park',
      attendees: ['user6', 'user7', 'user8', 'user9'],
      category: 'Fitness'
    }
  ];

  const handleJoinEvent = async (event) => {
    try {
      setJoiningEvents(prev => new Set(prev).add(event._id));
      
      await api.post(`/api/events/attend/${event._id}`);
      
      Alert.alert(
        'Event Joined!',
        `You're now attending ${event.title}.`,
        [{ text: 'OK' }]
      );
      
      // Remove from recommendations
      setEvents(prev => prev.filter(e => e._id !== event._id));
      
    } catch (error) {
      console.error('Error joining event:', error);
      Alert.alert(
        'Error',
        'Failed to join event. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setJoiningEvents(prev => {
        const newSet = new Set(prev);
        newSet.delete(event._id);
        return newSet;
      });
    }
  };

  const formatEventTime = (time) => {
    const now = new Date();
    const eventTime = new Date(time);
    const diffDays = Math.ceil((eventTime - now) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `In ${diffDays} days`;
    
    return eventTime.toLocaleDateString();
  };

  const renderEventCard = (event) => {
    const isJoining = joiningEvents.has(event._id);
    const attendeeCount = event.attendees?.length || 0;
    
    return (
      <View key={event._id} style={styles.eventCard}>
        <View style={styles.eventImageContainer}>
          {event.coverImage ? (
            <Image 
              source={{ uri: event.coverImage }} 
              style={styles.eventImage}
            />
          ) : (
            <View style={styles.defaultEventImage}>
              <Ionicons name="calendar-outline" size={24} color="#8E8E93" />
            </View>
          )}
        </View>
        
        <View style={styles.eventDetails}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.eventDescription} numberOfLines={2}>
            {event.description}
          </Text>
          
          <View style={styles.eventMeta}>
            <View style={styles.eventMetaItem}>
              <Ionicons name="time-outline" size={14} color="#8E8E93" />
              <Text style={styles.eventMetaText}>{formatEventTime(event.time)}</Text>
            </View>
            
            <View style={styles.eventMetaItem}>
              <Ionicons name="location-outline" size={14} color="#8E8E93" />
              <Text style={styles.eventMetaText} numberOfLines={1}>
                {event.location}
              </Text>
            </View>
            
            <View style={styles.eventMetaItem}>
              <Ionicons name="people-outline" size={14} color="#8E8E93" />
              <Text style={styles.eventMetaText}>
                {attendeeCount} {attendeeCount === 1 ? 'person' : 'people'}
              </Text>
            </View>
          </View>
        </View>
        
        <TouchableOpacity
          style={[
            styles.joinButton,
            isJoining && styles.joinButtonDisabled
          ]}
          onPress={() => handleJoinEvent(event)}
          disabled={isJoining}
          activeOpacity={0.7}
        >
          {isJoining ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.joinButtonText}>Join</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (events.length === 0) {
    return null; // Don't show anything if no events
  }

  // Don't show anything if user is not authenticated
  if (!currentUser?._id) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover Events</Text>
        <TouchableOpacity
          style={styles.seeAllButton}
          onPress={() => navigation.navigate('SearchScreen', { tab: 'events' })}
          activeOpacity={0.7}
        >
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled={false}
        scrollEventThrottle={16}
      >
        {events.map(event => renderEventCard(event))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  
  seeAllButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  
  seeAllText: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '500',
  },
  
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  
  eventCard: {
    width: 200,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
  },
  
  eventImageContainer: {
    marginBottom: 8,
  },
  
  eventImage: {
    width: '100%',
    height: 80,
    borderRadius: 6,
  },
  
  defaultEventImage: {
    width: '100%',
    height: 80,
    borderRadius: 6,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  eventDetails: {
    flex: 1,
    marginBottom: 8,
  },
  
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  
  eventDescription: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 16,
    marginBottom: 8,
  },
  
  eventMeta: {
    gap: 4,
  },
  
  eventMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  
  eventMetaText: {
    fontSize: 11,
    color: '#8E8E93',
    flex: 1,
  },
  
  joinButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: 'center',
  },
  
  joinButtonDisabled: {
    backgroundColor: '#8E8E93',
  },
  
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  
  
});
