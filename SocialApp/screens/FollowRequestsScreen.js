// SocialApp/screens/FollowRequestsScreen.js - Full screen showing all follow requests
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, SafeAreaView, StatusBar, TextInput, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { AuthContext } from '../services/AuthContext';
import { API_BASE_URL } from '@env';

export default function FollowRequestsScreen({ navigation }) {
  const { currentUser } = useContext(AuthContext);
  const [followRequests, setFollowRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [followingStatus, setFollowingStatus] = useState({});

  useEffect(() => {
    fetchFollowRequests();
  }, []);

  const fetchFollowRequests = async () => {
    try {
      setLoading(true);
      // Fetch notifications of type new_follower
      const response = await api.get('/api/notifications?category=social');
      const notifications = response.data.notifications || [];
      const followNotifs = notifications.filter(n => n.type === 'new_follower');
      
      setFollowRequests(followNotifs);
      
      // Check follow status for each user
      const statusMap = {};
      for (const notif of followNotifs) {
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
    } catch (error) {
      console.error('Error fetching follow requests:', error);
      Alert.alert('Error', 'Failed to load follow requests');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId) => {
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
      }
    } catch (error) {
      console.error('Error following/unfollowing:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await api.delete(`/api/notifications/${notificationId}`);
      setFollowRequests(prev => prev.filter(n => n._id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
      Alert.alert('Error', 'Failed to remove notification');
    }
  };

  const handleProfilePress = (userId) => {
    navigation.navigate('ProfileScreen', { userId });
  };

  const filteredRequests = searchQuery
    ? followRequests.filter(n => {
        const sender = n.sender;
        const searchLower = searchQuery.toLowerCase();
        return (
          sender?.username?.toLowerCase().includes(searchLower) ||
          sender?.displayName?.toLowerCase().includes(searchLower) ||
          n.message?.toLowerCase().includes(searchLower)
        );
      })
    : followRequests;

  const renderFollowRequestItem = ({ item }) => {
    const sender = item.sender;
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
          onPress={() => handleProfilePress(sender?._id)}
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
            onPress={() => handleProfilePress(sender?._id)}
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
              onPress={() => handleFollow(sender?._id)}
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
                onPress={() => {
                  handleFollow(sender?._id);
                  handleDeleteNotification(item._id);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteNotification(item._id)}
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={26} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Follow Requests</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search requests"
          placeholderTextColor="#8E8E93"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* List */}
      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item._id}
        renderItem={renderFollowRequestItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>No Follow Requests</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'No requests match your search' : 'You don\'t have any follow requests'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#000000',
    paddingVertical: 0,
  },
  listContainer: {
    paddingBottom: 20,
  },
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
    alignItems: 'center',
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
});

