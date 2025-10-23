// components/activities/FriendRequestActivityMinimal.js - Clean Minimalist Design
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ActivityHeader from './ActivityHeader';
import ActivityActionButton from './ActivityActionButton';
import { useFriendRequestManager } from '../../hooks/useFriendRequestManager';
import { API_BASE_URL } from '@env';

const FriendRequestActivityMinimal = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp } = activity;
  const { requester, message } = data;
  
  const [actionTaken, setActionTaken] = useState(data?.actionTaken || null);
  const [localProcessing, setLocalProcessing] = useState(false);

  const friendRequestManager = useFriendRequestManager('FriendRequestActivityMinimal', {
    showSuccessAlerts: false,
    onAcceptSuccess: handleAcceptSuccess,
    onRejectSuccess: handleRejectSuccess,
    onError: handleError
  });

  function handleAcceptSuccess(data) {
    if (data.activityId === activity._id || data.requesterId === requester._id) {
      setActionTaken('accepted');
      setLocalProcessing(false);
      
      Alert.alert(
        '🎉 Friend Request Accepted!',
        `You and ${requester.username} are now friends!`,
        [{ text: 'Great!', style: 'default' }]
      );
    }
  }

  function handleRejectSuccess(data) {
    if (data.activityId === activity._id || data.requesterId === requester._id) {
      setActionTaken('rejected');
      setLocalProcessing(false);
      
      Alert.alert(
        'Friend Request Rejected',
        `You rejected ${requester.username}'s friend request.`,
        [{ text: 'OK', style: 'default' }]
      );
    }
  }

  function handleError(data) {
    if (data.activityId === activity._id || data.requesterId === requester._id) {
      setLocalProcessing(false);
      
      Alert.alert(
        'Error',
        data.error || 'An error occurred. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  }

  const handleAccept = async () => {
    if (localProcessing || friendRequestManager.isProcessing()) return;
    
    setLocalProcessing(true);
    
    try {
      await friendRequestManager.acceptRequest(
        requester._id, 
        null,
        activity._id
      );
    } catch (error) {
      console.error('❌ FriendRequestActivityMinimal: Accept failed:', error);
      setLocalProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (localProcessing || friendRequestManager.isProcessing()) return;
    
    Alert.alert(
      'Reject Friend Request',
      `Are you sure you want to reject ${requester.username}'s friend request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reject', 
          style: 'destructive',
          onPress: async () => {
            setLocalProcessing(true);
            
            try {
              await friendRequestManager.rejectRequest(
                requester._id,
                null,
                activity._id,
                { removeActivity: false }
              );
            } catch (error) {
              console.error('❌ FriendRequestActivityMinimal: Reject failed:', error);
              setLocalProcessing(false);
            }
          }
        }
      ]
    );
  };

  const handleViewProfile = () => {
    navigation.navigate('ProfileScreen', { userId: requester._id });
  };

  const renderActionButtons = () => {
    const isProcessing = localProcessing || friendRequestManager.isProcessing();

    if (actionTaken === 'accepted') {
      return (
        <View style={styles.successState}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={20} color="#34C759" />
          </View>
          <Text style={styles.successText}>Friends</Text>
        </View>
      );
    }

    if (actionTaken === 'rejected') {
      return (
        <View style={styles.rejectedState}>
          <View style={styles.rejectedIcon}>
            <Ionicons name="close-circle" size={20} color="#8E8E93" />
          </View>
          <Text style={styles.rejectedText}>Declined</Text>
        </View>
      );
    }

    return (
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.declineButton]}
          onPress={handleDecline}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.actionButtonText}>Decline</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={handleAccept}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.actionButtonText}>Accept</Text>
          )}
        </TouchableOpacity>
      </View>
    );
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

      {/* Content */}
      <View style={styles.content}>
        {/* User Info Row */}
        <TouchableOpacity 
          style={styles.userRow}
          onPress={handleViewProfile}
          activeOpacity={0.7}
        >
          <View style={styles.profileImageContainer}>
            {requester.profilePicture ? (
              <Image 
                source={{ 
                  uri: requester.profilePicture.startsWith('http') 
                    ? requester.profilePicture 
                    : `http://${API_BASE_URL}:3000${requester.profilePicture}` 
                }} 
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.defaultProfileImage}>
                <Text style={styles.defaultProfileText}>
                  {requester.username?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.userInfo}>
            <Text style={styles.displayName}>
              {requester.fullName || requester.username}
            </Text>
            <Text style={styles.username}>@{requester.username}</Text>
            
            {requester.mutualFriends && (
              <Text style={styles.mutualFriends}>
                {requester.mutualFriends} mutual friends
              </Text>
            )}
          </View>
          
          <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
        </TouchableOpacity>

        {/* Message */}
        {message && message !== 'I would like to add you as a friend.' && (
          <View style={styles.messageContainer}>
            <Text style={styles.messageText}>"{message}"</Text>
          </View>
        )}

        {/* Action Buttons */}
        {renderActionButtons()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 0,
    marginVertical: 8,
    borderRadius: 0,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  
  content: {
    marginTop: 12,
  },
  
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  
  profileImageContainer: {
    marginRight: 12,
  },
  
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  
  defaultProfileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  defaultProfileText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
  },
  
  userInfo: {
    flex: 1,
  },
  
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  
  username: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  
  mutualFriends: {
    fontSize: 12,
    color: '#AF52DE',
    fontWeight: '500',
  },
  
  messageContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#AF52DE',
  },
  
  messageText: {
    fontSize: 14,
    color: '#1C1C1E',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  
  acceptButton: {
    backgroundColor: '#34C759',
  },
  
  declineButton: {
    backgroundColor: '#FF3B30',
  },
  
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  
  successState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  
  successIcon: {
    // Icon styling handled by Ionicons
  },
  
  successText: {
    color: '#34C759',
    fontSize: 14,
    fontWeight: '600',
  },
  
  rejectedState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  
  rejectedIcon: {
    // Icon styling handled by Ionicons
  },
  
  rejectedText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default FriendRequestActivityMinimal;
