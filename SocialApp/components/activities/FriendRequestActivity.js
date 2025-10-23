// components/activities/FriendRequestActivity.js - Updated with FriendRequestManager Integration
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

const FriendRequestActivity = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction // Legacy prop - we'll keep for backwards compatibility but use FriendRequestManager
}) => {
  const { data, metadata, timestamp } = activity;
  const { requester, message } = data;
  
  // ✅ NEW: State management for this specific activity
  const [actionTaken, setActionTaken] = useState(data?.actionTaken || null);
  const [localProcessing, setLocalProcessing] = useState(false);

  // ✅ NEW: Integration with FriendRequestManager
  const friendRequestManager = useFriendRequestManager('FriendRequestActivity', {
    showSuccessAlerts: false, // We'll handle our own feedback
    onAcceptSuccess: handleAcceptSuccess,
    onRejectSuccess: handleRejectSuccess,
    onError: handleError
  });

  /**
   * ✅ NEW: Handle successful acceptance
   */
  function handleAcceptSuccess(data) {
    console.log('🎉 FriendRequestActivity: Accept success', data);
    
    if (data.activityId === activity._id || data.requesterId === requester._id) {
      setActionTaken('accepted');
      setLocalProcessing(false);
      
      // Show success feedback
      Alert.alert(
        '🎉 Friend Request Accepted!',
        `You and ${requester.username} are now friends!`,
        [{ text: 'Great!', style: 'default' }]
      );
    }
  }

  /**
   * ✅ NEW: Handle successful rejection
   */
  function handleRejectSuccess(data) {
    console.log('❌ FriendRequestActivity: Reject success', data);
    
    if (data.activityId === activity._id || data.requesterId === requester._id) {
      setActionTaken('rejected');
      setLocalProcessing(false);
      
      // Show rejection feedback
      Alert.alert(
        'Friend Request Rejected',
        `You rejected ${requester.username}'s friend request.`,
        [{ text: 'OK', style: 'default' }]
      );
    }
  }

  /**
   * ✅ NEW: Handle errors
   */
  function handleError(data) {
    console.error('❌ FriendRequestActivity: Error', data);
    
    if (data.activityId === activity._id || data.requesterId === requester._id) {
      setLocalProcessing(false);
      
      Alert.alert(
        'Error',
        data.error || 'An error occurred. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  }

  /**
   * ✅ UPDATED: Handle accept with FriendRequestManager
   */
  const handleAccept = async () => {
    if (localProcessing || friendRequestManager.isProcessing()) return;
    
    setLocalProcessing(true);
    
    try {
      await friendRequestManager.acceptRequest(
        requester._id, 
        null, // no notification ID for activity feed
        activity._id // pass activity ID for tracking
      );
    } catch (error) {
      console.error('❌ FriendRequestActivity: Accept failed:', error);
      setLocalProcessing(false);
    }
  };

  /**
   * ✅ UPDATED: Handle decline with FriendRequestManager
   */
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
                null, // no notification ID for activity feed  
                activity._id, // pass activity ID for tracking
                { removeActivity: false } // Keep activity but mark as rejected
              );
            } catch (error) {
              console.error('❌ FriendRequestActivity: Reject failed:', error);
              setLocalProcessing(false);
            }
          }
        }
      ]
    );
  };

  /**
   * ✅ EXISTING: Handle view profile (unchanged)
   */
  const handleViewProfile = () => {
    navigation.navigate('ProfileScreen', { userId: requester._id });
  };

  /**
   * ✅ NEW: Render based on action taken state
   */
  const renderActionButtons = () => {
    const isProcessing = localProcessing || friendRequestManager.isProcessing();

    if (actionTaken === 'accepted') {
      return (
        <View style={styles.actionResult}>
          <View style={[styles.resultBadge, styles.acceptedBadge]}>
            <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
            <Text style={styles.resultText}>Friends</Text>
          </View>
          <Text style={styles.resultMessage}>
            You are now friends with {requester.username}!
          </Text>
        </View>
      );
    }

    if (actionTaken === 'rejected') {
      return (
        <View style={styles.actionResult}>
          <View style={[styles.resultBadge, styles.rejectedBadge]}>
            <Ionicons name="close-circle" size={16} color="#FFFFFF" />
            <Text style={styles.resultText}>Rejected</Text>
          </View>
          <Text style={styles.resultMessage}>
            You rejected {requester.username}'s friend request.
          </Text>
        </View>
      );
    }

    // Show action buttons for pending requests
    return (
      <View style={styles.actionButtons}>
        <ActivityActionButton
          onPress={handleDecline}
          disabled={isProcessing}
          style={[styles.actionButton, styles.declineButton]}
          loading={isProcessing}
        >
          <Ionicons name="close" size={16} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Decline</Text>
        </ActivityActionButton>

        <ActivityActionButton
          onPress={handleAccept}
          disabled={isProcessing}
          style={[styles.actionButton, styles.acceptButton]}
          loading={isProcessing}
        >
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Accept</Text>
        </ActivityActionButton>
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
              source={{ 
                uri: requester.profilePicture.startsWith('http') 
                  ? requester.profilePicture 
                  : `http://${API_BASE_URL}:3000${requester.profilePicture}` 
              }} 
              style={styles.largeProfilePicture}
            />
          ) : (
            <View style={styles.defaultProfilePicture}>
              <Text style={styles.defaultProfileText}>
                {requester.username?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
          
          <View style={styles.userDetails}>
            <Text style={styles.fullName}>
              {requester.fullName || requester.username}
            </Text>
            <Text style={styles.username}>@{requester.username}</Text>
            
            {/* Mutual friends or other info could go here */}
            {requester.mutualFriends && (
              <Text style={styles.mutualFriends}>
                {requester.mutualFriends} mutual friends
              </Text>
            )}
          </View>
        </View>
        
        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
      </TouchableOpacity>

      {/* Action Buttons or Result */}
      {renderActionButtons()}
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
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  messageContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  messageText: {
    fontSize: 15,
    color: '#1C1C1E',
    lineHeight: 20,
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
  userPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  largeProfilePicture: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  defaultProfilePicture: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E5E5E7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  defaultProfileText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8E8E93',
  },
  userDetails: {
    flex: 1,
  },
  fullName: {
    fontSize: 17,
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
    fontSize: 13,
    color: '#AF52DE',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 6,
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
  declineButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  actionResult: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginBottom: 8,
  },
  acceptedBadge: {
    backgroundColor: '#34C759',
  },
  rejectedBadge: {
    backgroundColor: '#FF3B30',
  },
  resultText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  resultMessage: {
    fontSize: 15,
    color: '#1C1C1E',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default FriendRequestActivity;