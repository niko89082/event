// screens/NotificationScreen.js - Enhanced with Privacy System Integration
import React, { useEffect, useState, useContext } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, SafeAreaView, StatusBar, Alert, RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { useIsFocused } from '@react-navigation/native';
import { API_BASE_URL } from '@env';

// Import reusable components
import FollowRequestItem from '../components/FollowRequestItem';

export default function NotificationScreen({ navigation }) {
  const { currentUser } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  // State management
  const [notifications, setNotifications] = useState([]);
  const [followRequests, setFollowRequests] = useState([]);
  const [eventInvites, setEventInvites] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // all, requests, invites

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
  }, [navigation]);

  useEffect(() => {
    if (isFocused) {
      fetchAllNotifications();
    }
  }, [isFocused]);


const fetchAllNotifications = async (isRefresh = false) => {
  try {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    console.log('🔄 Fetching all notifications...');

    // ✅ FIXED: Use Promise.allSettled to prevent cascade failures
    const results = await Promise.allSettled([
      api.get('/api/notifications'),
      api.get('/api/follow/my-requests'),
      api.get('/api/events/my-invites'),     // Fixed endpoint
      api.get('/api/events/my-join-requests') // Fixed endpoint
    ]);

    // Process each result individually with detailed logging
    const [notifResult, followResult, inviteResult, joinResult] = results;

    // ===== Handle Regular Notifications =====
    if (notifResult.status === 'fulfilled') {
      // ✅ FIXED: Handle the correct response format
      const notificationsData = notifResult.value.data;
      const notifications = Array.isArray(notificationsData) ? notificationsData : [];
      setNotifications(notifications);
      console.log(`✅ Loaded ${notifications.length} regular notifications`);
    } else {
      console.error('❌ Failed to load notifications:', notifResult.reason?.response?.data || notifResult.reason?.message);
      setNotifications([]);
    }

    // ===== Handle Follow Requests =====
    if (followResult.status === 'fulfilled') {
      const followRequests = followResult.value.data?.followRequests || [];
      setFollowRequests(followRequests);
      console.log(`✅ Loaded ${followRequests.length} follow requests`);
    } else {
      console.error('❌ Failed to load follow requests:', followResult.reason?.response?.data || followResult.reason?.message);
      setFollowRequests([]);
    }

    // ===== Handle Event Invites =====
    if (inviteResult.status === 'fulfilled') {
      const eventInvites = inviteResult.value.data || [];
      setEventInvites(eventInvites);
      console.log(`✅ Loaded ${eventInvites.length} event invitations`);
    } else {
      const error = inviteResult.reason;
      console.error('❌ Failed to load event invites:', error?.response?.data || error?.message);
      setEventInvites([]);
    }

    // ===== Handle Join Requests =====
    if (joinResult.status === 'fulfilled') {
      const joinRequests = joinResult.value.data || [];
      setJoinRequests(joinRequests);
      console.log(`✅ Loaded ${joinRequests.length} join requests`);
    } else {
      const error = joinResult.reason;
      console.error('❌ Failed to load join requests:', error?.response?.data || error?.message);
      setJoinRequests([]);
    }

    // ===== Summary Logging =====
    const notifCount = notifResult.status === 'fulfilled' ? 
      (Array.isArray(notifResult.value.data) ? notifResult.value.data.length : 0) : 0;
    const followCount = followResult.status === 'fulfilled' ? 
      (followResult.value.data?.followRequests || []).length : 0;
    const inviteCount = inviteResult.status === 'fulfilled' ? 
      (inviteResult.value.data || []).length : 0;
    const joinCount = joinResult.status === 'fulfilled' ? 
      (joinResult.value.data || []).length : 0;

    const totalItems = notifCount + followCount + inviteCount + joinCount;
    console.log(`🎉 Notification fetch complete! Total items: ${totalItems}`);

  } catch (err) {
    console.error('❌ Unexpected error in fetchAllNotifications:', err);
    
    // Ensure all states are reset on unexpected error
    setNotifications([]);
    setFollowRequests([]);
    setEventInvites([]);
    setJoinRequests([]);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

  const markAllAsRead = async () => {
    try {
      await api.post('/api/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  /* ------------------ Follow Requests Logic ------------------ */
  const handleAcceptFollowRequest = async (requesterId) => {
    try {
      await api.post(`/api/follow/accept/${requesterId}`);
      setFollowRequests(prev => prev.filter(u => u._id !== requesterId));
      Alert.alert('Success', 'Follow request accepted');
    } catch (err) {
      console.error('Error accepting request:', err.response?.data || err);
      Alert.alert('Error', 'Failed to accept request');
    }
  };

  const handleDeclineFollowRequest = async (requesterId) => {
    try {
      await api.delete(`/api/follow/decline/${requesterId}`);
      setFollowRequests(prev => prev.filter(u => u._id !== requesterId));
    } catch (err) {
      console.error('Error declining request:', err.response?.data || err);
    }
  };

  /* ------------------ Event Invites Logic ------------------ */
  const handleAcceptEventInvite = async (eventId) => {
    try {
      await api.post(`/api/events/attend/${eventId}`, { paymentConfirmed: true });
      setEventInvites(prev => prev.filter(invite => invite.event._id !== eventId));
      Alert.alert('Success', 'You\'re now attending this event!');
    } catch (err) {
      console.error('Error accepting invite:', err);
      Alert.alert('Error', err.response?.data?.message || 'Failed to accept invite');
    }
  };

  const handleDeclineEventInvite = async (eventId) => {
    try {
      await api.delete(`/api/events/invite/${eventId}`);
      setEventInvites(prev => prev.filter(invite => invite.event._id !== eventId));
    } catch (err) {
      console.error('Error declining invite:', err);
    }
  };

  /* ------------------ Join Requests Logic ------------------ */
  const handleApproveJoinRequest = async (eventId, userId) => {
    try {
      await api.post(`/api/events/join-request/${eventId}/${userId}/approve`);
      setJoinRequests(prev => prev.filter(req => !(req.event._id === eventId && req.user._id === userId)));
      Alert.alert('Success', 'Join request approved');
    } catch (err) {
      console.error('Error approving request:', err);
      Alert.alert('Error', 'Failed to approve request');
    }
  };

  const handleRejectJoinRequest = async (eventId, userId) => {
    try {
      await api.delete(`/api/events/join-request/${eventId}/${userId}/reject`);
      setJoinRequests(prev => prev.filter(req => !(req.event._id === eventId && req.user._id === userId)));
    } catch (err) {
      console.error('Error rejecting request:', err);
    }
  };

  /* ------------------ Regular Notifications Logic ------------------ */
  const handleMarkRead = async (notifId) => {
    try {
      await api.put(`/api/notifications/${notifId}/read`);
      setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const handleDeleteNotification = async (notifId) => {
    try {
      await api.delete(`/api/notifications/${notifId}`);
      setNotifications(prev => prev.filter(n => n._id !== notifId));
    } catch (err) {
      console.error('Delete notification error:', err);
    }
  };

  /* ------------------ Render Functions ------------------ */
  const renderTabBar = () => (
    <View style={styles.tabContainer}>
      {[
        { key: 'all', label: 'All', icon: 'notifications-outline' },
        { key: 'requests', label: 'Requests', icon: 'people-outline' },
        { key: 'invites', label: 'Invites', icon: 'calendar-outline' }
      ].map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, activeTab === tab.key && styles.activeTab]}
          onPress={() => setActiveTab(tab.key)}
          activeOpacity={0.8}
        >
          <Ionicons 
            name={tab.icon} 
            size={20} 
            color={activeTab === tab.key ? '#3797EF' : '#8E8E93'} 
          />
          <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
            {tab.label}
          </Text>
          {/* Badge for unread count */}
          {getUnreadCount(tab.key) > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{getUnreadCount(tab.key)}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

const getUnreadCount = (tabKey) => {
  try {
    switch (tabKey) {
      case 'requests':
        return (followRequests?.length || 0) + (joinRequests?.length || 0);
      case 'invites':
        return eventInvites?.length || 0;
      case 'all':
        const unreadNotifications = (notifications || []).filter(n => !n.isRead).length;
        const followRequestsCount = followRequests?.length || 0;
        const eventInvitesCount = eventInvites?.length || 0;
        const joinRequestsCount = joinRequests?.length || 0;
        return unreadNotifications + followRequestsCount + eventInvitesCount + joinRequestsCount;
      default:
        return 0;
    }
  } catch (error) {
    console.error('Error calculating unread count:', error);
    return 0;
  }
};

  const renderFollowRequestItem = ({ item }) => (
    <FollowRequestItem
      sender={item}
      onPressProfile={() => navigation.navigate('ProfileScreen', { userId: item._id })}
      onAccept={() => handleAcceptFollowRequest(item._id)}
      onDecline={() => handleDeclineFollowRequest(item._id)}
    />
  );

  const renderEventInviteItem = ({ item }) => (
    <View style={styles.inviteCard}>
      <View style={styles.inviteHeader}>
        <Image
          source={{
            uri: item.event.coverImage
              ? `http://${API_BASE_URL}:3000${item.event.coverImage}`
              : 'https://placehold.co/60x60.png?text=📅'
          }}
          style={styles.eventImage}
        />
        <View style={styles.inviteInfo}>
          <Text style={styles.inviteTitle}>Event Invitation</Text>
          <Text style={styles.eventTitle} numberOfLines={1}>{item.event.title}</Text>
          <Text style={styles.eventDate}>
            {new Date(item.event.time).toLocaleDateString()}
          </Text>
          <Text style={styles.inviteFrom}>
            Invited by {item.invitedBy?.username}
          </Text>
        </View>
      </View>
      <View style={styles.inviteActions}>
        <TouchableOpacity
          style={styles.declineButton}
          onPress={() => handleDeclineEventInvite(item.event._id)}
          activeOpacity={0.8}
        >
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleAcceptEventInvite(item.event._id)}
          activeOpacity={0.8}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderJoinRequestItem = ({ item }) => (
    <View style={styles.joinRequestCard}>
      <View style={styles.joinRequestHeader}>
        <Image
          source={{
            uri: item.user.profilePicture
              ? `http://${API_BASE_URL}:3000${item.user.profilePicture}`
              : 'https://placehold.co/48x48.png?text=👤'
          }}
          style={styles.userAvatar}
        />
        <View style={styles.joinRequestInfo}>
          <Text style={styles.joinRequestTitle}>Join Request</Text>
          <Text style={styles.requesterName}>{item.user.username}</Text>
          <Text style={styles.eventName} numberOfLines={1}>
            wants to join "{item.event.title}"
          </Text>
          {item.message && (
            <Text style={styles.requestMessage} numberOfLines={2}>
              "{item.message}"
            </Text>
          )}
        </View>
      </View>
      <View style={styles.joinRequestActions}>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => handleRejectJoinRequest(item.event._id, item.user._id)}
          activeOpacity={0.8}
        >
          <Text style={styles.rejectButtonText}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.approveButton}
          onPress={() => handleApproveJoinRequest(item.event._id, item.user._id)}
          activeOpacity={0.8}
        >
          <Text style={styles.approveButtonText}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderNotificationItem = ({ item }) => {
    const sender = item.sender || null;
    const senderPicUrl = sender?.profilePicture
      ? `http://${API_BASE_URL}:3000${sender.profilePicture}`
      : 'https://placehold.co/48x48.png?text=👤';

    const handlePress = () => {
      if (!item.isRead) {
        handleMarkRead(item._id);
      }
      
      // Navigate based on notification type
      if (item.type === 'event_invite') {
        navigation.navigate('EventDetailsScreen', { eventId: item.meta?.eventId });
      } else if (item.type === 'follow' && sender) {
        navigation.navigate('ProfileScreen', { userId: sender._id });
      }
    };

    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.isRead && styles.unreadItem]}
        onPress={handlePress}
        activeOpacity={0.95}
      >
        <View style={styles.notificationContent}>
          {sender && (
            <Image source={{ uri: senderPicUrl }} style={styles.senderImage} />
          )}
          
          <View style={styles.notificationTextContainer}>
            <Text style={styles.notificationMessage}>{item.message}</Text>
            <Text style={styles.notificationTime}>
              {getTimeAgo(item.createdAt)}
            </Text>
          </View>
        </View>

        <View style={styles.notificationActions}>
          {!item.isRead && <View style={styles.unreadDot} />}
          <TouchableOpacity 
            onPress={() => handleDeleteNotification(item._id)}
            style={styles.deleteButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={16} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / 60000);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return time.toLocaleDateString();
  };

  const getDataForActiveTab = () => {
    switch (activeTab) {
      case 'requests':
        return [
          ...followRequests.map(req => ({ type: 'follow-request', data: req, id: `follow-${req._id}` })),
          ...joinRequests.map(req => ({ type: 'join-request', data: req, id: `join-${req.user._id}-${req.event._id}` }))
        ];
      case 'invites':
        return eventInvites.map(invite => ({ type: 'event-invite', data: invite, id: `invite-${invite.event._id}` }));
      case 'all':
      default:
        return [
          ...followRequests.map(req => ({ type: 'follow-request', data: req, id: `follow-${req._id}` })),
          ...eventInvites.map(invite => ({ type: 'event-invite', data: invite, id: `invite-${invite.event._id}` })),
          ...joinRequests.map(req => ({ type: 'join-request', data: req, id: `join-${req.user._id}-${req.event._id}` })),
          ...notifications.map(notif => ({ type: 'notification', data: notif, id: `notif-${notif._id}` }))
        ].sort((a, b) => {
          const aTime = new Date(a.data.createdAt || a.data.requestedAt || a.data.invitedAt);
          const bTime = new Date(b.data.createdAt || b.data.requestedAt || b.data.invitedAt);
          return bTime - aTime;
        });
    }
  };

  const renderItem = ({ item }) => {
    switch (item.type) {
      case 'follow-request':
        return renderFollowRequestItem({ item: item.data });
      case 'event-invite':
        return renderEventInviteItem({ item: item.data });
      case 'join-request':
        return renderJoinRequestItem({ item: item.data });
      case 'notification':
        return renderNotificationItem({ item: item.data });
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const data = getDataForActiveTab();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {renderTabBar()}
      
      {data.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons 
            name={activeTab === 'requests' ? 'people-outline' : 
                  activeTab === 'invites' ? 'calendar-outline' : 'notifications-outline'} 
            size={80} 
            color="#C7C7CC" 
          />
          <Text style={styles.emptyTitle}>
            {activeTab === 'requests' && 'No requests'}
            {activeTab === 'invites' && 'No invitations'}
            {activeTab === 'all' && 'No notifications'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === 'requests' && 'Follow and join requests will appear here'}
            {activeTab === 'invites' && 'Event invitations will appear here'}
            {activeTab === 'all' && 'Your notifications will appear here'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchAllNotifications(true)}
              tintColor="#3797EF"
              colors={["#3797EF"]}
            />
          }
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },

  // Tab Bar
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    position: 'relative',
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#3797EF',
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // List
  listContainer: {
    paddingBottom: 20,
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Event Invite Card
  inviteCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#3797EF',
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  eventImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#F6F6F6',
  },
  inviteInfo: {
    flex: 1,
  },
  inviteTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3797EF',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
  },
  eventDate: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  inviteFrom: {
    fontSize: 12,
    color: '#8E8E93',
  },
  inviteActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#3797EF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Join Request Card
  joinRequestCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  joinRequestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#F6F6F6',
  },
  joinRequestInfo: {
    flex: 1,
  },
  joinRequestTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9500',
    marginBottom: 4,
  },
  requesterName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
  },
  eventName: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  requestMessage: {
    fontSize: 12,
    color: '#666666',
    fontStyle: 'italic',
  },
  joinRequestActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  approveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Regular Notifications
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  unreadItem: {
    backgroundColor: '#F8F9FA',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  senderImage: {
    width: 40,
    height: 40,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#F6F6F6',
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 2,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  notificationActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3797EF',
    marginRight: 12,
  },
  deleteButton: {
    padding: 8,
  },
});