// components/activities/FriendRequestAcceptedActivity.js - Friend Request Accepted (No Messaging)
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

const FriendRequestAcceptedActivity = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp } = activity;
  const { accepter } = data;

  const handleViewProfile = () => {
    navigation.navigate('ProfileScreen', { userId: accepter._id });
  };

  return (
    <View style={styles.container}>
      {/* Activity Header */}
      <ActivityHeader
        user={accepter}
        timestamp={timestamp}
        activityType="friend_request_accepted"
        onUserPress={handleViewProfile}
        customIcon={{ name: 'checkmark-circle-outline', color: '#34C759' }}
      />

      {/* Success Message */}
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>
          <Text style={styles.boldText}>{accepter.username}</Text>
          <Text> accepted your friend request</Text>
        </Text>
      </View>

      {/* Celebration Card */}
      <View style={styles.celebrationCard}>
        <View style={styles.celebrationContent}>
          {/* Success Icon */}
          <View style={styles.successIcon}>
            <Ionicons name="people" size={24} color="#34C759" />
          </View>

          {/* Friend Preview */}
          <TouchableOpacity 
            style={styles.friendPreview}
            onPress={handleViewProfile}
            activeOpacity={0.7}
          >
            {accepter.profilePicture ? (
              <Image
                source={{ uri: accepter.profilePicture }}
                style={styles.friendAvatar}
              />
            ) : (
              <View style={[styles.friendAvatar, styles.placeholderAvatar]}>
                <Ionicons name="person" size={20} color="#8E8E93" />
              </View>
            )}
            
            <View style={styles.friendInfo}>
              <Text style={styles.friendName} numberOfLines={1}>
                {accepter.displayName || accepter.username}
              </Text>
              <Text style={styles.friendUsername} numberOfLines={1}>
                @{accepter.username}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Success Message */}
          <Text style={styles.celebrationText}>
            🎉 You're now friends!
          </Text>
        </View>
      </View>

      {/* Action Button - Only View Profile */}
      <View style={styles.actionsContainer}>
        <ActivityActionButton
          title="View Profile"
          onPress={handleViewProfile}
          variant="primary"
          icon="person-outline"
          style={styles.viewProfileButton}
          fullWidth={true}
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

  // Celebration Card
  celebrationCard: {
    marginHorizontal: 0,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    marginBottom: 16,
    overflow: 'hidden',
  },
  celebrationContent: {
    padding: 20,
    alignItems: 'center',
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  // Friend Preview
  friendPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    width: '100%',
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  placeholderAvatar: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  friendUsername: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Celebration Text
  celebrationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16A34A',
    textAlign: 'center',
  },

  // Actions
  actionsContainer: {
    paddingHorizontal: 16,
  },
  viewProfileButton: {
    backgroundColor: '#34C759',
  },
});

export default FriendRequestAcceptedActivity;