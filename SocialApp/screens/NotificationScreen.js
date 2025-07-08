// screens/NotificationScreen.js - PHASE 4: Enhanced with categories and memory support
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

  // 🔔 PHASE 4: Enhanced state management
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all'); // all, social, events
  const [unreadCounts, setUnreadCounts] = useState({ total: 0, social: 0, events: 0 });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // 🔔 PHASE 4: Category definitions
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
      const categoryParam = activeCategory === 'all' ? '' : `&category=${activeCategory}`;
      
      const response = await api.get(`/api/notifications?page=${targetPage}&limit=20${categoryParam}`);
      
      if (reset) {
        setNotifications(response.data.notifications);
        setUnreadCounts(response.data.unreadCounts);
      } else {
        setNotifications(prev => [...prev, ...response.data.notifications]);
      }
      
      setHasMore(response.data.pagination.hasMore);
      if (!reset) {
        setPage(prev => prev + 1);
      }
      
    } catch (error) {
      console.error('Error fetching notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications(true);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchNotifications(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════
     NOTIFICATION ACTIONS
  ═══════════════════════════════════════════════════════════════════ */

  const markAllAsRead = async () => {
    try {
      const categoryParam = activeCategory === 'all' ? {} : { category: activeCategory };
      await api.post('/api/notifications/mark-all-read', categoryParam);
      
      // Update local state
      setNotifications(prev => prev.map(notif => ({ ...notif, isRead: true })));
      setUnreadCounts(prev => ({
        ...prev,
        [activeCategory === 'all' ? 'total' : activeCategory]: 0,
        ...(activeCategory === 'all' && { social: 0, events: 0, total: 0 })
      }));
      
    } catch (error) {
      console.error('Error marking all as read:', error);
      Alert.alert('Error', 'Failed to mark notifications as read');
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await api.put(`/api/notifications/${notificationId}/read`);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif._id === notificationId ? { ...notif, isRead: true } : notif
        )
      );
      
      // Update unread counts
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
      Alert.alert('Error', 'Failed to mark notification as read');
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await api.delete(`/api/notifications/${notificationId}`);
      
      // Update local state
      const notification = notifications.find(n => n._id === notificationId);
      setNotifications(prev => prev.filter(notif => notif._id !== notificationId));
      
      // Update unread counts if it was unread
      if (notification && !notification.isRead) {
        setUnreadCounts(prev => ({
          total: Math.max(0, prev.total - 1),
          social: notification.category === 'social' ? Math.max(0, prev.social - 1) : prev.social,
          events: notification.category === 'events' ? Math.max(0, prev.events - 1) : prev.events
        }));
      }
      
    } catch (error) {
      console.error('Error deleting notification:', error);
      Alert.alert('Error', 'Failed to delete notification');
    }
  };

  /* ═══════════════════════════════════════════════════════════════════
     NAVIGATION ACTIONS
  ═══════════════════════════════════════════════════════════════════ */

  const handleNotificationPress = async (notification) => {
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
        
      case 'ACCEPT_REQUEST':
        // Handle friend request acceptance
        handleAcceptFriendRequest(notification);
        break;
        
      default:
        console.log('🔔 No specific action for notification type:', notification.type);
    }
  };

  const handleAcceptFriendRequest = async (notification) => {
    try {
      // This would need to be implemented in your friend request system
      // await api.post(`/api/friends/accept/${notification.sender._id}`);
      console.log('🔔 Accept friend request:', notification.sender?.username);
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════
     🆕 ENHANCED NOTIFICATION DISPLAY HELPERS
  ═══════════════════════════════════════════════════════════════════ */

  const getNotificationIcon = (notification) => {
    const iconMap = {
      // Social notifications
      'friend_request': 'person-add',
      'friend_request_accepted': 'checkmark-circle',
      'new_follower': 'people',
      'memory_invitation': 'images',
      'memory_photo_added': 'camera',
      'memory_photo_batch': 'photos',        // 🆕 Multiple photos icon
      
      // Event notifications  
      'event_invitation': 'calendar',
      'event_reminder': 'time',
      'event_reminder_1_hour': 'alarm',      // 🆕 Urgent reminder icon
      'event_rsvp_batch': 'people',
      
      // Engagement
      'post_liked': 'heart',
      'post_commented': 'chatbubble'
    };
    
    return iconMap[notification.type] || 'notifications';
  };

  const getNotificationColor = (notification) => {
    if (notification.priority === 'high') return '#FF3B30'; // Red for urgent
    if (notification.category === 'events') return '#3797EF'; // Blue for events
    return '#8E44AD'; // Purple for social
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
                  <Text style={styles.categoryBadgeText}>{count}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderNotificationItem = ({ item }) => {
    const iconName = getNotificationIcon(item);
    const iconColor = getNotificationColor(item);
    const isMemoryNotification = item.category === 'social' && item.type.includes('memory');
    const isEventNotification = item.category === 'events';
    const isSocialNotification = item.category === 'social' && !item.type.includes('memory');

    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.isRead && styles.unreadNotification]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.notificationRow}>
          {/* Main Icon */}
          <View style={[styles.notificationIconContainer, { backgroundColor: iconColor + '20' }]}>
            <Ionicons name={iconName} size={20} color={iconColor} />
            
            {/* Category Badge */}
            <View style={[
              styles.categoryBadge,
              isMemoryNotification && styles.memoryCategoryBadge,
              isEventNotification && styles.eventCategoryBadge,
              isSocialNotification && styles.socialCategoryBadge
            ]}>
              <Ionicons 
                name={isMemoryNotification ? 'library' : 
                     isEventNotification ? 'calendar' : 'people'} 
                size={10} 
                color="#FFFFFF" 
              />
            </View>
          </View>

          {/* Notification Content */}
          <View style={styles.notificationTextContainer}>
            <Text style={styles.notificationTitle}>{item.title}</Text>
            <Text style={styles.notificationMessage}>{item.message}</Text>
            <Text style={styles.notificationTime}>
              {formatNotificationTime(item.createdAt)}
            </Text>
          </View>

          {/* Unread Indicator & Actions */}
          <View style={styles.notificationActions}>
            {!item.isRead && <View style={styles.unreadDot} />}
            
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => deleteNotification(item._id)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="#8E8E93" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderLoadingFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#3797EF" />
        <Text style={styles.loadingFooterText}>Loading more...</Text>
      </View>
    );
  };

  const renderEmptyState = () => {
    const emptyConfig = {
      all: {
        icon: 'notifications-outline',
        title: 'No notifications yet',
        subtitle: 'Your notifications will appear here'
      },
      social: {
        icon: 'people-outline',
        title: 'No social notifications',
        subtitle: 'Friend requests and social activity will appear here'
      },
      events: {
        icon: 'calendar-outline',
        title: 'No event notifications',
        subtitle: 'Event invitations and reminders will appear here'
      }
    };

    const config = emptyConfig[activeCategory];

    return (
      <View style={styles.emptyState}>
        <Ionicons name={config.icon} size={80} color="#C7C7CC" />
        <Text style={styles.emptyTitle}>{config.title}</Text>
        <Text style={styles.emptySubtitle}>{config.subtitle}</Text>
      </View>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════
     HELPER FUNCTIONS
  ═══════════════════════════════════════════════════════════════════ */

  const formatNotificationTime = (createdAt) => {
    const now = new Date();
    const notificationTime = new Date(createdAt);
    const diffInMs = now - notificationTime;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return notificationTime.toLocaleDateString();
  };

  /* ═══════════════════════════════════════════════════════════════════
     MAIN RENDER
  ═══════════════════════════════════════════════════════════════════ */

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
      
      {/* Category Tabs */}
      {renderCategoryTabs()}

      {/* Notifications List */}
      {notifications.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderLoadingFooter}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    padding: 8,
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
    backgroundColor: '#3797EF20',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  memoryCategoryBadge: {
    backgroundColor: '#8E44AD',
  },
  eventCategoryBadge: {
    backgroundColor: '#3797EF',
  },
  socialCategoryBadge: {
    backgroundColor: '#8E8E93',
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
  notificationActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 40,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3797EF',
  },
  deleteButton: {
    padding: 4,
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