// components/activities/FriendRequestActivitySocial.js - Social Media Inspired Design
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
import { BlurView } from 'expo-blur';
import ActivityHeader from './ActivityHeader';
import ActivityActionButton from './ActivityActionButton';
import { useFriendRequestManager } from '../../hooks/useFriendRequestManager';
import { API_BASE_URL } from '@env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FriendRequestActivitySocial = ({ 
  activity, 
  currentUserId, 
  navigation, 
  onAction 
}) => {
  const { data, metadata, timestamp } = activity;
  const { requester, message } = data;
  
  const [actionTaken, setActionTaken] = useState(data?.actionTaken || null);
  const [localProcessing, setLocalProcessing] = useState(false);

  const friendRequestManager = useFriendRequestManager('FriendRequestActivitySocial', {
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
      console.error('❌ FriendRequestActivitySocial: Accept failed:', error);
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
              console.error('❌ FriendRequestActivitySocial: Reject failed:', error);
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
        <View style={styles.successContainer}>
          <View style={styles.successCard}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={28} color="#34C759" />
            </View>
            <Text style={styles.successTitle}>You're now friends!</Text>
            <Text style={styles.successSubtitle}>
              You and {requester.username} can now see each other's posts
            </Text>
          </View>
        </View>
      );
    }

    if (actionTaken === 'rejected') {
      return (
        <View style={styles.rejectedContainer}>
          <View style={styles.rejectedCard}>
            <Ionicons name="close-circle" size={20} color="#8E8E93" />
            <Text style={styles.rejectedText}>Request declined</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.declineButton]}
          onPress={handleDecline}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="close" size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Decline</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={handleAccept}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Accept</Text>
            </>
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

      {/* Main Content Card */}
      <View style={styles.contentCard}>
        {/* Profile Header */}
        <TouchableOpacity 
          style={styles.profileHeader}
          onPress={handleViewProfile}
          activeOpacity={0.95}
        >
          <View style={styles.profileImageWrapper}>
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
            <View style={styles.friendRequestBadge}>
              <Ionicons name="person-add" size={12} color="#FFFFFF" />
            </View>
          </View>
          
          <View style={styles.profileDetails}>
            <Text style={styles.displayName}>
              {requester.fullName || requester.username}
            </Text>
            <Text style={styles.username}>@{requester.username}</Text>
            
            {requester.mutualFriends && (
              <View style={styles.mutualFriendsRow}>
                <Ionicons name="people" size={14} color="#AF52DE" />
                <Text style={styles.mutualFriendsText}>
                  {requester.mutualFriends} mutual friends
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Message Card */}
        {message && message !== 'I would like to add you as a friend.' && (
          <View style={styles.messageCard}>
            <View style={styles.messageHeader}>
              <Ionicons name="chatbubble-outline" size={16} color="#AF52DE" />
              <Text style={styles.messageLabel}>Personal message</Text>
            </View>
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
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  
  contentCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  
  profileImageWrapper: {
    position: 'relative',
    marginRight: 16,
  },
  
  profileImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  
  defaultProfileImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E5E5E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  defaultProfileText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#8E8E93',
  },
  
  friendRequestBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#AF52DE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  
  profileDetails: {
    flex: 1,
  },
  
  displayName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  
  username: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 8,
  },
  
  mutualFriendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  
  mutualFriendsText: {
    fontSize: 14,
    color: '#AF52DE',
    fontWeight: '600',
  },
  
  messageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  
  messageLabel: {
    fontSize: 12,
    color: '#AF52DE',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  messageText: {
    fontSize: 16,
    color: '#1C1C1E',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  
  acceptButton: {
    backgroundColor: '#34C759',
  },
  
  declineButton: {
    backgroundColor: '#FF3B30',
  },
  
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  
  successContainer: {
    alignItems: 'center',
  },
  
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#34C759',
    shadowColor: '#34C759',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  successIconContainer: {
    marginBottom: 12,
  },
  
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#34C759',
    marginBottom: 8,
    textAlign: 'center',
  },
  
  successSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  rejectedContainer: {
    alignItems: 'center',
  },
  
  rejectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    gap: 8,
  },
  
  rejectedText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default FriendRequestActivitySocial;
