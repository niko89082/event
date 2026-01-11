// SocialApp/screens/NotificationScreen.js - Redesigned with Follow Requests section and improved UI
import React, { useEffect, useState, useContext, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, SafeAreaView, StatusBar, Alert, RefreshControl,
  TextInput, SectionList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { API_BASE_URL } from '@env';
import SwipeableNotificationItem from '../components/SwipeableNotificationItem';

export default function NotificationScreen({ navigation }) {
  const { currentUser } = useContext(AuthContext);
  const isFocused = useIsFocused();
  const hasMarkedAsRead = useRef(false);

  // Enhanced state management
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({ total: 0 });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [organizedData, setOrganizedData] = useState([]);
  const [followingStatus, setFollowingStatus] = useState({});
  const MAX_DISPLAYED_REQUESTS = 2; // Show max 2 requests, then "See all"

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
          onPress={() => navigation.navigate('NotificationExamples')}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={24} color="#000000" />
        </TouchableOpacity>
      ),
    });
  }, []);

  const markAllNotificationsAsRead = async () => {
    try {
      await api.post('/api/notifications/mark-all-read');
      setNotifications(prev => prev.map(notif => ({ ...notif, isRead: true })));
      setUnreadCounts({ total: 0 });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  // Mark notifications as read when screen is actually viewed (not just focused)
  useFocusEffect(
    useCallback(() => {
      if (!hasMarkedAsRead.current) {
        markAllNotificationsAsRead();
        hasMarkedAsRead.current = true;
      }
      
      return () => {
        // Reset when leaving screen
        hasMarkedAsRead.current = false;
      };
    }, [])
  );

  useEffect(() => {
    if (isFocused) {
      fetchNotifications(true);
      fetchUnreadCounts();
    }
  }, [isFocused]);

  // Fetch follow status for follow request notifications
  useEffect(() => {
    const fetchFollowStatuses = async () => {
      const followRequests = notifications.filter(n => n.type === 'new_follower');
      if (followRequests.length === 0) return;

      const statusMap = {};
      for (const notif of followRequests) {
        if (notif.sender?._id) {
          try {
            const profileResponse = await api.get(`/api/profile/${notif.sender._id}`);
            statusMap[notif.sender._id] = {
              isFollowing: profileResponse.data.isFollowing || false,
              isPublic: profileResponse.data.isPublic !== false, // default to true
            };
          } catch (error) {
            // Default to public and not following
            statusMap[notif.sender._id] = {
              isFollowing: false,
              isPublic: true,
            };
          }
        }
      }
      setFollowingStatus(statusMap);
    };

    if (notifications.length > 0) {
      fetchFollowStatuses();
    }
  }, [notifications]);

  // Reorganize notifications when they change
  useEffect(() => {
    const organized = organizeNotifications(notifications);
    setOrganizedData(organized);
  }, [notifications]);

  /* ═══════════════════════════════════════════════════════════════════
     NOTIFICATION ORGANIZATION
  ═══════════════════════════════════════════════════════════════════ */

  const organizeNotifications = (notifs) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Separate follow requests (new_follower notifications)
    const followRequests = notifs.filter(n => n.type === 'new_follower');
    const otherNotifications = notifs.filter(n => n.type !== 'new_follower');

    // Limit displayed requests to MAX_DISPLAYED_REQUESTS
    const displayedRequests = followRequests.slice(0, MAX_DISPLAYED_REQUESTS);

    // Group other notifications by date
    const todayNotifs = [];
    const yesterdayNotifs = [];
    const olderNotifs = [];

    otherNotifications.forEach(notif => {
      const notifDate = new Date(notif.createdAt);
      if (notifDate >= today) {
        todayNotifs.push(notif);
      } else if (notifDate >= yesterday && notifDate < today) {
        yesterdayNotifs.push(notif);
      } else {
        olderNotifs.push(notif);
      }
    });

    const sections = [];

    // Follow Requests section
    if (displayedRequests.length > 0) {
      sections.push({
        type: 'follow_requests',
        title: 'Follow Requests',
        count: followRequests.length,
        displayedCount: displayedRequests.length,
        data: displayedRequests,
      });
    }

    // Today section
    if (todayNotifs.length > 0) {
      sections.push({
        type: 'date_section',
        title: 'Today',
        data: todayNotifs,
      });
    }

    // Yesterday section
    if (yesterdayNotifs.length > 0) {
      sections.push({
        type: 'date_section',
        title: 'Yesterday',
        data: yesterdayNotifs,
      });
    }

    // Older section (if needed)
    if (olderNotifs.length > 0) {
      sections.push({
        type: 'date_section',
        title: 'Earlier',
        data: olderNotifs,
      });
    }

    return sections;
  };

  /* ═══════════════════════════════════════════════════════════════════
     DATA FETCHING
  ═══════════════════════════════════════════════════════════════════ */

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

  const handleDeleteNotification = async (notificationId) => {
    try {
      const deletedNotification = notifications.find(n => n._id === notificationId);
      setNotifications(prev => prev.filter(n => n._id !== notificationId));
      
      if (deletedNotification && !deletedNotification.isRead) {
        setUnreadCounts(prev => ({
          total: Math.max(0, prev.total - 1)
        }));
      }

      await api.delete(`/api/notifications/${notificationId}`);
    } catch (error) {
      console.error('Error deleting notification:', error);
      fetchNotifications(true);
      fetchUnreadCounts();
      Alert.alert('Error', 'Failed to remove notification. Please try again.');
    }
  };

  const handleNotificationPress = async (notification) => {
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }

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

  const handleFollowRequestAction = async (notification, action) => {
    if (action === 'confirm') {
      // Mark as read and navigate to profile
      await markAsRead(notification._id);
      navigation.navigate('ProfileScreen', { 
        userId: notification.sender?._id || notification.data?.userId 
      });
    } else if (action === 'delete') {
      // Delete the notification
      await handleDeleteNotification(notification._id);
    }
  };

  const handleFollow = async (userId, notificationId) => {
    try {
      const status = followingStatus[userId];
      if (status?.isFollowing) {
        await api.delete(`/api/follow/unfollow/${userId}`);
        setFollowingStatus(prev => ({
          ...prev,
          [userId]: { ...prev[userId], isFollowing: false }
        }));
      } else {
        await api.post(`/api/follow/follow/${userId}`);
        setFollowingStatus(prev => ({
          ...prev,
          [userId]: { ...prev[userId], isFollowing: true }
        }));
        // Mark notification as read when following
        if (notificationId) {
          await markAsRead(notificationId);
        }
      }
    } catch (error) {
      console.error('Error following/unfollowing:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications(true);
    fetchUnreadCounts();
  }, []);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchNotifications(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════
     DISPLAY HELPERS
  ═══════════════════════════════════════════════════════════════════ */

  const getNotificationIcon = (notification) => {
    const iconMap = {
      'new_follower': 'people',
      'memory_invitation': 'images',
      'memory_photo_added': 'camera',
      'memory_photo_batch': 'photos',
      'event_invitation': 'calendar',
      'event_invitation_batch': 'calendar',
      'event_reminder': 'time',
      'event_reminder_1_hour': 'alarm',
      'event_rsvp_batch': 'people',
      'post_liked': 'heart',
      'post_commented': 'chatbubble',
      'memory_photo_liked': 'heart',
    };
    return iconMap[notification.type] || 'notifications';
  };

  const getNotificationColor = (notification) => {
    if (notification.priority === 'high') return '#FF3B30';
    if (notification.category === 'events') return '#3797EF';
    if (notification.type === 'post_liked' || notification.type === 'memory_photo_liked') return '#FF3B30';
    if (notification.type === 'post_commented') return '#34C759';
    return '#3797EF';
  };

  const getTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    
    const diffInDays = Math.floor(diffInSeconds / 86400);
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDetailedTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      return getTimeAgo(dateString);
    } else if (date >= new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())) {
      return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  /* ═══════════════════════════════════════════════════════════════════
     RENDER FUNCTIONS
  ═══════════════════════════════════════════════════════════════════ */

  const renderFollowRequestItem = (notification) => {
    const sender = notification.sender;
    const profilePicUrl = sender?.profilePicture 
      ? (sender.profilePicture.startsWith('http') 
          ? sender.profilePicture 
          : `http://${API_BASE_URL}:3000${sender.profilePicture.startsWith('/') ? '' : '/'}${sender.profilePicture}`)
      : null;

    const status = followingStatus[sender?._id] || { isFollowing: false, isPublic: true };
    const isPublic = status.isPublic !== false; // Default to public
    const isFollowing = status.isFollowing;

    return (
      <View style={styles.followRequestItem}>
        <TouchableOpacity
          onPress={() => handleNotificationPress(notification)}
          activeOpacity={0.7}
        >
          {profilePicUrl ? (
            <Image source={{ uri: profilePicUrl }} style={styles.followRequestAvatar} />
          ) : (
            <View style={styles.followRequestAvatarPlaceholder}>
              <Text style={styles.followRequestAvatarText}>
                {sender?.username?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.followRequestInfo}>
          <TouchableOpacity
            onPress={() => handleNotificationPress(notification)}
            activeOpacity={0.7}
          >
            <Text style={styles.followRequestName} numberOfLines={1}>
              {sender?.displayName || sender?.username || 'Unknown User'}
            </Text>
            <Text style={styles.followRequestUsername}>
              @{sender?.username || 'unknown'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.followRequestActions}>
          {isPublic ? (
            // Public account: Show Follow/Following button
            <TouchableOpacity
              style={[
                styles.followButton,
                isFollowing && styles.followingButton
              ]}
              onPress={() => handleFollow(sender?._id, notification._id)}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.followButtonText,
                isFollowing && styles.followingButtonText
              ]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          ) : (
            // Private account: Show Confirm/Delete buttons
            <>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => handleFollowRequestAction(notification, 'confirm')}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleFollowRequestAction(notification, 'delete')}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderNotificationItem = ({ item }) => {
    const iconName = getNotificationIcon(item);
    const iconColor = getNotificationColor(item);
    const sender = item.sender;
    const profilePicUrl = sender?.profilePicture 
      ? (sender.profilePicture.startsWith('http') 
          ? sender.profilePicture 
          : `http://${API_BASE_URL}:3000${sender.profilePicture.startsWith('/') ? '' : '/'}${sender.profilePicture}`)
      : null;

    // Get icon overlay based on notification type
    let iconOverlay = null;
    if (item.type === 'post_liked' || item.type === 'memory_photo_liked') {
      iconOverlay = { name: 'heart', color: '#FF3B30' };
    } else if (item.type === 'post_commented') {
      iconOverlay = { name: 'chatbubble', color: '#34C759' };
    } else if (item.type === 'event_invitation' || item.type === 'event_invitation_batch') {
      iconOverlay = { name: 'calendar', color: '#3797EF' };
    }

    return (
      <SwipeableNotificationItem
        item={item}
        onDelete={handleDeleteNotification}
      >
        <TouchableOpacity
          style={[
            styles.notificationItem, 
            !item.isRead && styles.unreadNotification
          ]}
          onPress={() => handleNotificationPress(item)}
          activeOpacity={0.7}
        >
          <View style={styles.notificationRow}>
            <View style={styles.notificationIconContainer}>
              {profilePicUrl ? (
                <View style={styles.profilePictureWrapper}>
                  <Image source={{ uri: profilePicUrl }} style={styles.profilePicture} />
                  {iconOverlay && (
                    <View style={[styles.iconOverlay, { backgroundColor: iconOverlay.color }]}>
                      <Ionicons name={iconOverlay.name} size={12} color="#FFFFFF" />
                    </View>
                  )}
                </View>
              ) : (
                <View style={[styles.defaultIcon, { backgroundColor: iconColor + '20' }]}>
                  <Ionicons name={iconName} size={20} color={iconColor} />
                </View>
              )}
              {!item.isRead && (
                <View style={styles.unreadDot} />
              )}
            </View>

            <View style={styles.notificationContent}>
              <Text style={styles.notificationMessage} numberOfLines={3}>
                {item.message}
              </Text>
              <Text style={styles.notificationTime}>
                {getTimeAgo(item.createdAt)}
              </Text>
            </View>

            {/* Optional image for event notifications */}
            {item.data?.eventId && item.data?.eventCover && (
              <Image 
                source={{ uri: item.data.eventCover }}
                style={styles.notificationImage}
              />
            )}
          </View>
        </TouchableOpacity>
      </SwipeableNotificationItem>
    );
  };

  const renderSectionHeader = ({ section }) => {
    if (section.type === 'follow_requests') {
      return (
        <View style={styles.followRequestsSection}>
          <View style={styles.followRequestsHeader}>
            <Text style={styles.followRequestsTitle}>Follow Requests</Text>
            {section.count > 0 && (
              <View style={styles.followRequestsBadge}>
                <Text style={styles.followRequestsBadgeText}>
                  {section.count > 9 ? '9+' : section.count}
                </Text>
              </View>
            )}
          </View>
          {section.count > section.displayedCount && (
            <TouchableOpacity 
              style={styles.seeAllButton}
              onPress={() => {
                navigation.navigate('FollowRequests');
              }}
            >
              <Text style={styles.seeAllText}>
                See all {section.count} requests
              </Text>
              <Ionicons name="chevron-down" size={16} color="#3797EF" />
            </TouchableOpacity>
          )}
        </View>
      );
    } else {
      return (
        <View style={styles.dateSectionHeader}>
          <Text style={styles.dateSectionTitle}>{section.title}</Text>
        </View>
      );
    }
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

  if (loading && notifications.length === 0 && !refreshing) {
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
      
      <SectionList
        sections={organizedData}
        keyExtractor={(item, index) => item._id || index.toString()}
        renderItem={({ item, section }) => {
          if (section.type === 'follow_requests') {
            return renderFollowRequestItem(item);
          }
          return renderNotificationItem({ item });
        }}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={organizedData.length === 0 ? styles.emptyContainer : styles.listContainer}
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
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  
  // Follow Requests Section
  followRequestsSection: {
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
  },
  followRequestsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  followRequestsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  followRequestsBadge: {
    backgroundColor: '#3797EF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followRequestsBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  seeAllText: {
    color: '#3797EF',
    fontSize: 15,
    fontWeight: '600',
    marginRight: 4,
  },
  
  // Follow Request Item
  followRequestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#EFEFEF',
  },
  followRequestAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  followRequestAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E1E1E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  followRequestAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8E8E93',
  },
  followRequestInfo: {
    flex: 1,
    marginRight: 12,
  },
  followRequestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  followRequestUsername: {
    fontSize: 14,
    color: '#8E8E93',
  },
  followRequestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    minWidth: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '600',
  },
  followButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  followingButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    minWidth: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '600',
  },
  
  // Date Section Header
  dateSectionHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EFEFEF',
  },
  dateSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  
  // Notification Item
  notificationItem: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EFEFEF',
  },
  unreadNotification: {
    backgroundColor: '#F8F9FA',
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIconContainer: {
    width: 48,
    height: 48,
    marginRight: 12,
    position: 'relative',
  },
  profilePictureWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    position: 'relative',
  },
  profilePicture: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  iconOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
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
  notificationContent: {
    flex: 1,
    marginRight: 8,
  },
  notificationMessage: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 20,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 4,
  },
  notificationImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
});
