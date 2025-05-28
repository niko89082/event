// components/SharedEventSnippet.js - FIXED API route
import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function SharedEventSnippet({ message, senderName }) {
  const navigation = useNavigation();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (message.shareId) {
      fetchEvent(message.shareId);
    }
  }, [message]);

  const fetchEvent = async (eventId) => {
    try {
      console.log('🟡 SharedEventSnippet: Fetching event:', eventId);
      // FIXED: Use the correct API route with /api prefix
      const res = await api.get(`/api/events/${eventId}`);
      console.log('🟢 SharedEventSnippet: Event loaded successfully');
      setEvent(res.data);
    } catch (err) {
      console.error('❌ SharedEventSnippet => fetch error:', err.response?.data || err.message);
      if (err.response?.status === 401) {
        setError('This event is private. You do not have access.');
      } else if (err.response?.status === 404) {
        setError('Event not found or no longer available.');
      } else {
        setError('Could not load event.');
      }
    }
  };

  const handleViewEvent = () => {
    if (!event) return;
    navigation.navigate('EventDetailsScreen', { eventId: event._id });
  };

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.sender}>{senderName} shared an event...</Text>
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={20} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.container}>
        <Text style={styles.sender}>{senderName} shared an event...</Text>
        <Text style={styles.loadingText}>Loading event...</Text>
      </View>
    );
  }

  // FIXED: Better cover image handling
  let coverUrl = null;
  if (event.coverImage) {
    coverUrl = event.coverImage.startsWith('http')
      ? event.coverImage
      : `http://${API_BASE_URL}:3000${event.coverImage}`;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sender}>{senderName} shared an event:</Text>
      
      <TouchableOpacity 
        style={styles.eventCard} 
        onPress={handleViewEvent}
        activeOpacity={0.8}
      >
        {coverUrl && (
          <Image 
            source={{ uri: coverUrl }} 
            style={styles.eventImage}
            resizeMode="cover"
          />
        )}
        
        <View style={styles.eventContent}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {event.title}
          </Text>
          
          <View style={styles.eventDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={14} color="#8E8E93" />
              <Text style={styles.detailText} numberOfLines={1}>
                {event.location}
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={14} color="#8E8E93" />
              <Text style={styles.detailText}>
                {new Date(event.time).toLocaleDateString()}
              </Text>
            </View>
            
            {event.attendees?.length > 0 && (
              <View style={styles.detailRow}>
                <Ionicons name="people-outline" size={14} color="#8E8E93" />
                <Text style={styles.detailText}>
                  {event.attendees.length} attending
                </Text>
              </View>
            )}
          </View>
          
          {event.price > 0 && (
            <View style={styles.priceTag}>
              <Text style={styles.priceText}>${event.price}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    marginVertical: 6,
    borderRadius: 12,
    maxWidth: '80%',
  },
  sender: {
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  eventImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#F6F6F6',
  },
  eventContent: {
    padding: 12,
    position: 'relative',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    lineHeight: 20,
  },
  eventDetails: {
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  detailText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 6,
    flex: 1,
  },
  priceTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#34C759',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priceText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  loadingText: {
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
});