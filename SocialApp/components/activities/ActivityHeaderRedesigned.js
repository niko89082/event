// components/activities/ActivityHeaderRedesigned.js - New header with bulk grouping support
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@env';

const ActivityHeaderRedesigned = ({
  users = [], // Array of users for bulk grouping
  user, // Single user (for backward compatibility)
  timestamp,
  activityType,
  onUserPress,
  onUsersPress, // For bulk group press
  showTimeAgo = true,
}) => {
  // Support both single user and multiple users
  const displayUsers = users.length > 0 ? users : (user ? [user] : []);
  
  if (displayUsers.length === 0) {
    return null;
  }

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);
    
    if (diffInSeconds < 60) {
      return 'just now';
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

  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `http://${API_BASE_URL}:3000${cleanPath}`;
  };

  const renderAvatars = () => {
    const maxVisible = 2; // Show only 2 profile pictures + 1 "+x others" indicator
    const visibleUsers = displayUsers.slice(0, maxVisible);
    const remainingCount = displayUsers.length - maxVisible;

    if (displayUsers.length === 1) {
      // Single user
      const singleUser = displayUsers[0];
      return (
        <TouchableOpacity
          onPress={() => onUserPress?.(singleUser._id)}
          activeOpacity={0.7}
        >
          {singleUser.profilePicture ? (
            <Image
              source={{ uri: getImageUrl(singleUser.profilePicture) }}
              style={styles.singleAvatar}
            />
          ) : (
            <View style={[styles.singleAvatar, styles.placeholderAvatar]}>
              <Ionicons name="person" size={20} color="#8E8E93" />
            </View>
          )}
        </TouchableOpacity>
      );
    }

    // Multiple users - overlapping avatars
    return (
      <TouchableOpacity
        style={styles.avatarsContainer}
        onPress={() => onUsersPress?.(displayUsers)}
        activeOpacity={0.7}
      >
        {visibleUsers.map((userItem, index) => (
          <View
            key={userItem._id || index}
            style={[
              styles.multiAvatar,
              { marginLeft: index > 0 ? -20 : 0, zIndex: visibleUsers.length - index }
            ]}
          >
            {userItem.profilePicture ? (
              <Image
                source={{ uri: getImageUrl(userItem.profilePicture) }}
                style={styles.multiAvatarImage}
              />
            ) : (
              <View style={[styles.multiAvatarImage, styles.placeholderAvatar]}>
                <Ionicons name="person" size={14} color="#8E8E93" />
              </View>
            )}
          </View>
        ))}
        {remainingCount > 0 && (
          <View style={[styles.multiAvatar, styles.overflowAvatar, { marginLeft: -8 }]}>
            <Text style={styles.overflowText}>+{remainingCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderUserNames = () => {
    if (displayUsers.length === 1) {
      const singleUser = displayUsers[0];
      return (
        <Text style={styles.username} numberOfLines={1}>
          {singleUser.fullName || singleUser.username || 'Unknown User'}
        </Text>
      );
    }

    // Multiple users - show first 2 names + count
    const firstName = displayUsers[0].fullName || displayUsers[0].username || 'User';
    const secondName = displayUsers.length > 1 
      ? (displayUsers[1].fullName || displayUsers[1].username || 'User')
      : null;
    const remainingCount = displayUsers.length - 2;

    if (displayUsers.length === 2) {
      return (
        <Text style={styles.activityText} numberOfLines={1}>
          <Text style={styles.boldText}>{firstName}</Text>
          {secondName && (
            <>
              <Text>, </Text>
              <Text style={styles.boldText}>{secondName}</Text>
            </>
          )}
        </Text>
      );
    }

    return (
      <Text style={styles.activityText} numberOfLines={1}>
        <Text style={styles.boldText}>{firstName}</Text>
        {secondName && (
          <>
            <Text>, </Text>
            <Text style={styles.boldText}>{secondName}</Text>
          </>
        )}
        <Text> and </Text>
        <Text style={styles.boldText}>{remainingCount} other{remainingCount > 1 ? 's' : ''}</Text>
      </Text>
    );
  };

  return (
    <View style={styles.container}>
      {/* Avatars */}
      {renderAvatars()}

      {/* User Names and Activity Text */}
      <View style={styles.textContainer}>
        {renderUserNames()}
        {showTimeAgo && (
          <Text style={styles.timeAgo}>
            {formatTimeAgo(timestamp)}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 20,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  
  // Single Avatar
  singleAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 6,
  },
  
  // Multiple Avatars
  avatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  multiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  multiAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  overflowAvatar: {
    backgroundColor: '#E1E8ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overflowText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },
  
  placeholderAvatar: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Text Container - Match PostActivityComponent style
  textContainer: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
  },
  activityText: {
    fontSize: 15,
    color: '#000000',
    marginBottom: 2,
    lineHeight: 20,
  },
  boldText: {
    fontWeight: '700',
    color: '#000000',
  },
  timeAgo: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
  },
});

export default ActivityHeaderRedesigned;

