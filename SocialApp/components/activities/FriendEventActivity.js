// components/activities/FriendEventActivity.js - Friend Event Join Activity
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const EVENT_IMAGE_WIDTH = SCREEN_WIDTH - 32;
const EVENT_IMAGE_HEIGHT = 120;
const AVATAR_SIZE = 32;
const AVATAR_OVERLAP = 8;

const FriendEventActivity = ({ 
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

  const renderFriendAvatars = () => {
    const maxVisible = 3;
    const visibleFriends = friends.slice(0, maxVisible);
    const remainingCount = Math.max(0, groupCount - maxVisible);

    return (
      <View style={styles.avatarStack}>
        {visibleFriends.map((friend, index) => (
          <TouchableOpacity
            key={friend._id}
            style={[
              styles.avatarContainer,
              { 
                zIndex: maxVisible - index,
                marginLeft: index > 0 ? -AVATAR_OVERLAP : 0 
              }
            ]}
            onPress={() => handleViewProfile(friend._id)}
            activeOpacity={0.7}
          >
            {friend.profilePicture ? (
              <Image
                source={{ uri: friend.profilePicture }}
                style={styles.friendAvatar}
              />
            ) : (
              <View style={[styles.friendAvatar, styles.placeholderAvatar]}>
                <Ionicons name="person" size={16} color="#8E8E93" />
              </View>
            )}
          </TouchableOpacity>
        ))}
        
        {remainingCount > 0 && (
          <View style={[
            styles.avatarContainer,
            styles.moreAvatarContainer,
            { 
              marginLeft: -AVATAR_OVERLAP,
              zIndex: 0 
            }
          ]}>
            <Text style={styles.moreAvatarText}>+{remainingCount}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderJoinMessage = () => {
    if (!isGrouped || friends.length === 1) {
      return (
        <Text style={styles.messageText}>
          <Text style={styles.boldText}>{friends[0].username}</Text>
          <Text> joined </Text>
          <Text style={styles.boldText}>{event.title}</Text>
        </Text>
      );
    }

    if (friends.length === 2) {
      return (
        <Text style={styles.messageText}>
          <Text style={styles.boldText}>{friends[0].username}</Text>
          <Text> and </Text>
          <Text style={styles.boldText}>{friends[1].username}</Text>
          <Text> joined </Text>
          <Text style={styles.boldText}>{event.title}</Text>
        </Text>
      );
    }

    const remainingCount = groupCount - 1;
    return (
      <Text style={styles.messageText}>
        <Text style={styles.boldText}>{friends[0].username}</Text>
        <Text> and </Text>
        <Text style={styles.boldText}>{remainingCount} others</Text>
        <Text> joined </Text>
        <Text style={styles.boldText}>{event.title}</Text>
      </Text>
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

      {/* Friend Avatars for Grouped Activities */}
      {isGrouped && (
        <View style={styles.friendsContainer}>
          {renderFriendAvatars()}
          <View style={styles.friendsInfo}>
            <Text style={styles.friendsLabel}>
              {groupCount} {groupCount === 1 ? 'friend' : 'friends'} joined
            </Text>
            {friends.length > 1 && (
              <Text style={styles.friendsList} numberOfLines={2}>
                {friends.slice(0, 3).map(f => f.username).join(', ')}
                {groupCount > 3 && ` and ${groupCount - 3} others`}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Event Card */}
      <TouchableOpacity 
        style={styles.eventCard}
        onPress={handleViewEvent}
        activeOpacity={0.95}
      >
        <View style={styles.eventContent}>
          {/* Event Cover Image */}
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

          {/* Event Info */}
          <View style={styles.eventInfo}>
            <Text style={styles.eventTitle} numberOfLines={2}>
              {event.title}
            </Text>
            
            <View style={styles.eventMeta}>
              {/* Attendee Count */}
              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={14} color="#8E8E93" />
                <Text style={styles.metaText}>
                  {event.attendeeCount} attending
                </Text>
              </View>

              {/* Join Status */}
              <View style={styles.joinStatus}>
                <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                <Text style={styles.joinStatusText}>Joined</Text>
              </View>
            </View>
          </View>

          {/* Arrow */}
          <View style={styles.arrowContainer}>
            <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
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
  },

  // Friends Section (for grouped activities)
  friendsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 12,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  friendAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  placeholderAvatar: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreAvatarContainer: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#8E8E93',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  moreAvatarText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  friendsInfo: {
    flex: 1,
  },
  friendsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  friendsList: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 16,
  },

  // Event Card
  eventCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    overflow: 'hidden',
  },
  eventContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  eventImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  placeholderImage: {
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventInfo: {
    flex: 1,
    marginRight: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  joinStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  joinStatusText: {
    fontSize: 13,
    color: '#34C759',
    fontWeight: '500',
  },
  arrowContainer: {
    padding: 4,
  },
});

export default FriendEventActivity;