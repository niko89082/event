// components/activities/ActivityHeader.js - Reusable Activity Header
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ActivityHeader = ({
  user,
  timestamp,
  activityType,
  onUserPress,
  customIcon = null,
  showTimeAgo = true,
}) => {
  
  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    } else {
      return time.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: time.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const getActivityIcon = () => {
    if (customIcon) {
      return customIcon;
    }

    const iconMap = {
      friend_request: { name: 'person-add-outline', color: '#AF52DE' },
      friend_request_accepted: { name: 'checkmark-circle-outline', color: '#34C759' },
      event_invitation: { name: 'calendar-outline', color: '#FF9500' },
      event_photo_upload: { name: 'camera-outline', color: '#3797EF' },
      friend_event_join: { name: 'people-outline', color: '#5856D6' },
      event_reminder: { name: 'time-outline', color: '#FF6B6B' },
      memory_created: { name: 'heart-outline', color: '#FF69B4' },
      regular_post: { name: 'image-outline', color: '#8E8E93' },
      memory_post: { name: 'heart-outline', color: '#FF69B4' },
    };

    return iconMap[activityType] || { name: 'flash-outline', color: '#8E8E93' };
  };

  const activityIcon = getActivityIcon();

  return (
    <View style={styles.container}>
      {/* User Avatar and Info */}
      <TouchableOpacity 
        style={styles.userSection}
        onPress={onUserPress}
        activeOpacity={0.7}
      >
        {/* Profile Picture */}
        {user?.profilePicture ? (
          <Image
            source={{ uri: user.profilePicture }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, styles.placeholderAvatar]}>
            <Ionicons name="person" size={16} color="#8E8E93" />
          </View>
        )}

        {/* User Info */}
        <View style={styles.userInfo}>
          <Text style={styles.username} numberOfLines={1}>
            {user?.displayName || user?.username || 'Unknown User'}
          </Text>
          {showTimeAgo && (
            <Text style={styles.timeAgo}>
              {formatTimeAgo(timestamp)}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Activity Icon */}
      <View style={[styles.activityIcon, { backgroundColor: `${activityIcon.color}20` }]}>
        <Ionicons 
          name={activityIcon.name} 
          size={16} 
          color={activityIcon.color} 
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  
  // User section
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  placeholderAvatar: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  timeAgo: {
    fontSize: 13,
    color: '#8E8E93',
  },
  
  // Activity icon
  activityIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ActivityHeader;