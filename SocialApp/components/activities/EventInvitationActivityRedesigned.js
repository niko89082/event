// components/activities/EventInvitationActivityRedesigned.js - Redesigned to match new style
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
import ActivityHeaderRedesigned from './ActivityHeaderRedesigned';
import ActivityActionButton from './ActivityActionButton';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const EventInvitationActivityRedesigned = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp, user } = activity;
  const { event, invitedBy, inviterCount, isGrouped } = data;

  const inviter = invitedBy || user;
  
  if (!inviter) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Invitation data unavailable</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.container}>
        <ActivityHeaderRedesigned
          user={inviter}
          timestamp={timestamp}
          activityType="event_invitation"
          onUserPress={(userId) => navigation.navigate('ProfileScreen', { userId })}
        />
        <Text style={styles.errorText}>Event information unavailable</Text>
      </View>
    );
  }

  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `http://${API_BASE_URL}:3000${cleanPath}`;
  };

  const handleAccept = () => {
    onAction(activity._id, 'accept_event_invitation', { eventId: event._id });
  };

  const handleDecline = () => {
    onAction(activity._id, 'decline_event_invitation', { eventId: event._id });
  };

  const handleViewEvent = () => {
    navigation.navigate('EventDetailsScreen', { eventId: event._id });
  };

  const handleViewProfile = (userId) => {
    navigation.navigate('ProfileScreen', { userId });
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

  const getActivityText = () => {
    if (isGrouped && inviterCount > 1) {
      return (
        <Text style={styles.activityText}>
          <Text style={styles.boldText}>{inviter.username}</Text>
          <Text> and </Text>
          <Text style={styles.boldText}>{inviterCount - 1} other{inviterCount - 1 > 1 ? 's' : ''}</Text>
          <Text> invited you</Text>
        </Text>
      );
    }
    return (
      <Text style={styles.activityText}>
        <Text style={styles.boldText}>{inviter.username}</Text>
        <Text> invited you</Text>
      </Text>
    );
  };

  return (
    <View style={styles.container}>
      {/* Activity Header */}
      <ActivityHeaderRedesigned
        user={inviter}
        timestamp={timestamp}
        activityType="event_invitation"
        onUserPress={handleViewProfile}
      />

      {/* Activity Text */}
      <View style={styles.activityTextContainer}>
        {getActivityText()}
      </View>

      {/* Event Card - Horizontal Layout */}
      <TouchableOpacity 
        style={styles.eventCard}
        onPress={handleViewEvent}
        activeOpacity={0.95}
      >
        {/* Event Image - Left Side */}
        <View style={styles.eventImageContainer}>
          {event.coverImage ? (
            <Image
              source={{ uri: getImageUrl(event.coverImage) }}
              style={styles.eventImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.eventImage, styles.placeholderImage]}>
              <Ionicons name="calendar" size={32} color="#C7C7CC" />
            </View>
          )}
        </View>

        {/* Event Info - Right Side */}
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {event.title}
          </Text>
          
          <View style={styles.eventDetails}>
            <View style={styles.eventDetailRow}>
              <Ionicons name="calendar-outline" size={14} color="#8E8E93" />
              <Text style={styles.eventDetailText}>
                {formatEventTime(event.time)}
              </Text>
            </View>
            
            {event.location && (
              <View style={styles.eventDetailRow}>
                <Ionicons name="location-outline" size={14} color="#8E8E93" />
                <Text style={styles.eventDetailText} numberOfLines={1}>
                  {event.location}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.declineButton}
          onPress={handleDecline}
          activeOpacity={0.7}
        >
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={handleAccept}
          activeOpacity={0.7}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  activityTextContainer: {
    paddingLeft: 58, // Match PostActivityComponent alignment
    paddingRight: 20,
    paddingTop: 0,
    paddingBottom: 12,
  },
  activityText: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 20,
  },
  boldText: {
    fontWeight: '700',
    color: '#000000',
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginLeft: 58, // Match PostActivityComponent alignment
    marginRight: 20,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  eventImageContainer: {
    width: 120,
    height: 120,
  },
  eventImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F2F2F7',
  },
  placeholderImage: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    lineHeight: 20,
  },
  eventDetails: {
    gap: 6,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventDetailText: {
    fontSize: 13,
    color: '#8E8E93',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  declineButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlign: 'center',
  },
});

export default EventInvitationActivityRedesigned;

