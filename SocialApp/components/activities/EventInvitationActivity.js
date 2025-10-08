// components/activities/EventInvitationActivity.js - Event Invitation Activity Card
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const EVENT_IMAGE_WIDTH = SCREEN_WIDTH - 32;
const EVENT_IMAGE_HEIGHT = 200;

const EventInvitationActivity = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp, user } = activity;
  const { event, invitedBy, inviterCount, isGrouped } = data;

  // ✅ FIX: Handle both data formats - use invitedBy if available, fallback to user
  const inviter = invitedBy || user;
  
  // ✅ SAFETY CHECK: Ensure inviter exists
  if (!inviter) {
    console.error('❌ EventInvitationActivity: No inviter data found', { activity });
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Invitation data unavailable</Text>
      </View>
    );
  }

  // ✅ SAFETY CHECK: Ensure event exists
  if (!event) {
    console.error('❌ EventInvitationActivity: No event data found', { activity });
    return (
      <View style={styles.container}>
        <ActivityHeader
          user={inviter}
          timestamp={timestamp}
          activityType="event_invitation"
          onUserPress={() => navigation.navigate('ProfileScreen', { userId: inviter._id })}
        />
        <Text style={styles.errorText}>Event information unavailable</Text>
      </View>
    );
  }

  const handleAccept = () => {
    onAction(activity._id, 'accept_event_invitation', { eventId: event._id });
  };

  const handleDecline = () => {
    onAction(activity._id, 'decline_event_invitation', { eventId: event._id });
  };

  const handleViewEvent = () => {
    navigation.navigate('EventDetailsScreen', { eventId: event._id });
  };

  const handleViewProfile = () => {
    navigation.navigate('ProfileScreen', { userId: inviter._id });
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

  // ✅ IMPROVED: Handle grouped invitations
  const getInvitationMessage = () => {
    const username = inviter.username || inviter.displayName || 'Someone';
    const eventTitle = event.title || 'this event';
    
    if (isGrouped && inviterCount > 1) {
      if (inviterCount === 2) {
        return `${username} and 1 other invited you to ${eventTitle}`;
      } else {
        return `${username} and ${inviterCount - 1} others invited you to ${eventTitle}`;
      }
    } else {
      return `${username} invited you to ${eventTitle}`;
    }
  };

  return (
    <View style={styles.container}>
      {/* Activity Header */}
      <ActivityHeader
        user={inviter}
        timestamp={timestamp}
        activityType="event_invitation"
        onUserPress={handleViewProfile}
      />

      {/* Invitation Message */}
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>
          {getInvitationMessage()}
        </Text>
        {isGrouped && inviterCount > 1 && (
          <Text style={styles.groupedText}>
            {inviterCount} people invited you
          </Text>
        )}
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
            source={{ uri: event.coverImage }}
            style={styles.eventImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.eventImage, styles.placeholderImage]}>
            <Ionicons name="calendar" size={40} color="#C7C7CC" />
          </View>
        )}

        {/* Event Info */}
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {event.title}
          </Text>
          
          <View style={styles.eventDetails}>
            <View style={styles.eventDetailRow}>
              <Ionicons name="time" size={14} color="#8E8E93" />
              <Text style={styles.eventDetailText}>
                {formatEventTime(event.time)}
              </Text>
            </View>
            
            <View style={styles.eventDetailRow}>
              <Ionicons name="lock-closed" size={14} color="#8E8E93" />
              <Text style={styles.eventDetailText}>
                {event.privacyLevel || 'Public'} Event
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <ActivityActionButton
          title="Decline"
          onPress={handleDecline}
          variant="secondary"
          style={styles.actionButton}
        />
        <ActivityActionButton
          title="Accept"
          onPress={handleAccept}
          variant="primary"
          style={styles.actionButton}
        />
      </View>
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
  },

  // Event Card
  eventCard: {
    marginHorizontal: 0,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F2F2F7',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventImage: {
    width: EVENT_IMAGE_WIDTH,
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
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  eventInfo: {
    flex: 1,
    marginRight: 12,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  eventMeta: {
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },

  // Quick View Button
  quickViewButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderColor: '#D1D1D6',
    borderWidth: 1,
  },
  declineButtonText: {
    color: '#8E8E93',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#34C759',
  },
  acceptButtonText: {
    color: '#FFFFFF',
  },
});

export default EventInvitationActivity;