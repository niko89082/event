// components/notifications/FriendRequestNotificationRedesigned.js - Instagram/Facebook Style Notification Component
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
import api from '../../services/api';

const { width } = Dimensions.get('window');

const FriendRequestNotificationRedesigned = ({ 
  notification, 
  onActionComplete,
  onDelete 
}) => {
  const { sender, data, createdAt } = notification;
  const [actionTaken, setActionTaken] = useState(data?.actionTaken || null);
  const [localProcessing, setLocalProcessing] = useState(false);
  const [currentFriendshipStatus, setCurrentFriendshipStatus] = useState(null);

  // Integration with FriendRequestManager
  const friendRequestManager = useFriendRequestManager('FriendRequestNotificationRedesigned', {
    showSuccessAlerts: false,
    onAcceptSuccess: handleAcceptSuccess,
    onRejectSuccess: handleRejectSuccess,
    onError: handleError
  });

  useEffect(() => {
    // Check current friendship status when component mounts
    const checkFriendshipStatus = async () => {
      try {
        const response = await api.get(`/api/friends/status/${sender._id}`);
        setCurrentFriendshipStatus(response.data.status);
      } catch (error) {
        console.error('Error checking friendship status:', error);
      }
    };

    checkFriendshipStatus();
  }, [sender._id]);

  function handleAcceptSuccess(data) {
    console.log('🎉 FriendRequestNotificationRedesigned: Accept success', data);
    
    if (data.notificationId === notification._id || data.requesterId === sender._id) {
      setActionTaken('accepted');
      setCurrentFriendshipStatus('friends');
      setLocalProcessing(false);
      
      // Call completion handler
      onActionComplete('accepted', notification._id, { actionTaken: 'accepted' });
    }
  }

  function handleRejectSuccess(data) {
    console.log('❌ FriendRequestNotificationRedesigned: Reject success', data);
    
    if (data.notificationId === notification._id || data.requesterId === sender._id) {
      setActionTaken('rejected');
      setLocalProcessing(false);
      
      // Call completion handler
      onActionComplete('rejected', notification._id, { shouldRemove: true });
    }
  }

  function handleError(data) {
    console.error('❌ FriendRequestNotificationRedesigned: Error', data);
    
    if (data.notificationId === notification._id || data.requesterId === sender._id) {
      setLocalProcessing(false);
      
      Alert.alert(
        'Error',
        data.error || 'An error occurred. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  }

  const handleAccept = async () => {
    if (friendRequestManager.isProcessing()) return;
    
    try {
      await friendRequestManager.acceptRequest(sender._id, notification._id);
      setActionTaken('accepted');
      setCurrentFriendshipStatus('friends');
      
      onActionComplete('accepted', notification._id, { actionTaken: 'accepted' });
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request. Please try again.');
    }
  };

  const handleReject = async () => {
    if (friendRequestManager.isProcessing()) return;
    
    Alert.alert(
      'Reject Friend Request',
      `Are you sure you want to reject ${sender.username}'s friend request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reject', 
          style: 'destructive',
          onPress: async () => {
            try {
              await friendRequestManager.rejectRequest(sender._id, notification._id, null, {
                autoRemove: true
              });
              setActionTaken('rejected');
              
              onActionComplete('rejected', notification._id, { shouldRemove: true });
            } catch (error) {
              console.error('Error rejecting friend request:', error);
              Alert.alert('Error', 'Failed to reject friend request. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleViewProfile = () => {
    // Navigate to profile - this would need navigation prop
    console.log('Navigate to profile:', sender._id);
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
    const isProcessing = friendRequestManager.isProcessing();
    const finalActionTaken = currentFriendshipStatus === 'friends' ? 'accepted' : actionTaken;

    if (finalActionTaken === 'accepted') {
      return (
        <View style={styles.resultContainer}>
          <View style={styles.resultBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
            <Text style={styles.resultText}>Friends</Text>
          </View>
          <Text style={styles.friendshipMessage}>
            You and {sender.username} are now friends!
          </Text>
          <TouchableOpacity 
            style={styles.dismissButton} 
            onPress={() => onDelete(notification._id)}
          >
            <Text style={styles.dismissButtonText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (finalActionTaken === 'rejected') {
      return null; // Rejected notifications are auto-removed
    }

    // Show action buttons for pending requests - Instagram style with red X
    return (
      <View style={styles.inlineActions}>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            isProcessing && styles.buttonLoading
          ]}
          onPress={handleAccept}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.confirmButtonText}>Confirm</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.deleteIconButton,
            isProcessing && styles.buttonLoading
          ]}
          onPress={handleReject}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="close" size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Main notification content with inline actions */}
      <View style={styles.notificationRow}>
        {/* Profile picture */}
        <View style={styles.profileContainer}>
          {sender.profilePicture ? (
            <Image 
              source={{ 
                uri: sender.profilePicture.startsWith('http') 
                  ? sender.profilePicture 
                  : `http://${API_BASE_URL}:3000${sender.profilePicture}` 
              }} 
              style={styles.profilePicture}
            />
          ) : (
            <View style={styles.defaultProfilePicture}>
              <Text style={styles.defaultProfileText}>
                {sender.username?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>

        {/* Notification text */}
        <View style={styles.textContainer}>
          <Text style={styles.notificationText}>
            <Text style={styles.boldText}>{sender.username || sender.displayName}</Text>
          </Text>
          <View style={styles.metaRow}>
            {data?.mutualFriends > 0 ? (
              <Text style={styles.metaText}>
                {data.mutualFriends} mutual{data.mutualFriends !== 1 ? 's' : ''}
              </Text>
            ) : data?.sharedEvents > 0 ? (
              <Text style={styles.metaText}>
                {data.sharedEvents} shared event{data.sharedEvents !== 1 ? 's' : ''}
              </Text>
            ) : null}
            <Text style={styles.timeAgo}>
              {data?.mutualFriends > 0 || data?.sharedEvents > 0 ? ' • ' : ''}
              {getTimeAgo(createdAt)}
            </Text>
          </View>
        </View>

        {/* Action buttons - right next to the user like Instagram */}
        {renderActionButtons()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EFEFEF',
  },
  
  // Instagram-style notification row
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  profileContainer: {
    marginRight: 12,
  },
  
  profilePicture: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0F0',
  },
  
  defaultProfilePicture: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E5E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  defaultProfileText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
  },
  
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  
  notificationText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 20,
    marginBottom: 4,
  },
  
  boldText: {
    fontWeight: '600',
  },
  
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  
  metaText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  
  timeAgo: {
    fontSize: 12,
    color: '#8E8E93',
  },
  
  // Instagram-style inline actions
  inlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  confirmButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 70,
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
  },
  
  deleteIconButton: {
    backgroundColor: '#FF3B30',
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  buttonLoading: {
    opacity: 0.7,
  },
  
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  
  // Result styles
  resultContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    marginBottom: 8,
  },
  
  resultText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  
  friendshipMessage: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 8,
    lineHeight: 16,
  },
  
  dismissButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  
  dismissButtonText: {
    color: '#3797EF',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default FriendRequestNotificationRedesigned;
