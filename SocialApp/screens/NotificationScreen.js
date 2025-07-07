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
      
      console.log(`🔔 Fetching notifications: page=${targetPage}, category=${activeCategory}`);

      const response = await api.get(`/api/notifications?page=${targetPage}&limit=20${categoryParam}`);
      
      console.log(`🔔 Received ${response.data.notifications?.length || 0} notifications`);

      const newNotifications = response.data.notifications || [];
      
      if (reset) {
        setNotifications(newNotifications);
        setPage(2);
      } else {
        setNotifications(prev => [...prev, ...newNotifications]);
        setPage(prev => prev + 1);
      }

      setHasMore(response.data.pagination?.hasMore || false);
      
      // Update unread counts if provided
      if (response.data.unreadCounts) {
        setUnreadCounts(response.data.unreadCounts);
      }

    } catch (error) {
      console.error('Error fetching notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const fetchUnreadCounts = async () => {
    try {
      const response = await api.get('/api/notifications/unread-count');
      setUnreadCounts(response.data);
      console.log('🔔 Unread counts:', response.data);
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    }
  };

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loadingMore && !loading) {
      fetchNotifications(false);
    }
  }, [hasMore, loadingMore, loading, page]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications(true);
    fetchUnreadCounts();
  }, [activeCategory]);

  /* ═══════════════════════════════════════════════════════════════════
     NOTIFICATION ACTIONS
  ═══════════════════════════════════════════════════════════════════ */

  const markAllAsRead = async () => {
    try {
      const categoryToMark = activeCategory === 'all' ? null : activeCategory;
      await api.post('/api/notifications/mark-all-read', { 
        category: categoryToMark 
      });
      
      // Update local state
      setNotifications(prev => prev.map(notif => ({ ...notif, isRead: true })));
      
      // Update unread counts
      if (categoryToMark === 'social') {
        setUnreadCounts(prev => ({ ...prev, social: 0, total: prev.total - prev.social }));
      } else if (categoryToMark === 'events') {
        setUnreadCounts(prev => ({ ...prev, events: 0, total: prev.total - prev.events }));
      } else {
        setUnreadCounts({ total: 0, social: 0, events: 0 });
      }
      
      console.log(`🔔 Marked all ${categoryToMark || 'all'} notifications as read`);
    } catch (error) {
      console.error('Error marking all as read:', error);
      Alert.alert('Error', 'Failed to mark notifications as read');
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await api.put(`/api/notifications/${notificationId}/read`);
      
      // Update local state
      setNotifications(prev => prev.map(notif => 
        notif._id === notificationId ? { ...notif, isRead: true } : notif
      ));
      
      // Update unread counts
      const notification = notifications.find(n => n._id === notificationId);
      if (notification && !notification.isRead) {
        setUnreadCounts(prev => ({
          ...prev,
          total: Math.max(0, prev.total - 1),
          [notification.category]: Math.max(0, prev[notification.category] - 1)
        }));
      }
      
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await api.delete(`/api/notifications/${notificationId}`);
      
      // Update local state
      const notification = notifications.find(n => n._id === notificationId);
      setNotifications(prev => prev.filter(notif => notif._id !== notificationId));
      
      // Update unread counts if notification was unread
      if (notification && !notification.isRead) {
        setUnreadCounts(prev => ({
          ...prev,
          total: Math.max(0, prev.total - 1),
          [notification.category]: Math.max(0, prev[notification.category] - 1)
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
                color={isActive ? '#FFFFFF' : '#8E8E93'} 
              />
              <Text style={[
                styles.categoryTabText,
                isActive && styles.activeCategoryTabText
              ]}>
                {category.label}
              </Text>
              {count > 0 && (
                <View style={[
                  styles.unreadBadge,
                  isActive && styles.unreadBadgeActive
                ]}>
                  <Text style={[
                    styles.unreadBadgeText,
                    isActive && styles.unreadBadgeTextActive
                  ]}>
                    {count > 99 ? '99+' : count}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderNotificationItem = ({ item }) => {
    const isMemoryNotification = item.type === 'memory_photo_added' || item.type === 'memory_invitation';
    const isEventNotification = item.category === 'events';
    const isSocialNotification = item.category === 'social';

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.isRead && styles.unreadNotificationItem,
          isMemoryNotification && styles.memoryNotificationItem,
          isEventNotification && styles.eventNotificationItem
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.notificationContent}>
          {/* Sender Avatar */}
          <View style={styles.avatarContainer}>
            {item.sender?.profilePicture ? (
              <Image
                source={{ uri: `${API_BASE_URL}${item.sender.profilePicture}` }}
                style={styles.senderAvatar}
              />
            ) : (
              <View style={[
                styles.defaultAvatar,
                isMemoryNotification && styles.memoryDefaultAvatar,
                isEventNotification && styles.eventDefaultAvatar
              ]}>
                <Ionicons 
                  name={isMemoryNotification ? 'library' : 
                       isEventNotification ? 'calendar' : 'person'} 
                  size={20} 
                  color={isMemoryNotification ? '#8E44AD' : 
                         isEventNotification ? '#3797EF' : '#8E8E93'} 
                />
              </View>
            )}
            
            {/* Category Icon Badge */}
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
          keyExtractor={item => item._id}
          renderItem={renderNotificationItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#3797EF"
              colors={["#3797EF"]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderLoadingFooter}
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
    marginHorizontal: 8,
  },
  markAllReadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
  
  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingFooterText: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
  },

  // Category Tabs
  categoryContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
  },
  categoryTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeCategoryTab: {
    backgroundColor: '#3797EF',
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  categoryTabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginLeft: 6,
  },
  activeCategoryTabText: {
    color: '#FFFFFF',
  },
  unreadBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  unreadBadgeActive: {
    backgroundColor: '#FFFFFF',
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  unreadBadgeTextActive: {
    color: '#FF3B30',
  },

  // Notifications List
  listContainer: {
    flexGrow: 1,
  },
  notificationItem: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  unreadNotificationItem: {
    backgroundColor: '#F8F9FA',
  },
  memoryNotificationItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#8E44AD',
  },
  eventNotificationItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#3797EF',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  // Avatar & Badge
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  senderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
  },
  defaultAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryDefaultAvatar: {
    backgroundColor: 'rgba(142, 68, 173, 0.1)',
  },
  eventDefaultAvatar: {
    backgroundColor: 'rgba(55, 151, 239, 0.1)',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  memoryCategoryBadge: {
    backgroundColor: '#8E44AD',
  },
  eventCategoryBadge: {
    backgroundColor: '#3797EF',
  },
  socialCategoryBadge: {
    backgroundColor: '#34C759',
  },

  // Notification Content
  notificationTextContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#444444',
    lineHeight: 18,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: '#8E8E93',
  },

  // Actions
  notificationActions: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginLeft: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3797EF',
    marginBottom: 8,
  },
  deleteButton: {
    padding: 4,
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
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