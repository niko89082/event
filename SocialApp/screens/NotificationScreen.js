// screens/NotificationScreen.js - Fixed with proper API routes and SafeArea
import React, { useEffect, useState, useContext } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Button, Image, SafeAreaView, StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { useIsFocused } from '@react-navigation/native';
import { API_BASE_URL } from '@env';

// Our re-usable FollowRequestItem
import FollowRequestItem from '../components/FollowRequestItem';

export default function NotificationScreen({ navigation }) {
  const { currentUser } = useContext(AuthContext);
  const insets = useSafeAreaInsets();

  // State for normal notifications
  const [notifications, setNotifications] = useState([]);
  // State for "who wants to follow me"
  const [myRequests, setMyRequests] = useState([]);

  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  // Set up header
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
  }, [navigation]);

  useEffect(() => {
    if (isFocused) {
      fetchAllData();
    }
  }, [isFocused]);

  // Fetch both notifications + follow requests with fixed API paths
  const fetchAllData = async () => {
    setLoading(true);
    try {
      console.log('🟡 NotificationScreen: Fetching notifications...');
      
      // 1) get normal notifications - FIXED API PATH
      const notifRes = await api.get('/api/notifications');
      console.log('🟢 NotificationScreen: Notifications response:', notifRes.status);
      setNotifications(notifRes.data);

      // 2) get my follow requests - FIXED API PATH
      const reqRes = await api.get('/api/follow/my-requests');
      console.log('🟢 NotificationScreen: Follow requests response:', reqRes.status);
      setMyRequests(reqRes.data.followRequests || []);
      
    } catch (err) {
      console.error('❌ NotificationScreen: Error fetching data:', err.response?.data || err.message);
      // Set empty arrays on error to prevent crashes
      setNotifications([]);
      setMyRequests([]);
    } finally {
      setLoading(false);
    }
  };

  /* ------------------ Follow Requests Logic ------------------ */
  const handleAcceptRequest = async (requesterId) => {
    try {
      await api.post(`/api/follow/accept/${requesterId}`);
      // remove from local state
      setMyRequests((prev) => prev.filter((u) => u._id !== requesterId));
    } catch (err) {
      console.error('Error accepting request:', err.response?.data || err);
    }
  };

  const handleDeclineRequest = async (requesterId) => {
    try {
      await api.delete(`/api/follow/decline/${requesterId}`);
      // remove from local state
      setMyRequests((prev) => prev.filter((u) => u._id !== requesterId));
    } catch (err) {
      console.error('Error declining request:', err.response?.data || err);
    }
  };

  const renderRequestItem = ({ item }) => {
    // item => a user object with { _id, username, profilePicture }
    const onPressProfile = () => {
      navigation.navigate('ProfileScreen', { userId: item._id });
    };
    return (
      <FollowRequestItem
        sender={item} // i.e. the user who requested
        onPressProfile={onPressProfile}
        onAccept={() => handleAcceptRequest(item._id)}
        onDecline={() => handleDeclineRequest(item._id)}
      />
    );
  };

  /* ------------------ Notifications Logic ------------------ */
  const handleMarkRead = async (notifId) => {
    try {
      await api.put(`/api/notifications/${notifId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notifId ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (notifId) => {
    try {
      await api.delete(`/api/notifications/${notifId}`);
      setNotifications((prev) => prev.filter((n) => n._id !== notifId));
    } catch (err) {
      console.error(err);
    }
  };

  const renderNotificationItem = ({ item }) => {
    const sender = item.sender || null;
    const senderId = sender?._id;

    // For non-follow-request notifications
    const senderPicUrl = sender?.profilePicture
      ? `http://${API_BASE_URL}:3000${sender.profilePicture}`
      : null;

    const handlePressSender = () => {
      if (senderId) {
        navigation.navigate('ProfileScreen', { userId: senderId });
      }
    };

    return (
      <View style={[styles.notificationItem, item.isRead && styles.read]}>
        <View style={styles.notificationContent}>
          {senderPicUrl && (
            <TouchableOpacity onPress={handlePressSender}>
              <Image source={{ uri: senderPicUrl }} style={styles.senderImage} />
            </TouchableOpacity>
          )}
          
          <View style={styles.notificationTextContainer}>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.timestamp}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.notificationActions}>
          {!item.isRead && (
            <TouchableOpacity 
              onPress={() => handleMarkRead(item._id)}
              style={styles.markReadButton}
            >
              <Ionicons name="checkmark" size={16} color="#3797EF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            onPress={() => handleDelete(item._id)}
            style={styles.deleteButton}
          >
            <Ionicons name="close" size={16} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  /* ------------------ Rendering ------------------ */
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // If no follow requests AND no notifications
  if (!myRequests.length && !notifications.length) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.emptyState}>
          <Ionicons name="notifications-outline" size={80} color="#C7C7CC" />
          <Text style={styles.emptyTitle}>No Notifications</Text>
          <Text style={styles.emptySubtitle}>
            When you get likes, follows and comments, they'll appear here.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <FlatList
        data={[
          // Follow requests section
          ...(myRequests.length > 0 ? [{
            type: 'section',
            title: 'Follow Requests',
            id: 'follow-requests-header'
          }] : []),
          ...myRequests.map(req => ({ type: 'request', data: req, id: req._id })),
          
          // Notifications section
          ...(notifications.length > 0 ? [{
            type: 'section',
            title: 'Recent Activity',
            id: 'notifications-header'
          }] : []),
          ...notifications.map(notif => ({ type: 'notification', data: notif, id: notif._id }))
        ]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          if (item.type === 'section') {
            return (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{item.title}</Text>
              </View>
            );
          } else if (item.type === 'request') {
            return renderRequestItem({ item: item.data });
          } else if (item.type === 'notification') {
            return renderNotificationItem({ item: item.data });
          }
          return null;
        }}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
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
    padding: 8,
    marginHorizontal: 8,
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
  listContainer: {
    paddingVertical: 8,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  read: {
    opacity: 0.6,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  senderImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  notificationTextContainer: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
  },
  notificationActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markReadButton: {
    padding: 8,
    marginRight: 4,
  },
  deleteButton: {
    padding: 8,
  },
});