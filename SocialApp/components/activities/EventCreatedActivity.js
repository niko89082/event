// components/activities/EventCreatedActivity.js - Event Created Activity Card
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ActivityHeader from './ActivityHeader';
import ActivityActionButton from './ActivityActionButton';
import api from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const EVENT_IMAGE_WIDTH = SCREEN_WIDTH - 32;
const EVENT_IMAGE_HEIGHT = 160;

const EventCreatedActivity = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp } = activity;
  const { event } = data;
  const creator = activity.user;

  const handleViewEvent = () => {
    navigation.navigate('EventDetailsScreen', { eventId: event._id });
  };

  const handleViewProfile = () => {
    navigation.navigate('ProfileScreen', { userId: creator._id });
  };

  const handleJoinEvent = () => {
    onAction(activity._id, 'join_event', { eventId: event._id });
  };

  const formatEventTime = (eventTime) => {
    const date = new Date(eventTime);
    const now = new Date();
    const diffTime = date - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays <= 7) {
      return `In ${diffDays} days`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const getPrivacyIcon = (privacyLevel) => {
    switch (privacyLevel) {
      case 'public':
        return { name: 'globe-outline', color: '#34C759' };
      case 'friends':
        return { name: 'people-outline', color: '#FF9500' };
      case 'private':
        return { name: 'lock-closed-outline', color: '#FF3B30' };
      default:
        return { name: 'globe-outline', color: '#34C759' };
    }
  };

  const getCategoryIcon = (category) => {
    const categoryIcons = {
      'Party': 'musical-notes-outline',
      'Business': 'briefcase-outline',
      'Sports': 'football-outline',
      'Arts': 'brush-outline',
      'Food': 'restaurant-outline',
      'Gaming': 'game-controller-outline',
      'General': 'calendar-outline',
    };
    return categoryIcons[category] || 'calendar-outline';
  };

  const privacyIcon = getPrivacyIcon(event.privacyLevel);

  return (
    <View style={styles.container}>
      {/* Activity Header */}
      <ActivityHeader
        user={creator}
        timestamp={timestamp}
        activityType="event_created"
        onUserPress={handleViewProfile}
        customIcon={{ name: 'add-circle-outline', color: '#34C759' }}
      />

      {/* Creation Message */}
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>
          <Text style={styles.boldText}>{creator.username}</Text>
          <Text> created a new event</Text>
        </Text>
      </View>

      {/* Event Card */}
      <TouchableOpacity 
        style={styles.eventCard}
        onPress={handleViewEvent}
        activeOpacity={0.95}
      >
        {/* Event Cover Image */}
        {event.coverImage ? (
          <Image
            source={{ uri: `${api.defaults.baseURL}${event.coverImage}` }}
            style={styles.eventImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.eventImage, styles.placeholderImage]}>
            <Ionicons 
              name={getCategoryIcon(event.category)} 
              size={48} 
              color="#8E8E93" 
            />
          </View>
        )}

        {/* Event Overlay */}
        <View style={styles.eventOverlay}>
          {/* Privacy Badge */}
          <View style={styles.privacyBadge}>
            <Ionicons 
              name={privacyIcon.name} 
              size={12} 
              color={privacyIcon.color} 
            />
            <Text style={[styles.privacyText, { color: privacyIcon.color }]}>
              {event.privacyLevel}
            </Text>
          </View>
        </View>

        {/* Event Info */}
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {event.title}
          </Text>
          
          {event.description && (
            <Text style={styles.eventDescription} numberOfLines={2}>
              {event.description}
            </Text>
          )}

          <View style={styles.eventMeta}>
            {/* Date & Time */}
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={16} color="#8E8E93" />
              <Text style={styles.metaText}>
                {formatEventTime(event.time)}
              </Text>
            </View>

            {/* Location */}
            {event.location && (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={16} color="#8E8E93" />
                <Text style={styles.metaText} numberOfLines={1}>
                  {event.location}
                </Text>
              </View>
            )}

            {/* Attendees */}
            <View style={styles.metaRow}>
              <Ionicons name="people-outline" size={16} color="#8E8E93" />
              <Text style={styles.metaText}>
                {event.attendeeCount || 0} going
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <ActivityActionButton
          title="View Event"
          onPress={handleViewEvent}
          variant="secondary"
          icon="eye-outline"
          size="medium"
        />
        
        {/* Only show Join button if it's not the user's own event */}
        {creator._id !== currentUserId && (
          <ActivityActionButton
            title="Join Event"
            onPress={handleJoinEvent}
            variant="primary"
            icon="add-outline"
            size="medium"
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },

  // Message
  messageContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  messageText: {
    fontSize: 15,
    color: '#1C1C1E',
    lineHeight: 20,
  },
  boldText: {
    fontWeight: '600',
  },

  // Event Card
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },

  // Event Image
  eventImage: {
    width: '100%',
    height: EVENT_IMAGE_HEIGHT,
  },
  placeholderImage: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Event Overlay
  eventOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  privacyText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  // Event Info
  eventInfo: {
    padding: 16,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    lineHeight: 24,
    marginBottom: 6,
  },
  eventDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
    marginBottom: 12,
  },
  eventMeta: {
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
  },

  // Actions
  actionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
});

export default EventCreatedActivity;