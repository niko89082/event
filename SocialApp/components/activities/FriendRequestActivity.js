// components/activities/FriendRequestActivity.js - Friend Request Activity
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ActivityHeader from './ActivityHeader';
import ActivityActionButton from './ActivityActionButton';

const FriendRequestActivity = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp } = activity;
  const { requester, message } = data;

  const handleAccept = () => {
    onAction(activity._id, 'accept_friend_request', { 
      requesterId: requester._id 
    });
  };

  const handleDecline = () => {
    onAction(activity._id, 'decline_friend_request', { 
      requesterId: requester._id 
    });
  };

  const handleViewProfile = () => {
    navigation.navigate('ProfileScreen', { userId: requester._id });
  };

  return (
    <View style={styles.container}>
      {/* Activity Header */}
      <ActivityHeader
        user={requester}
        timestamp={timestamp}
        activityType="friend_request"
        onUserPress={handleViewProfile}
        customIcon={{ name: 'person-add-outline', color: '#AF52DE' }}
      />

      {/* Request Message */}
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>
          <Text style={styles.boldText}>{requester.username}</Text>
          <Text> sent you a friend request</Text>
        </Text>
        
        {message && message !== 'I would like to add you as a friend.' && (
          <View style={styles.customMessageContainer}>
            <Text style={styles.customMessage}>"{message}"</Text>
          </View>
        )}
      </View>

      {/* User Preview Card */}
      <TouchableOpacity 
        style={styles.userPreview}
        onPress={handleViewProfile}
        activeOpacity={0.95}
      >
        <View style={styles.userInfo}>
          {/* Large Profile Picture */}
          {requester.profilePicture ? (
            <Image
              source={{ uri: requester.profilePicture }}
              style={styles.largeAvatar}
            />
          ) : (
            <View style={[styles.largeAvatar, styles.placeholderAvatar]}>
              <Ionicons name="person" size={32} color="#8E8E93" />
            </View>
          )}

          {/* User Details */}
          <View style={styles.userDetails}>
            <Text style={styles.displayName} numberOfLines={1}>
              {requester.displayName || requester.username}
            </Text>
            <Text style={styles.username} numberOfLines={1}>
              @{requester.username}
            </Text>
            
            {/* Mutual Friends (if available) */}
            {requester.mutualFriendsCount > 0 && (
              <View style={styles.mutualFriends}>
                <Ionicons name="people-outline" size={14} color="#8E8E93" />
                <Text style={styles.mutualFriendsText}>
                  {requester.mutualFriendsCount} mutual {requester.mutualFriendsCount === 1 ? 'friend' : 'friends'}
                </Text>
              </View>
            )}
          </View>

          {/* View Profile Arrow */}
          <View style={styles.arrowContainer}>
            <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
          </View>
        </View>
      </TouchableOpacity>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <ActivityActionButton
          title="Decline"
          onPress={handleDecline}
          variant="outline"
          style={styles.declineButton}
          textStyle={styles.declineButtonText}
          loading={metadata?.actionProcessing && metadata?.actionLabel?.includes('Declining')}
          disabled={metadata?.actionProcessing}
          fullWidth={false}
        />
        
        <ActivityActionButton
          title="Accept"
          onPress={handleAccept}
          variant="primary"
          style={styles.acceptButton}
          loading={metadata?.actionProcessing && metadata?.actionLabel?.includes('Accepting')}
          disabled={metadata?.actionProcessing}
          fullWidth={false}
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
    marginBottom: 16,
  },
  messageText: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 22,
  },
  boldText: {
    fontWeight: '600',
  },
  customMessageContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#AF52DE',
  },
  customMessage: {
    fontSize: 14,
    color: '#1C1C1E',
    fontStyle: 'italic',
    lineHeight: 18,
  },

  // User Preview
  userPreview: {
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 16,
    overflow: 'hidden',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  largeAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  placeholderAvatar: {
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDetails: {
    flex: 1,
    marginRight: 12,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  username: {
    fontSize: 15,
    color: '#8E8E93',
    marginBottom: 4,
  },
  mutualFriends: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  mutualFriendsText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  arrowContainer: {
    padding: 4,
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  declineButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderColor: '#FF3B30',
    borderWidth: 1,
  },
  declineButtonText: {
    color: '#FF3B30',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#AF52DE',
  },
});

export default FriendRequestActivity;