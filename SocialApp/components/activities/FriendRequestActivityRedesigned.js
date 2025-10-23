// components/activities/FriendRequestActivityRedesigned.js - Instagram/Facebook Style Friend Request Component
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFriendRequestManager } from '../../hooks/useFriendRequestManager';
import { API_BASE_URL } from '@env';

const { width } = Dimensions.get('window');

const FriendRequestActivityRedesigned = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp } = activity;
  const { requester, message } = data;
  
  // State management
  const [actionTaken, setActionTaken] = useState(data?.actionTaken || null);
  const [localProcessing, setLocalProcessing] = useState(false);

  // Integration with FriendRequestManager
  const friendRequestManager = useFriendRequestManager('FriendRequestActivityRedesigned', {
    showSuccessAlerts: false,
    onAcceptSuccess: handleAcceptSuccess,
    onRejectSuccess: handleRejectSuccess,
    onError: handleError
  });

  function handleAcceptSuccess(data) {
    console.log('🎉 FriendRequestActivityRedesigned: Accept success', data);
    
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
    console.log('❌ FriendRequestActivityRedesigned: Reject success', data);
    
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
    console.error('❌ FriendRequestActivityRedesigned: Error', data);
    
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
      console.error('❌ FriendRequestActivityRedesigned: Accept failed:', error);
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
              console.error('❌ FriendRequestActivityRedesigned: Reject failed:', error);
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

  const getTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  };

  const renderActionButtons = () => {
    const isProcessing = localProcessing || friendRequestManager.isProcessing();

    if (actionTaken === 'accepted') {
      return (
        <View style={styles.resultContainer}>
          <View style={styles.resultBadge}>
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.resultText}>Friends</Text>
          </View>
          <Text style={styles.resultMessage}>
            You and {requester.username} are now friends!
          </Text>
        </View>
      );
    }

    if (actionTaken === 'rejected') {
      return (
        <View style={styles.resultContainer}>
          <View style={[styles.resultBadge, styles.rejectedBadge]}>
            <Ionicons name="close-circle" size={20} color="#FFFFFF" />
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
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.confirmButton]}
          onPress={handleAccept}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={handleDecline}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="close" size={18} color="#FFFFFF" />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with profile picture and basic info */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.profileContainer}
          onPress={handleViewProfile}
          activeOpacity={0.9}
        >
          {/* Profile Picture */}
          <View style={styles.profilePictureContainer}>
            {requester.profilePicture ? (
              <Image 
                source={{ 
                  uri: requester.profilePicture.startsWith('http') 
                    ? requester.profilePicture 
                    : `http://${API_BASE_URL}:3000${requester.profilePicture}` 
                }} 
                style={styles.profilePicture}
              />
            ) : (
              <View style={styles.defaultProfilePicture}>
                <Text style={styles.defaultProfileText}>
                  {requester.username?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            
            {/* Friend request icon overlay */}
            <View style={styles.friendRequestIcon}>
              <Ionicons name="person-add" size={12} color="#FFFFFF" />
            </View>
          </View>

          {/* User Info */}
          <View style={styles.userInfo}>
            <Text style={styles.fullName}>
              {requester.fullName || requester.username}
            </Text>
            <Text style={styles.username}>@{requester.username}</Text>
            
            {/* Mutual friends indicator */}
            {requester.mutualFriends && requester.mutualFriends > 0 && (
              <View style={styles.mutualFriendsContainer}>
                <Ionicons name="people" size={12} color="#8E8E93" />
                <Text style={styles.mutualFriendsText}>
                  {requester.mutualFriends} mutual friend{requester.mutualFriends !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Time indicator */}
        <Text style={styles.timeAgo}>
          {getTimeAgo(timestamp)}
        </Text>
      </View>

      {/* Custom message if provided */}
      {message && message !== 'I would like to add you as a friend.' && (
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>"{message}"</Text>
        </View>
      )}

      {/* Action buttons or result */}
      {renderActionButtons()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 0,
    marginVertical: 4,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  
  profilePictureContainer: {
    position: 'relative',
    marginRight: 12,
  },
  
  profilePicture: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0F0F0',
  },
  
  defaultProfilePicture: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E5E5E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  defaultProfileText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8E8E93',
  },
  
  friendRequestIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3797EF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  
  userInfo: {
    flex: 1,
  },
  
  fullName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  
  username: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  
  mutualFriendsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  mutualFriendsText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
  
  timeAgo: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  
  // Message styles
  messageContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#3797EF',
  },
  
  messageText: {
    fontSize: 14,
    color: '#1C1C1E',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  
  // Action buttons styles
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  
  confirmButton: {
    backgroundColor: '#3797EF',
  },
  
  deleteButton: {
    backgroundColor: '#8E8E93',
  },
  
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Result styles
  resultContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginBottom: 8,
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
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default FriendRequestActivityRedesigned;