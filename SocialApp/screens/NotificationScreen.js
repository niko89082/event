// SocialApp/screens/NotificationScreen.js - PHASE 2: Enhanced with swipe-to-delete functionality
import React, { useEffect, useState, useContext, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, SafeAreaView, StatusBar, Alert, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { useIsFocused } from '@react-navigation/native';
import { API_BASE_URL } from '@env';
import { useFriendRequestManager } from '../hooks/useFriendRequestManager';

// Import our new swipeable component
import SwipeableNotificationItem from '../components/SwipeableNotificationItem';

export default function NotificationScreen({ navigation }) {
  const { currentUser } = useContext(AuthContext);
  const isFocused = useIsFocused();

  // Enhanced state management
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({ total: 0 });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [processingRequests, setProcessingRequests] = useState(new Set()); // Track processing friend requests
  const friendRequestManager = useFriendRequestManager('NotificationScreen', {
      showSuccessAlerts: false, // We handle our own alerts
      onAcceptSuccess: handleFriendRequestAccepted,
      onRejectSuccess: handleFriendRequestRejected,
      onRefreshRequired: () => fetchNotifications(true)
    });

  useEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: '#FFFFFF',
        shadowOpacity: 0,
        elevation: 0,
        borderBottomWidth: 0.5,
        borderBottomColor: '#E1E1E1',
      },
      headerTitleStyle: {
        fontWeight: '700',
        fontSize: 18,
        color: '#000000',
      },
      headerTitle: 'Notifications',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color="#000000" />
        </TouchableOpacity>
      ),
    });
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchNotifications(true);
      fetchUnreadCounts();
    }
  }, [isFocused]);

  function handleFriendRequestAccepted(data) {
  console.log('🎉 NotificationScreen: Friend request accepted', data);
  
  // Update the notification in the list
  setNotifications(prev => prev.map(notif => {
    if (notif._id === data.notificationId || 
        (notif.sender._id === data.requesterId && notif.type === 'friend_request')) {
      return {
        ...notif,
        data: {
          ...notif.data,
          actionTaken: 'accepted'
        }
      };
    }
    return notif;
  }));

  // Update unread counts
  setUnreadCounts(prev => ({
    ...prev,
    social: Math.max(0, prev.social - 1)
  }));

  // ✅ NEW: Clean up any duplicate/stale friend request notifications
  if (data.requesterId && currentUser?._id) {
    cleanupFriendRequestNotifications(data.requesterId, currentUser._id, 'accepted');
  }

  // ✅ NEW: Refresh notifications after a short delay to sync with backend
  setTimeout(() => {
    fetchNotifications(true);
  }, 2000);
}


  function handleFriendRequestRejected(data) {
    console.log('❌ NotificationScreen: Friend request rejected', data);
    
    // Remove the notification from the list (auto-remove rejected requests)
    setNotifications(prev => prev.filter(notif => {
      const isTargetNotification = notif._id === data.notificationId || 
        (notif.sender._id === data.requesterId && notif.type === 'friend_request');
      return !isTargetNotification;
    }));

    // Update unread counts
    setUnreadCounts(prev => ({
      ...prev,
      social: Math.max(0, prev.social - 1)
    }));
  }

  /* ═══════════════════════════════════════════════════════════════════
     🔧 PHASE 2 NEW: Enhanced notification deletion with optimistic updates
  ═══════════════════════════════════════════════════════════════════ */
  const handleDeleteNotification = async (notificationId) => {
    try {
      // Find the notification being deleted
      const deletedNotification = notifications.find(n => n._id === notificationId);
      
      // Optimistic update - remove from UI immediately
      setNotifications(prev => prev.filter(n => n._id !== notificationId));
      
      // Update unread counts optimistically
      if (deletedNotification && !deletedNotification.isRead) {
        setUnreadCounts(prev => ({
          total: Math.max(0, prev.total - 1)
        }));
      }

      // Make API call to actually delete
      await api.delete(`/api/notifications/${notificationId}`);
      
      console.log(`✅ Successfully deleted notification ${notificationId}`);
      
    } catch (error) {
      console.error('Error deleting notification:', error);
      
      // Rollback optimistic update on failure
      fetchNotifications(true);
      fetchUnreadCounts();
      
      Alert.alert(
        'Error', 
        'Failed to remove notification. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  /* ═══════════════════════════════════════════════════════════════════
     DATA FETCHING WITH REFRESH SUPPORT
  ═══════════════════════════════════════════════════════════════════ */

  
const FriendRequestActions = ({ notification, onActionComplete }) => {
  const [actionTaken, setActionTaken] = useState(notification.data?.actionTaken || null);
  const requesterId = notification.sender._id;
  const notificationId = notification._id;

  // ✅ NEW: Check if users are already friends (this handles the case where friendship was established outside notifications)
  const [currentFriendshipStatus, setCurrentFriendshipStatus] = useState(null);

  useEffect(() => {
    // Check current friendship status when component mounts
    const checkFriendshipStatus = async () => {
      try {
        const response = await api.get(`/api/friends/status/${requesterId}`);
        setCurrentFriendshipStatus(response.data.status);
      } catch (error) {
        console.error('Error checking friendship status:', error);
      }
    };

    checkFriendshipStatus();
  }, [requesterId]);

  const handleAccept = async () => {
    if (friendRequestManager.isProcessing()) return;
    
    try {
      await friendRequestManager.acceptRequest(requesterId, notificationId);
      setActionTaken('accepted');
      setCurrentFriendshipStatus('friends');
      
      // Call the existing onActionComplete for backward compatibility
      onActionComplete('accepted', notificationId, { actionTaken: 'accepted' });
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request. Please try again.');
    }
  };

  const handleReject = async () => {
    if (friendRequestManager.isProcessing()) return;
    
    Alert.alert(
      'Reject Friend Request',
      `Are you sure you want to reject ${notification.sender.username}'s friend request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reject', 
          style: 'destructive',
          onPress: async () => {
            try {
              await friendRequestManager.rejectRequest(requesterId, notificationId, null, {
                autoRemove: true
              });
              setActionTaken('rejected');
              
              // Call the existing onActionComplete for backward compatibility
              onActionComplete('rejected', notificationId, { shouldRemove: true });
            } catch (error) {
              console.error('Error rejecting friend request:', error);
              Alert.alert('Error', 'Failed to reject friend request. Please try again.');
            }
          }
        }
      ]
    );
  };

  // ✅ NEW: If they're already friends, show the accepted state
  const finalActionTaken = currentFriendshipStatus === 'friends' ? 'accepted' : actionTaken;

  // Show different states based on action taken
  if (finalActionTaken === 'accepted') {
    return (
      <View style={styles.friendRequestResult}>
        <View style={[styles.resultBadge, styles.acceptedBadge]}>
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          <Text style={styles.resultText}>Friends</Text>
        </View>
        <Text style={styles.friendshipMessage}>
          You and {notification.sender.username} are now friends!
        </Text>
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={() => handleDeleteNotification(notification._id)}
        >
          <Text style={styles.deleteButtonText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (finalActionTaken === 'rejected') {
    // This should not render since rejected notifications are auto-removed
    return null;
  }

  // Show action buttons for pending requests
  const isProcessing = friendRequestManager.isProcessing();
  
  return (
    <View style={styles.friendRequestActions}>
      <TouchableOpacity
        style={[
          styles.actionButton,
          styles.rejectButton,
          isProcessing && styles.buttonLoading
        ]}
        onPress={handleReject}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="close" size={16} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Reject</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.actionButton,
          styles.acceptButton,
          isProcessing && styles.buttonLoading
        ]}
        onPress={handleAccept}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Accept</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

  const fetchNotifications = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      const targetPage = reset ? 1 : page;
      const response = await api.get(`/api/notifications?page=${targetPage}&limit=20`);
      
      if (reset) {
        setNotifications(response.data.notifications || []);
      } else {
        setNotifications(prev => [...prev, ...(response.data.notifications || [])]);
      }
      
      setHasMore(response.data.pagination?.hasMore || false);
      setPage(targetPage + 1);
      
      if (response.data.unreadCounts) {
        setUnreadCounts({ total: response.data.unreadCounts.total || 0 });
      }
      
    } catch (error) {
      console.error('Error fetching notifications:', error);
      Alert.alert('Error', 'Failed to fetch notifications');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const fetchUnreadCounts = async () => {
    try {
      const response = await api.get('/api/notifications/unread-count');
      setUnreadCounts({ total: response.data.total || 0 });
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    }
  };

  // Pull to refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications(true);
  }, []);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchNotifications(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════
     NOTIFICATION MANAGEMENT
  ═══════════════════════════════════════════════════════════════════ */


  const markAsRead = async (notificationId) => {
    try {
      await api.put(`/api/notifications/${notificationId}/read`);
      
      setNotifications(prev =>
        prev.map(notif =>
          notif._id === notificationId ? { ...notif, isRead: true } : notif
        )
      );
      
      const notification = notifications.find(n => n._id === notificationId);
      if (notification && !notification.isRead) {
        setUnreadCounts(prev => ({
          total: Math.max(0, prev.total - 1)
        }));
      }
      
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════
     NAVIGATION ACTIONS
  ═══════════════════════════════════════════════════════════════════ */
  const cleanupFriendRequestNotifications = async (userId1, userId2, action) => {
  try {
    // Call backend endpoint to clean up related notifications
    await api.post('/api/notifications/cleanup-friend-requests', {
      userId1,
      userId2,
      action // 'accepted' or 'rejected'
    });
    console.log('✅ Cleaned up friend request notifications');
  } catch (error) {
    console.error('❌ Error cleaning up notifications:', error);
  }
};


  const handleNotificationPress = async (notification) => {
    // Don't navigate if it's a friend request - handled by buttons
    if (notification.type === 'friend_request') {
      return;
    }

    // Mark as read when tapped
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }

    // Navigate based on action type
    switch (notification.actionType) {
      case 'VIEW_PROFILE':
        navigation.navigate('ProfileScreen', { 
          userId: notification.actionData?.userId || notification.sender?._id 
        });
        break;
        
      case 'VIEW_EVENT':
        navigation.navigate('EventDetailsScreen', { 
          eventId: notification.actionData?.eventId || notification.data?.eventId 
        });
        break;
        
      case 'VIEW_MEMORY':
        navigation.navigate('MemoryDetailsScreen', { 
          memoryId: notification.actionData?.memoryId || notification.data?.memoryId 
        });
        break;
        
      case 'VIEW_POST':
        navigation.navigate('PostDetailsScreen', { 
          postId: notification.actionData?.postId || notification.data?.postId 
        });
        break;
        
      default:
        console.log('🔔 No specific action for notification type:', notification.type);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════
     DISPLAY HELPERS
  ═══════════════════════════════════════════════════════════════════ */

  const getNotificationIcon = (notification) => {
    const iconMap = {
      'friend_request': 'person-add',
      'friend_request_accepted': 'checkmark-circle',
      'new_follower': 'people',
      'memory_invitation': 'images',
      'memory_photo_added': 'camera',
      'memory_photo_batch': 'photos',
      'event_invitation': 'calendar',
      'event_reminder': 'time',
      'event_reminder_1_hour': 'alarm',
      'event_rsvp_batch': 'people',
      'post_liked': 'heart',
      'post_commented': 'chatbubble'
    };
    
    return iconMap[notification.type] || 'notifications';
  };

  const getNotificationColor = (notification) => {
    if (notification.priority === 'high') return '#FF3B30';
    if (notification.category === 'events') return '#3797EF';
    return '#8E44AD';
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

  /* ═══════════════════════════════════════════════════════════════════
     FRIEND REQUEST ORGANIZATION MODES
  ═══════════════════════════════════════════════════════════════════ */

  // Friend request organization modes
  const FRIEND_REQUEST_MODES = {
    INLINE: 'inline',           // Mode A: Friend requests appear inline with other notifications
    GROUPED_TOP: 'grouped_top', // Mode B: All pending friend requests grouped at top
    SEPARATE_SECTION: 'separate_section' // Mode C: Dedicated "Friend Requests" section
  };

  // Default to Mode A (inline) - can be changed via user preference
  const [friendRequestMode] = useState(FRIEND_REQUEST_MODES.INLINE);

  // Helper function to organize notifications based on mode
  const organizeNotifications = (notifications) => {
    if (friendRequestMode === FRIEND_REQUEST_MODES.INLINE) {
      // Mode A: Return notifications as-is (inline)
      return notifications;
    }
    
    if (friendRequestMode === FRIEND_REQUEST_MODES.GROUPED_TOP) {
      // Mode B: Group friend requests at top
      const friendRequests = notifications.filter(n => n.type === 'friend_request' && !n.data?.actionTaken);
      const otherNotifications = notifications.filter(n => !(n.type === 'friend_request' && !n.data?.actionTaken));
      return [...friendRequests, ...otherNotifications];
    }
    
    if (friendRequestMode === FRIEND_REQUEST_MODES.SEPARATE_SECTION) {
      // Mode C: Separate sections (implemented in render)
      return notifications;
    }
    
    return notifications;
  };

  // Helper function to get friend request notifications
  const getFriendRequestNotifications = (notifications) => {
    return notifications.filter(n => n.type === 'friend_request' && !n.data?.actionTaken);
  };

  // Helper function to get non-friend request notifications
  const getOtherNotifications = (notifications) => {
    return notifications.filter(n => !(n.type === 'friend_request' && !n.data?.actionTaken));
  };


  /* ═══════════════════════════════════════════════════════════════════
     SECTION HEADERS FOR FRIEND REQUEST MODES
  ═══════════════════════════════════════════════════════════════════ */

  const renderFriendRequestSectionHeader = (count) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderContent}>
        <Ionicons name="people" size={20} color="#3797EF" />
        <Text style={styles.sectionHeaderTitle}>Friend Requests</Text>
        {count > 0 && (
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{count > 9 ? '9+' : count}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderOtherNotificationsSectionHeader = () => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderContent}>
        <Ionicons name="notifications" size={20} color="#8E8E93" />
        <Text style={styles.sectionHeaderTitle}>Other Notifications</Text>
      </View>
    </View>
  );

  /* ═══════════════════════════════════════════════════════════════════
     🔧 PHASE 2 ENHANCED: Render notification item with swipe functionality
  ═══════════════════════════════════════════════════════════════════ */

  const renderNotificationItem = ({ item }) => {
    const iconName = getNotificationIcon(item);
    const iconColor = getNotificationColor(item);
    const isFriendRequest = item.type === 'friend_request';
    const hasActionTaken = item.data?.actionTaken;

    const handleActionComplete = (action, notificationId, data) => {
  console.log('🎯 Friend request action completed:', { action, notificationId, data });
  
  // Update the notification state
  setNotifications(prev => prev.map(notif => {
    if (notif._id === notificationId) {
      if (action === 'rejected' || data?.shouldRemove) {
        // ✅ NEW: Remove rejected notifications or manually dismissed ones
        return null;
      } else if (action === 'accepted') {
        // ✅ NEW: Update accepted notifications with friendship state
        return {
          ...notif,
          data: {
            ...notif.data,
            actionTaken: 'accepted',
            notificationState: data?.notificationState
          }
        };
      }
    }
    return notif;
  }).filter(Boolean)); // Remove null entries
  
  // Update unread counts
  if (action === 'rejected' || data?.shouldRemove) {
    setUnreadCounts(prev => ({
      ...prev,
      social: Math.max(0, prev.social - 1)
    }));
  }
  
  // Refresh notifications to get latest state
  setTimeout(() => {
    fetchNotifications(true);
  }, 1000);
};


    const handleRegularNotificationPress = () => {
      if (isFriendRequest) {
        // For friend requests, only navigate if action has been taken
        if (hasActionTaken) {
          navigation.navigate('ProfileScreen', { 
            userId: item.sender._id 
          });
        }
        return;
      }
      
      // Handle other notification types normally
      handleNotificationPress(item);
    };

    return (
      <SwipeableNotificationItem
        item={item}
        onDelete={handleDeleteNotification}
        disabled={isFriendRequest && !hasActionTaken} // Disable swipe for pending friend requests
      >
        <TouchableOpacity
          style={[
            styles.notificationItem, 
            !item.isRead && styles.unreadNotification,
            isFriendRequest && styles.friendRequestNotification
          ]}
          onPress={handleRegularNotificationPress}
          activeOpacity={isFriendRequest && !hasActionTaken ? 1 : 0.7}
          disabled={isFriendRequest && !hasActionTaken}
        >
          <View style={styles.notificationRow}>
            {/* Profile Picture or Icon */}
            <View style={styles.notificationIconContainer}>
              {item.sender?.profilePicture ? (
                <Image 
                  source={{ uri: `${API_BASE_URL}/${item.sender.profilePicture}` }}
                  style={styles.profilePicture}
                />
              ) : (
                <View style={[styles.defaultIcon, { backgroundColor: iconColor + '20' }]}>
                  <Ionicons name={iconName} size={20} color={iconColor} />
                </View>
              )}
              
              {/* Unread indicator */}
              {!item.isRead && (
                <View style={styles.unreadDot} />
              )}
            </View>

            {/* Notification Content */}
            <View style={styles.notificationContent}>
              <View style={styles.notificationTextContainer}>
                <Text style={styles.notificationTitle}>
                  {item.title}
                </Text>
                <Text style={styles.notificationMessage}>
                  {item.message}
                </Text>
                <Text style={styles.notificationTime}>
                  {getTimeAgo(item.createdAt)}
                </Text>
              </View>

              {/* Friend Request Actions */}
              {isFriendRequest && (
                <FriendRequestActions 
                  notification={item}
                  onActionComplete={handleActionComplete}
                />
              )}
            </View>
          </View>
        </TouchableOpacity>
      </SwipeableNotificationItem>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptySubtitle}>
        You're all caught up! We'll notify you when something new happens.
      </Text>
    </View>
  );

  if (loading && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <FlatList
        data={organizeNotifications(notifications)}
        keyExtractor={(item) => item._id}
        renderItem={renderNotificationItem}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3797EF']}
            tintColor="#3797EF"
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color="#3797EF" />
              <Text style={styles.loadingFooterText}>Loading more...</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ENHANCED STYLES WITH PHASE 2 IMPROVEMENTS
═══════════════════════════════════════════════════════════════════ */

const enhancedStyles = {
  // Enhanced notification item styles
  friendRequestNotification: {
    backgroundColor: '#F8F9FE', // Slightly different background for friend requests
    borderLeftWidth: 3,
    borderLeftColor: '#3797EF',
  },
  
  notificationContent: {
    flex: 1,
    flexDirection: 'column',
  },
  
  notificationTextContainer: {
    flex: 1,
    marginBottom: 8, // Add space for action buttons
  },
  
  // Friend request action styles
  friendRequestActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 110,
    gap: 6,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  
  acceptButton: {
    backgroundColor: '#34C759',
    flex: 1,
  },
  
  rejectButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FF3B30',
    flex: 1,
  },
  
  acceptButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  
  rejectButtonText: {
    color: '#FF3B30',
    fontWeight: '700',
    fontSize: 15,
  },
  
  // Result state styles
  friendRequestResult: {
    marginTop: 12,
    alignItems: 'flex-start',
  },
  
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  
  acceptedBadge: {
    backgroundColor: '#34C759',
  },
  
  rejectedBadge: {
    backgroundColor: '#8E8E93',
  },
  
  resultText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  
  // Enhanced profile picture styles
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
    top: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3797EF',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },

  // Enhanced notification row layout
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 60, // Ensure consistent height
  },
  
  notificationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    position: 'relative',
    marginTop: 4, // Slight adjustment for visual alignment
  },
  
  // Enhanced notification item container
  notificationItem: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EFEFEF',
  },
  
  unreadNotification: {
    backgroundColor: '#F8F9FA',
    borderLeftWidth: 3,
    borderLeftColor: '#3797EF',
  },
  
  // Title and message styling enhancements
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
    lineHeight: 20,
  },
  
  notificationMessage: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
    marginBottom: 6,
  },
  
  notificationTime: {
    fontSize: 12,
    color: '#C7C7CC',
    fontWeight: '500',
  },
};

const styles = StyleSheet.create({
  ...enhancedStyles,

  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  listContainer: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingFooterText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  deleteButton: {
      marginTop: 8,
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    deleteButtonText: {
      color: '#3797EF',
      fontSize: 13,
      fontWeight: '500',
    },
  friendshipMessage: {
    fontSize: 14,
    color: '#1C1C1E',
    textAlign: 'center',
    marginTop: 8,
  },
  
  // Section header styles for friend request modes
  sectionHeader: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
  },
  
  sectionBadge: {
    backgroundColor: '#3797EF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  
  sectionBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});