// SocialApp/screens/NotificationScreen.js - Enhanced with friend request actions & refresh
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
export default function NotificationScreen({ navigation }) {
  const { currentUser } = useContext(AuthContext);
  const isFocused = useIsFocused();

  // Enhanced state management
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [unreadCounts, setUnreadCounts] = useState({ total: 0, social: 0, events: 0 });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [processingRequests, setProcessingRequests] = useState(new Set()); // Track processing friend requests

  const CATEGORIES = [
    { key: 'all', label: 'All', icon: 'notifications-outline' },
    { key: 'social', label: 'Social', icon: 'people-outline' },
    { key: 'events', label: 'Events', icon: 'calendar-outline' }
  ];

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
      headerRight: () => (
        <TouchableOpacity
          onPress={markAllAsRead}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Text style={styles.markAllReadText}>Mark All Read</Text>
        </TouchableOpacity>
      ),
    });
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchNotifications(true);
      fetchUnreadCounts();
    }
  }, [isFocused, activeCategory]);

  /* ═══════════════════════════════════════════════════════════════════
     DATA FETCHING WITH REFRESH SUPPORT
  ═══════════════════════════════════════════════════════════════════ */
const FriendRequestActions = ({ notification, onActionComplete }) => {
  const [loading, setLoading] = useState(null); // 'accept' | 'reject' | null
  const [actionTaken, setActionTaken] = useState(notification.data?.actionTaken || null);

  const handleAccept = async () => {
    if (loading || actionTaken) return;
    
    setLoading('accept');
    try {
      console.log('🤝 Accepting friend request from:', notification.sender.username);
      
      // ✅ FIXED: Use your existing /api/friends/accept/:userId endpoint
      const response = await api.post(`/friends/accept/${notification.sender._id}`);
      
      if (response.data.success) {
        setActionTaken('accepted');
        onActionComplete('accepted', notification._id, response.data.data);
        
        // Show success feedback
        Alert.alert(
          '🎉 Friend Request Accepted!',
          response.data.message,
          [{ text: 'Great!', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      
      const errorMessage = error.response?.data?.message || 'Failed to accept friend request. Please try again.';
      
      Alert.alert(
        'Error',
        errorMessage,
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    if (loading || actionTaken) return;
    
    // Show confirmation dialog
    Alert.alert(
      'Reject Friend Request',
      `Are you sure you want to reject ${notification.sender.username}'s friend request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reject', 
          style: 'destructive',
          onPress: async () => {
            setLoading('reject');
            try {
              console.log('❌ Rejecting friend request from:', notification.sender.username);
              
              // ✅ FIXED: Use your existing /api/friends/reject/:userId endpoint (DELETE method)
              const response = await api.delete(`/friends/reject/${notification.sender._id}`);
              
              if (response.data.success) {
                setActionTaken('rejected');
                onActionComplete('rejected', notification._id, response.data.data);
              }
            } catch (error) {
              console.error('Error rejecting friend request:', error);
              
              const errorMessage = error.response?.data?.message || 'Failed to reject friend request. Please try again.';
              
              Alert.alert(
                'Error',
                errorMessage,
                [{ text: 'OK', style: 'default' }]
              );
            } finally {
              setLoading(null);
            }
          }
        }
      ]
    );
  };

  // Show result state if action was taken
  if (actionTaken) {
    return (
      <View style={styles.friendRequestResult}>
        <View style={[
          styles.resultBadge,
          actionTaken === 'accepted' ? styles.acceptedBadge : styles.rejectedBadge
        ]}>
          <Ionicons 
            name={actionTaken === 'accepted' ? 'checkmark' : 'close'} 
            size={16} 
            color="#FFFFFF" 
          />
          <Text style={styles.resultText}>
            {actionTaken === 'accepted' ? 'Accepted' : 'Rejected'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.friendRequestActions}>
      <TouchableOpacity
        style={[styles.actionButton, styles.rejectButton]}
        onPress={handleReject}
        disabled={loading !== null}
        activeOpacity={0.8}
      >
        {loading === 'reject' ? (
          <ActivityIndicator size="small" color="#FF3B30" />
        ) : (
          <>
            <Ionicons name="close" size={18} color="#FF3B30" />
            <Text style={styles.rejectButtonText}>Reject</Text>
          </>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.actionButton, styles.acceptButton]}
        onPress={handleAccept}
        disabled={loading !== null}
        activeOpacity={0.8}
      >
        {loading === 'accept' ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            <Text style={styles.acceptButtonText}>Accept</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

// ============================================================================
// BONUS: Component for handling sent friend requests (for other screens)
// ============================================================================

const SentFriendRequestActions = ({ userId, username, onActionComplete }) => {
  const [loading, setLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const handleCancel = async () => {
    if (loading || cancelled) return;
    
    // Show confirmation dialog
    Alert.alert(
      'Cancel Friend Request',
      `Are you sure you want to cancel your friend request to ${username}?`,
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              console.log('🚫 Cancelling friend request to:', username);
              
              // ✅ Use your existing /api/friends/cancel/:userId endpoint
              const response = await api.delete(`/friends/cancel/${userId}`);
              
              if (response.data.success) {
                setCancelled(true);
                onActionComplete('cancelled', userId, response.data.data);
              }
            } catch (error) {
              console.error('Error cancelling friend request:', error);
              
              const errorMessage = error.response?.data?.message || 'Failed to cancel friend request. Please try again.';
              
              Alert.alert(
                'Error',
                errorMessage,
                [{ text: 'OK', style: 'default' }]
              );
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (cancelled) {
    return (
      <View style={styles.friendRequestResult}>
        <View style={[styles.resultBadge, styles.cancelledBadge]}>
          <Ionicons name="close" size={16} color="#FFFFFF" />
          <Text style={styles.resultText}>Cancelled</Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.actionButton, styles.cancelButton]}
      onPress={handleCancel}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FF3B30" />
      ) : (
        <>
          <Ionicons name="close" size={18} color="#FF3B30" />
          <Text style={styles.cancelButtonText}>Cancel Request</Text>
        </>
      )}
    </TouchableOpacity>
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
      const categoryParam = activeCategory !== 'all' ? `&category=${activeCategory}` : '';
      
      const response = await api.get(`/api/notifications?page=${targetPage}&limit=20${categoryParam}`);
      
      if (reset) {
        setNotifications(response.data.notifications || []);
      } else {
        setNotifications(prev => [...prev, ...(response.data.notifications || [])]);
      }
      
      setHasMore(response.data.pagination?.hasMore || false);
      setPage(targetPage + 1);
      
      if (response.data.unreadCounts) {
        setUnreadCounts(response.data.unreadCounts);
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
      setUnreadCounts(response.data);
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    }
  };

  // Pull to refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications(true);
  }, [activeCategory]);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchNotifications(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════
     FRIEND REQUEST ACTIONS
  ═══════════════════════════════════════════════════════════════════ */

  const handleAcceptFriendRequest = async (notification) => {
    const requesterId = notification.sender?._id || notification.data?.userId;
    
    if (!requesterId) {
      Alert.alert('Error', 'Unable to process friend request');
      return;
    }

    setProcessingRequests(prev => new Set([...prev, notification._id]));

    try {
      await api.post(`/api/friends/accept/${requesterId}`);
      
      // Remove notification from list
      setNotifications(prev => prev.filter(n => n._id !== notification._id));
      
      // Update unread counts
      if (!notification.isRead) {
        setUnreadCounts(prev => ({
          total: Math.max(0, prev.total - 1),
          social: Math.max(0, prev.social - 1),
          events: prev.events
        }));
      }
      
      Alert.alert('Success', `You are now friends with ${notification.sender?.username}!`);
      
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to accept friend request');
    } finally {
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(notification._id);
        return newSet;
      });
    }
  };

  const handleRejectFriendRequest = async (notification) => {
    const requesterId = notification.sender?._id || notification.data?.userId;
    
    if (!requesterId) {
      Alert.alert('Error', 'Unable to process friend request');
      return;
    }

    setProcessingRequests(prev => new Set([...prev, notification._id]));

    try {
      await api.delete(`/api/friends/reject/${requesterId}`);
      
      // Remove notification from list
      setNotifications(prev => prev.filter(n => n._id !== notification._id));
      
      // Update unread counts
      if (!notification.isRead) {
        setUnreadCounts(prev => ({
          total: Math.max(0, prev.total - 1),
          social: Math.max(0, prev.social - 1),
          events: prev.events
        }));
      }
      
      Alert.alert('Declined', `Friend request from ${notification.sender?.username} declined`);
      
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to reject friend request');
    } finally {
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(notification._id);
        return newSet;
      });
    }
  };

  /* ═══════════════════════════════════════════════════════════════════
     NOTIFICATION MANAGEMENT
  ═══════════════════════════════════════════════════════════════════ */

  const markAllAsRead = async () => {
    try {
      const categoryParam = activeCategory !== 'all' ? `?category=${activeCategory}` : '';
      await api.put(`/api/notifications/mark-all-read${categoryParam}`);
      
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, isRead: true }))
      );
      
      if (activeCategory === 'all') {
        setUnreadCounts({ total: 0, social: 0, events: 0 });
      } else {
        setUnreadCounts(prev => ({
          ...prev,
          [activeCategory]: 0,
          total: prev.total - prev[activeCategory]
        }));
      }
      
    } catch (error) {
      console.error('Error marking all as read:', error);
      Alert.alert('Error', 'Failed to mark notifications as read');
    }
  };

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
          total: Math.max(0, prev.total - 1),
          social: notification.category === 'social' ? Math.max(0, prev.social - 1) : prev.social,
          events: notification.category === 'events' ? Math.max(0, prev.events - 1) : prev.events
        }));
      }
      
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════
     NAVIGATION ACTIONS
  ═══════════════════════════════════════════════════════════════════ */

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

  const formatRelativeTime = (dateString) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now - past) / 1000);
    
    if (diffInSeconds < 60) return 'now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return `${Math.floor(diffInSeconds / 604800)}w`;
  };

  /* ═══════════════════════════════════════════════════════════════════
     RENDER FUNCTIONS
  ═══════════════════════════════════════════════════════════════════ */

  const renderCategoryTabs = () => (
    <View style={styles.categoryContainer}>
      {CATEGORIES.map(category => {
        const count = category.key === 'all' ? unreadCounts.total : unreadCounts[category.key];
        const isActive = activeCategory === category.key;
        
        return (
          <TouchableOpacity
            key={category.key}
            style={[styles.categoryTab, isActive && styles.activeCategoryTab]}
            onPress={() => setActiveCategory(category.key)}
            activeOpacity={0.8}
          >
            <View style={styles.categoryTabContent}>
              <Ionicons 
                name={category.icon} 
                size={20} 
                color={isActive ? '#3797EF' : '#8E8E93'} 
              />
              <Text style={[
                styles.categoryTabText,
                isActive && styles.activeCategoryTabText
              ]}>
                {category.label}
              </Text>
              {count > 0 && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{count > 9 ? '9+' : count}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderFriendRequestActions = (notification) => {
    const isProcessing = processingRequests.has(notification._id);
    
    return (
      <View style={styles.friendRequestActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton, isProcessing && styles.disabledButton]}
          onPress={() => handleRejectFriendRequest(notification)}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FF3B30" />
          ) : (
            <>
              <Ionicons name="close" size={16} color="#FF3B30" />
              <Text style={styles.rejectButtonText}>Decline</Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton, isProcessing && styles.disabledButton]}
          onPress={() => handleAcceptFriendRequest(notification)}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              <Text style={styles.acceptButtonText}>Accept</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderNotificationItem = ({ item }) => {
  const iconName = getNotificationIcon(item);
  const iconColor = getNotificationColor(item);
  const isFriendRequest = item.type === 'friend_request';
  const hasActionTaken = item.data?.actionTaken;

  const handleActionComplete = (action, notificationId, actionData) => {
    console.log('🔔 Friend request action completed:', { action, notificationId, actionData });
    
    // Update the notification in the list with the action taken
    setNotifications(prev => 
      prev.map(notif => 
        notif._id === notificationId 
          ? { 
              ...notif, 
              isRead: true,
              data: { 
                ...notif.data, 
                actionTaken: action,
                actionData: actionData
              }
            }
          : notif
      )
    );
    
    // Update unread counts
    fetchUnreadCounts();
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
    <TouchableOpacity
      style={[
        styles.notificationItem, 
        !item.isRead && styles.unreadNotification,
        isFriendRequest && styles.friendRequestNotification
      ]}
      onPress={handleRegularNotificationPress}
      activeOpacity={isFriendRequest && !hasActionTaken ? 1 : 0.8}
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

        {/* Regular notification actions (delete, etc.) for non-friend requests */}
        {!isFriendRequest && (
          <View style={styles.notificationActions}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteNotification(item._id)}
              activeOpacity={0.7}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color="#C7C7CC" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};
const handleDeleteNotification = async (notificationId) => {
  Alert.alert(
    'Delete Notification',
    'Are you sure you want to delete this notification?',
    [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/notifications/${notificationId}`);
            
            // Remove from local state
            setNotifications(prev => 
              prev.filter(notif => notif._id !== notificationId)
            );
            
            // Update unread counts
            fetchUnreadCounts();
            
          } catch (error) {
            console.error('Error deleting notification:', error);
            Alert.alert('Error', 'Failed to delete notification');
          }
        }
      }
    ]
  );
};

// ============================================================================
// 3. HELPER FUNCTIONS
// ============================================================================

// Add this helper function for time formatting:
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



  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptySubtitle}>
        {activeCategory === 'all' 
          ? "You're all caught up! We'll notify you when something new happens."
          : `No ${activeCategory} notifications yet.`
        }
      </Text>
    </View>
  );

  if (loading && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        {renderCategoryTabs()}
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
      
      {renderCategoryTabs()}
      
      <FlatList
        data={notifications}
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 22, // More rounded for modern look
    minWidth: 100,
    gap: 6,
    elevation: 1, // Android shadow
    shadowColor: '#000000', // iOS shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  
  acceptButton: {
    backgroundColor: '#34C759',
    flex: 1,
  },
  
  rejectButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
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
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  
  defaultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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

  // Enhanced notification row layout
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 60, // Ensure consistent height
  },
  
  notificationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
    marginTop: 4, // Slight adjustment for visual alignment
  },
  
  // Enhanced notification item container
  notificationItem: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16, // Increased padding for friend request actions
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  
  unreadNotification: {
    backgroundColor: '#F8F9FA',
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
  
  // Action button hover states (for accessibility)
  actionButtonDisabled: {
    opacity: 0.6,
  },
  
  // Delete button for regular notifications
  deleteButton: {
    padding: 8,
    borderRadius: 16,
  },
  
  notificationActions: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 4,
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
  markAllReadText: {
    color: '#3797EF',
    fontSize: 16,
    fontWeight: '600',
  },
  categoryContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  categoryTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginHorizontal: 4,
  },
  activeCategoryTab: {
    backgroundColor: '#F0F8FF',
  },
  categoryTabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTabText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  activeCategoryTabText: {
    color: '#3797EF',
  },
  categoryBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    minWidth: 20,
    alignItems: 'center',
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  listContainer: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
  },
  notificationItem: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  unreadNotification: {
    backgroundColor: '#F8F9FA',
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIconContainer: {
    marginRight: 12,
  },
  profilePicture: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: '#C7C7CC',
  },
  friendRequestActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  acceptButton: {
    backgroundColor: '#3797EF',
  },
  rejectButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  disabledButton: {
    opacity: 0.6,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  rejectButtonText: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3797EF',
    marginLeft: 8,
    marginTop: 4,
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
});