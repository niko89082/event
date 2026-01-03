// components/activities/FollowActivity.js - Follow Activity with nested profile card
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ActivityHeaderRedesigned from './ActivityHeaderRedesigned';
import { API_BASE_URL } from '@env';

const FollowActivity = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp, user } = activity;
  
  if (!data) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Activity data unavailable</Text>
      </View>
    );
  }
  
  const { followedUser, isFollowingYou } = data;
  const follower = user; // The person who followed
  
  if (!follower) {
    return null;
  }

  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `http://${API_BASE_URL}:3000${cleanPath}`;
  };

  const handleViewProfile = (userId) => {
    navigation.navigate('ProfileScreen', { userId });
  };

  const handleFollow = () => {
    if (followedUser && onAction) {
      onAction(activity._id, 'send_friend_request', { userId: followedUser._id });
    }
  };

  const getActivityText = () => {
    if (isFollowingYou) {
      return (
        <Text style={styles.activityText}>
          <Text style={styles.boldText}>{follower.username}</Text>
          <Text> started following you</Text>
        </Text>
      );
    }
    
    if (followedUser) {
      return (
        <Text style={styles.activityText}>
          <Text style={styles.boldText}>{follower.username}</Text>
          <Text> started following </Text>
          <Text style={styles.boldText}>{followedUser.username}</Text>
        </Text>
      );
    }
    
    return (
      <Text style={styles.activityText}>
        <Text style={styles.boldText}>{follower.username}</Text>
        <Text> started following you</Text>
      </Text>
    );
  };

  // Show nested profile card if following someone else
  const showProfileCard = followedUser && !isFollowingYou;

  return (
    <View style={styles.container}>
      {/* Activity Header */}
      <ActivityHeaderRedesigned
        user={follower}
        timestamp={timestamp}
        activityType="follow"
        onUserPress={handleViewProfile}
      />

      {/* Activity Text */}
      <View style={styles.activityTextContainer}>
        {getActivityText()}
      </View>

      {/* Nested Profile Card (if following someone else) */}
      {showProfileCard && (
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            {followedUser.profilePicture ? (
              <Image
                source={{ uri: getImageUrl(followedUser.profilePicture) }}
                style={styles.profileAvatar}
              />
            ) : (
              <View style={[styles.profileAvatar, styles.placeholderAvatar]}>
                <Text style={styles.avatarInitials}>
                  {(followedUser.fullName || followedUser.username || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {followedUser.fullName || followedUser.username}
              </Text>
              <Text style={styles.profileUsername}>
                @{followedUser.username}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.followButton}
            onPress={handleFollow}
            activeOpacity={0.7}
          >
            <Text style={styles.followButtonText}>Follow</Text>
          </TouchableOpacity>
        </View>
      )}
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
  profileCard: {
    backgroundColor: '#FFFFFF',
    marginLeft: 58, // Match PostActivityComponent alignment
    marginRight: 20,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  placeholderAvatar: {
    backgroundColor: '#AF52DE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
  },
  profileUsername: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
  },
  followButton: {
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  followButtonText: {
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

export default FollowActivity;

