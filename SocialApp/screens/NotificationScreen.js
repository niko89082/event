// screens/NotificationScreen.js
import React, { useEffect, useState, useContext } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Button, Image
} from 'react-native';
import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { useIsFocused } from '@react-navigation/native';
import { API_BASE_URL } from '@env';

// Our re-usable FollowRequestItem
import FollowRequestItem from '../components/FollowRequestItem';

export default function NotificationScreen({ navigation }) {
  const { currentUser } = useContext(AuthContext);

  // State for normal notifications
  const [notifications, setNotifications] = useState([]);
  // State for "who wants to follow me"
  const [myRequests, setMyRequests] = useState([]);

  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      fetchAllData();
    }
  }, [isFocused]);

  // Fetch both notifications + follow requests
  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 1) get normal notifications
      const notifRes = await api.get('/notifications');
      setNotifications(notifRes.data);

      // 2) get my follow requests
      const reqRes = await api.get('/follow/my-requests');
      setMyRequests(reqRes.data.followRequests || []);
    } catch (err) {
      console.error('Error fetching data:', err.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  /* ------------------ Follow Requests Logic ------------------ */
  const handleAcceptRequest = async (requesterId) => {
    try {
      await api.post(`/follow/accept/${requesterId}`);
      // remove from local state
      setMyRequests((prev) => prev.filter((u) => u._id !== requesterId));
    } catch (err) {
      console.error('Error accepting request:', err.response?.data || err);
    }
  };

  const handleDeclineRequest = async (requesterId) => {
    try {
      await api.delete(`/follow/decline/${requesterId}`);
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
      await api.put(`/notifications/${notifId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notifId ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (notifId) => {
    try {
      await api.delete(`/notifications/${notifId}`);
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
        {senderPicUrl && (
          <TouchableOpacity onPress={handlePressSender}>
            <Image source={{ uri: senderPicUrl }} style={styles.senderImage} />
          </TouchableOpacity>
        )}
        <Text style={styles.message}>{item.message}</Text>

        {senderId && (
          <TouchableOpacity onPress={handlePressSender}>
            <Text style={styles.profileLink}>
              View {sender.username || 'User'}'s profile
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.row}>
          {!item.isRead && (
            <Button title="Mark Read" onPress={() => handleMarkRead(item._id)} />
          )}
          <Button title="Delete" onPress={() => handleDelete(item._id)} />
        </View>
      </View>
    );
  };

  /* ------------------ Rendering ------------------ */
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // If no follow requests AND no notifications
  if (!myRequests.length && !notifications.length) {
    return (
      <View style={styles.centered}>
        <Text>No notifications or follow requests.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Section 1: Follow Requests */}
      <Text style={styles.sectionTitle}>Follow Requests</Text>
      {myRequests.length ? (
        <FlatList
          data={myRequests}
          keyExtractor={(user) => user._id}
          renderItem={renderRequestItem}
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        <Text style={styles.emptyText}>No pending requests.</Text>
      )}

      {/* Section 2: Other Notifications */}
      <Text style={styles.sectionTitle}>Notifications</Text>
      {notifications.length ? (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderNotificationItem}
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        <Text style={styles.emptyText}>No notifications found.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  listContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18, fontWeight: 'bold', marginTop: 8, marginLeft: 16,
  },
  emptyText: {
    marginLeft: 16, fontStyle: 'italic', color: '#666',
  },
  notificationItem: {
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  read: {
    opacity: 0.6,
  },
  senderImage: {
    width: 40, height: 40, borderRadius: 20,
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginVertical: 4,
  },
  profileLink: {
    color: 'blue',
    textDecorationLine: 'underline',
    marginVertical: 4,
  },
});