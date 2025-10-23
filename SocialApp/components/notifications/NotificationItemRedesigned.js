// components/notifications/NotificationItemRedesigned.js - Modern Notification Item
import React, { useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '@env';

const NotificationItemRedesigned = ({ 
  notification, 
  onPress, 
  onDelete,
  onActionComplete 
}) => {
  const [actionTaken, setActionTaken] = useState(notification.data?.actionTaken || null);
  const [processing, setProcessing] = useState(false);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'friend_request':
        return 'person-add';
      case 'event_invite':
        return 'calendar';
      case 'photo_like':
        return 'heart';
      case 'comment':
        return 'chatbubble';
      case 'event_reminder':
        return 'time';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'friend_request':
        return '#AF52DE';
      case 'event_invite':
        return '#FF9500';
      case 'photo_like':
        return '#FF3B30';
      case 'comment':
        return '#007AFF';
      case 'event_reminder':
        return '#34C759';
      default:
        return '#8E8E93';
    }
  };

  const handleAccept = async () => {
    if (processing) return;
    
    setProcessing(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setActionTaken('accepted');
      onActionComplete?.('accepted', notification._id);
    } catch (error) {
      Alert.alert('Error', 'Failed to accept request');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (processing) return;
    
    Alert.alert(
      'Reject Request',
      'Are you sure you want to reject this request?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reject', 
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              await new Promise(resolve => setTimeout(resolve, 1000));
              setActionTaken('rejected');
              onActionComplete?.('rejected', notification._id);
            } catch (error) {
              Alert.alert('Error', 'Failed to reject request');
            } finally {
              setProcessing(false);
            }
          }
        }
      ]
    );
  };

  const renderFriendRequestActions = () => {
    if (actionTaken === 'accepted') {
      return (
        <View style={styles.successContainer}>
          <LinearGradient
            colors={['#34C759', '#30B04A']}
            style={styles.successGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
            <Text style={styles.successText}>Accepted</Text>
          </LinearGradient>
        </View>
      );
    }

    if (actionTaken === 'rejected') {
      return (
        <View style={styles.rejectedContainer}>
          <View style={styles.rejectedBadge}>
            <Ionicons name="close-circle" size={16} color="#8E8E93" />
            <Text style={styles.rejectedText}>Declined</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.declineButton]}
          onPress={handleReject}
          disabled={processing}
          activeOpacity={0.8}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.actionButtonText}>Decline</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={handleAccept}
          disabled={processing}
          activeOpacity={0.8}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.actionButtonText}>Accept</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const iconName = getNotificationIcon(notification.type);
  const iconColor = getNotificationColor(notification.type);
  const isFriendRequest = notification.type === 'friend_request';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        !notification.isRead && styles.unreadContainer,
        isFriendRequest && styles.friendRequestContainer
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={isFriendRequest && !actionTaken}
    >
      <View style={styles.content}>
        {/* Icon/Profile Picture */}
        <View style={styles.iconContainer}>
          {notification.sender?.profilePicture ? (
            <Image 
              source={{ 
                uri: notification.sender.profilePicture.startsWith('http') 
                  ? notification.sender.profilePicture 
                  : `http://${API_BASE_URL}:3000${notification.sender.profilePicture}` 
              }}
              style={styles.profilePicture}
            />
          ) : (
            <View style={[styles.defaultIcon, { backgroundColor: iconColor + '20' }]}>
              <Ionicons name={iconName} size={20} color={iconColor} />
            </View>
          )}
          
          {/* Unread indicator */}
          {!notification.isRead && (
            <View style={styles.unreadDot} />
          )}
        </View>

        {/* Notification Content */}
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {notification.title}
          </Text>
          <Text style={styles.message} numberOfLines={3}>
            {notification.message}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(notification.createdAt).toLocaleDateString()}
          </Text>
        </View>

        {/* Action Buttons for Friend Requests */}
        {isFriendRequest && (
          <View style={styles.actionsContainer}>
            {renderFriendRequestActions()}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  
  unreadContainer: {
    borderLeftWidth: 4,
    borderLeftColor: '#3797EF',
    backgroundColor: '#F8F9FA',
  },
  
  friendRequestContainer: {
    borderWidth: 1,
    borderColor: '#AF52DE',
  },
  
  content: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  
  iconContainer: {
    position: 'relative',
    marginRight: 12,
  },
  
  profilePicture: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  
  defaultIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3797EF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
    lineHeight: 20,
  },
  
  message: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
    marginBottom: 8,
  },
  
  timestamp: {
    fontSize: 12,
    color: '#C7C7CC',
    fontWeight: '500',
  },
  
  actionsContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  
  acceptButton: {
    backgroundColor: '#34C759',
  },
  
  declineButton: {
    backgroundColor: '#FF3B30',
  },
  
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  
  successContainer: {
    alignItems: 'center',
  },
  
  successGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  
  successText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  
  rejectedContainer: {
    alignItems: 'center',
  },
  
  rejectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    gap: 4,
  },
  
  rejectedText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default NotificationItemRedesigned;
