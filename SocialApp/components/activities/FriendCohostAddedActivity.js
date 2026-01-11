// components/activities/FriendCohostAddedActivity.js - Friend Co-host Added Activity
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
import api from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const EVENT_IMAGE_WIDTH = SCREEN_WIDTH - 32;
const EVENT_IMAGE_HEIGHT = 160;

const FriendCohostAddedActivity = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp, user } = activity;
  
  // Safety checks
  if (!data) {
    console.error('❌ FriendCohostAddedActivity: No data found', { activity });
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Activity data unavailable</Text>
      </View>
    );
  }
  
  const { event, host, cohost } = data;
  
  // Use cohost as the primary user (the one who was added as cohost)
  const cohostUser = cohost || user;
  const eventHost = host;

  // Safety check for event
  if (!event) {
    console.error('❌ FriendCohostAddedActivity: No event data found', { activity });
    return (
      <View style={styles.container}>
        <ActivityHeader
          user={cohostUser}
          timestamp={timestamp}
          activityType="friend_cohost_added"
          onUserPress={() => navigation.navigate('ProfileScreen', { userId: cohostUser._id })}
        />
        <Text style={styles.errorText}>Event information unavailable</Text>
      </View>
    );
  }

  const handleViewEvent = () => {
    navigation.navigate('EventDetailsScreen', { eventId: event._id });
  };

  const handleViewCohost = () => {
    if (cohostUser?._id) {
      navigation.navigate('ProfileScreen', { userId: cohostUser._id });
    }
  };

  const handleViewHost = () => {
    if (eventHost?._id) {
      navigation.navigate('ProfileScreen', { userId: eventHost._id });
    }
  };

  const formatEventTime = (eventTime) => {
    if (!eventTime) return 'Date TBD';
    
    const date = new Date(eventTime);
    const now = new Date();
    const diffTime = date - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else if (diffDays > 0) {
      return `In ${diffDays} days`;
    } else {
      return 'Past event';
    }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Music': 'musical-notes-outline',
      'Sports': 'football-outline',
      'Food': 'restaurant-outline',
      'Art': 'brush-outline',
      'Technology': 'laptop-outline',
      'Education': 'school-outline',
      'Health': 'fitness-outline',
      'Business': 'briefcase-outline',
      'Social': 'people-outline',
      'Other': 'ellipse-outline'
    };
    return icons[category] || 'calendar-outline';
  };

  return (
    <View style={styles.container}>
      {/* Activity Header */}
      <ActivityHeader
        user={cohostUser}
        timestamp={timestamp}
        activityType="friend_cohost_added"
        onUserPress={handleViewCohost}
        customIcon={{ name: 'person-add-outline', color: '#5856D6' }}
      />

      {/* Message */}
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>
          <Text 
            style={styles.boldText}
            onPress={handleViewCohost}
          >
            {cohostUser?.username || 'Someone'}
          </Text>
          <Text> was added as co-host by </Text>
          <Text 
            style={styles.boldText}
            onPress={handleViewHost}
          >
            {eventHost?.username || 'the host'}
          </Text>
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

        {/* Event Info */}
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {event.title}
          </Text>
          
          <View style={styles.eventMeta}>
            {/* Date & Time */}
            {event.time && (
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={16} color="#8E8E93" />
                <Text style={styles.metaText}>
                  {formatEventTime(event.time)}
                </Text>
              </View>
            )}

            {/* Location */}
            {event.location && (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={16} color="#8E8E93" />
                <Text style={styles.metaText} numberOfLines={1}>
                  {event.location}
                </Text>
              </View>
            )}

            {/* Co-host Badge */}
            <View style={styles.metaRow}>
              <Ionicons name="person-add-outline" size={16} color="#5856D6" />
              <Text style={[styles.metaText, styles.cohostText]}>
                Co-host
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
  },
  
  // Message
  messageContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  messageText: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 22,
  },
  boldText: {
    fontWeight: '600',
    color: '#5856D6',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlign: 'center',
  },

  // Event Card
  eventCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F2F2F7',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  // Event Image
  eventImage: {
    width: '100%',
    height: EVENT_IMAGE_HEIGHT,
    backgroundColor: '#F6F6F6',
  },
  placeholderImage: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Event Info
  eventInfo: {
    padding: 16,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
    lineHeight: 24,
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
  cohostText: {
    color: '#5856D6',
    fontWeight: '500',
  },
});

export default FriendCohostAddedActivity;


