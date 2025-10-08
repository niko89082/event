// components/activities/EventReminderActivity.js - Event Reminder Activity
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ActivityHeader from './ActivityHeader';
import ActivityActionButton from './ActivityActionButton';

const EventReminderActivity = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp } = activity;
  const { event, hoursUntil, reminderType } = data;

  const isUrgent = reminderType === 'urgent' || hoursUntil <= 1;

  const handleViewEvent = () => {
    navigation.navigate('EventDetailsScreen', { eventId: event._id });
  };

  const handleGetDirections = () => {
    if (!event.location) {
      Alert.alert('No Location', 'This event doesn\'t have a location set.');
      return;
    }

    const encodedLocation = encodeURIComponent(event.location);
    const mapsUrl = `maps://app?daddr=${encodedLocation}`;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedLocation}`;

    Linking.canOpenURL(mapsUrl)
      .then(supported => {
        if (supported) {
          return Linking.openURL(mapsUrl);
        } else {
          return Linking.openURL(googleMapsUrl);
        }
      })
      .catch(err => {
        console.error('Error opening maps:', err);
        Alert.alert('Error', 'Unable to open maps application.');
      });
  };

  const handleInviteFriends = () => {
    navigation.navigate('InviteFriendsScreen', { eventId: event._id });
  };

  const formatTimeUntil = (hours) => {
    if (hours < 1) {
      const minutes = Math.max(1, Math.floor(hours * 60));
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (hours < 24) {
      const roundedHours = Math.floor(hours);
      return `${roundedHours} hour${roundedHours !== 1 ? 's' : ''}`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
  };

  const getEventTime = () => {
    const eventDate = new Date(event.time);
    return eventDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <View style={[styles.container, isUrgent && styles.urgentContainer]}>
      {/* Activity Header */}
      <ActivityHeader
        user={{ username: 'Reminder', profilePicture: null }}
        timestamp={timestamp}
        activityType="event_reminder"
        onUserPress={handleViewEvent}
        customIcon={{ 
          name: isUrgent ? 'alarm' : 'time-outline', 
          color: isUrgent ? '#FF3B30' : '#FF9500' 
        }}
        showActivityIcon={true}
      />

      {/* Reminder Message */}
      <View style={styles.messageContainer}>
        <Text style={[styles.messageText, isUrgent && styles.urgentMessageText]}>
          {isUrgent ? (
            <>
              <Text style={styles.urgentIcon}>⚡ </Text>
              <Text style={styles.boldText}>{event.title}</Text>
              <Text> starts in {formatTimeUntil(hoursUntil)}!</Text>
            </>
          ) : (
            <>
              <Text style={styles.boldText}>{event.title}</Text>
              <Text> starts in {formatTimeUntil(hoursUntil)}</Text>
            </>
          )}
        </Text>
      </View>

      {/* Event Card */}
      <TouchableOpacity 
        style={[styles.eventCard, isUrgent && styles.urgentEventCard]}
        onPress={handleViewEvent}
        activeOpacity={0.95}
      >
        <View style={styles.eventContent}>
          {/* Event Cover */}
          <View style={styles.eventImageContainer}>
            {event.coverImage ? (
              <Image
                source={{ uri: event.coverImage }}
                style={styles.eventImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.eventImage, styles.placeholderImage]}>
                <Ionicons name="calendar-outline" size={24} color="#8E8E93" />
              </View>
            )}
            
            {/* Urgency Badge */}
            {isUrgent && (
              <View style={styles.urgencyBadge}>
                <Ionicons name="flash" size={12} color="#FFFFFF" />
              </View>
            )}
          </View>

          {/* Event Details */}
          <View style={styles.eventInfo}>
            <Text style={styles.eventTitle} numberOfLines={2}>
              {event.title}
            </Text>
            
            <View style={styles.eventMeta}>
              {/* Time */}
              <View style={styles.metaItem}>
                <Ionicons 
                  name="time-outline" 
                  size={14} 
                  color={isUrgent ? '#FF3B30' : '#8E8E93'} 
                />
                <Text style={[styles.metaText, isUrgent && styles.urgentMetaText]}>
                  {getEventTime()}
                </Text>
              </View>

              {/* Location */}
              {event.location && (
                <View style={styles.metaItem}>
                  <Ionicons 
                    name="location-outline" 
                    size={14} 
                    color={isUrgent ? '#FF3B30' : '#8E8E93'} 
                  />
                  <Text style={[styles.metaText, isUrgent && styles.urgentMetaText]} numberOfLines={1}>
                    {event.location}
                  </Text>
                </View>
              )}

              {/* Attendees */}
              <View style={styles.metaItem}>
                <Ionicons 
                  name="people-outline" 
                  size={14} 
                  color={isUrgent ? '#FF3B30' : '#8E8E93'} 
                />
                <Text style={[styles.metaText, isUrgent && styles.urgentMetaText]}>
                  {event.attendeeCount} attending
                </Text>
              </View>
            </View>

            {/* Countdown */}
            <View style={[styles.countdownContainer, isUrgent && styles.urgentCountdownContainer]}>
              <Text style={[styles.countdownText, isUrgent && styles.urgentCountdownText]}>
                Starts in {formatTimeUntil(hoursUntil)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        {event.location && (
          <ActivityActionButton
            title="Directions"
            onPress={handleGetDirections}
            variant="outline"
            icon="navigate-outline"
            size="small"
            style={styles.actionButton}
          />
        )}
        
        <ActivityActionButton
          title="View Event"
          onPress={handleViewEvent}
          variant={isUrgent ? "secondary" : "primary"}
          icon="calendar-outline"
          size="small"
          style={[styles.actionButton, styles.primaryActionButton]}
        />
        
        <ActivityActionButton
          title="Invite"
          onPress={handleInviteFriends}
          variant="ghost"
          icon="person-add-outline"
          size="small"
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
  urgentContainer: {
    backgroundColor: '#FFF5F5',
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  
  // Message
  messageContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  messageText: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 22,
  },
  urgentMessageText: {
    fontSize: 17,
    fontWeight: '600',
  },
  boldText: {
    fontWeight: '600',
  },
  urgentIcon: {
    fontSize: 16,
  },

  // Event Card
  eventCard: {
    marginHorizontal: 0,
    borderRadius: 0,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  urgentEventCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FF3B30',
    borderWidth: 2,
    shadowColor: '#FF3B30',
    shadowOpacity: 0.1,
  },
  eventContent: {
    flexDirection: 'row',
    padding: 16,
  },

  // Event Image
  eventImageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  eventImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  placeholderImage: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  urgencyBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Event Info
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  eventMeta: {
    gap: 6,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
  },
  urgentMetaText: {
    color: '#FF3B30',
    fontWeight: '500',
  },

  // Countdown
  countdownContainer: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  urgentCountdownContainer: {
    backgroundColor: '#FF3B30',
  },
  countdownText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  urgentCountdownText: {
    color: '#FFFFFF',
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  primaryActionButton: {
    flex: 1.5, // Make the primary action slightly larger
  },
});

export default EventReminderActivity;