// components/activities/FriendEventActivityRedesigned.js - Redesigned Friend Event Join Activity
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
const EVENT_IMAGE_WIDTH = SCREEN_WIDTH;
const EVENT_IMAGE_HEIGHT = 200; // Match EventCard's normal height

const FriendEventActivityRedesigned = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp } = activity;
  const { event, friends, groupCount, isGrouped } = data;

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

  const privacyIcon = getPrivacyIcon(event.privacyLevel);

  const renderJoinMessage = () => {
    if (isGrouped && groupCount > 1) {
      return (
        <Text style={styles.messageText}>
          <Text style={styles.boldText}>{friends[0].username}</Text>
          <Text> and </Text>
          <Text style={styles.boldText}>{groupCount - 1} other{groupCount - 1 > 1 ? 's' : ''}</Text>
          <Text> joined an event</Text>
        </Text>
      );
    } else {
      return (
        <Text style={styles.messageText}>
          <Text style={styles.boldText}>{friends[0].username}</Text>
          <Text> joined an event</Text>
        </Text>
      );
    }
  };

  const renderFriendAvatars = () => {
    const maxVisible = 3;
    const visibleFriends = friends.slice(0, maxVisible);
    const remainingCount = friends.length - maxVisible;

    return (
      <View style={styles.friendsAvatars}>
        {visibleFriends.map((friend, index) => (
          <TouchableOpacity
            key={friend._id}
            style={[
              styles.friendAvatar,
              { marginLeft: index > 0 ? -8 : 0 }
            ]}
            onPress={() => handleViewProfile(friend._id)}
            activeOpacity={0.8}
          >
            <Image
              source={{
                uri: friend.profilePicture
                  ? `${api.defaults.baseURL}${friend.profilePicture}`
                  : 'https://placehold.co/32x32.png?text=👤'
              }}
              style={styles.friendAvatarImage}
            />
          </TouchableOpacity>
        ))}
        {remainingCount > 0 && (
          <View style={[styles.friendAvatar, styles.friendAvatarOverflow]}>
            <Text style={styles.friendAvatarOverflowText}>+{remainingCount}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Activity Header */}
      <ActivityHeader
        user={friends[0]}
        timestamp={timestamp}
        activityType="friend_event_join"
        onUserPress={() => handleViewProfile(friends[0]._id)}
        customIcon={{ name: 'people-outline', color: '#34C759' }}
      />

      {/* Join Message */}
      <View style={styles.messageContainer}>
        {renderJoinMessage()}
      </View>

      {/* Friend Avatars */}
      {isGrouped && (
        <View style={styles.friendsContainer}>
          {renderFriendAvatars()}
          <View style={styles.friendsInfo}>
            <Text style={styles.friendsLabel}>
              {groupCount} {groupCount === 1 ? 'friend' : 'friends'} joined
            </Text>
          </View>
        </View>
      )}

      {/* Event Card */}
      <TouchableOpacity 
        style={styles.eventCard}
        onPress={handleViewEvent}
        activeOpacity={0.95}
      >
        {/* Event Cover Image Container */}
        <View style={styles.imageContainer}>
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

            {/* Join Status Badge */}
            <View style={styles.joinStatusBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#FFFFFF" />
              <Text style={styles.joinStatusText}>Joined</Text>
            </View>
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

            {/* Attendee Count */}
            <View style={styles.metaRow}>
              <Ionicons name="people-outline" size={16} color="#8E8E93" />
              <Text style={styles.metaText}>
                {event.attendeeCount || 0} attending
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
    borderRadius: 0,
    marginHorizontal: 0,
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
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 22,
  },
  boldText: {
    fontWeight: '600',
  },

  // Friends
  friendsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  friendsAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  friendAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  friendAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  friendAvatarOverflow: {
    backgroundColor: '#E1E8ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendAvatarOverflowText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666666',
  },
  friendsInfo: {
    flex: 1,
  },
  friendsLabel: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },

  // Event Card
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },

  // Image Container
  imageContainer: {
    height: EVENT_IMAGE_HEIGHT,
    position: 'relative',
  },

  // Event Image
  eventImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
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
    flexDirection: 'row',
    gap: 8,
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
  },
  joinStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  joinStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Event Info
  eventInfo: {
    padding: 16,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
    lineHeight: 24,
  },
  eventDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
    lineHeight: 20,
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
});

export default FriendEventActivityRedesigned;

