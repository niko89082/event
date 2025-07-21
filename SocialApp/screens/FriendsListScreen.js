// screens/FriendsListScreen.js - NEW: Friends System Implementation
import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, 
  SafeAreaView, StatusBar, ActivityIndicator, Image, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function FriendsListScreen({ route, navigation }) {
  const { userId, mode } = route.params; // mode: 'friends', 'mutual', 'requests', 'sent'
  const { currentUser } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isSelf = userId === currentUser?._id;

  useEffect(() => {
    const getHeaderTitle = () => {
      switch (mode) {
        case 'friends':
          return isSelf ? 'My Friends' : 'Friends';
        case 'mutual':
          return 'Mutual Friends';
        case 'requests':
          return 'Friend Requests';
        case 'sent':
          return 'Sent Requests';
        default:
          return 'Friends';
      }
    };

    navigation.setOptions({
      headerStyle: {
        backgroundColor: '#FFFFFF',
        shadowOpacity: 0,
        elevation: 0,
        borderBottomWidth: 0.33,
        borderBottomColor: '#E1E1E1',
        height: 88,
      },
      headerTitleStyle: {
        fontWeight: '700',
        fontSize: 18,
        color: '#000000',
      },
      headerTitle: getHeaderTitle(),
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
  }, [navigation, mode, isSelf]);

  useEffect(() => {
    fetchFriendsList();
  }, []);

  const fetchFriendsList = async (isRefresh = false) => {
  try {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    let endpoint;
    switch (mode) {
      case 'friends':
        endpoint = isSelf ? `/api/friends/list` : `/api/friends/${userId}`;
        break;
      case 'mutual':
        endpoint = `/api/friends/mutual/${userId}`;
        break;
      case 'requests':
        endpoint = `/api/friends/requests?type=received`;
        break;
      case 'sent':
        endpoint = `/api/friends/requests?type=sent`;
        break;
      default:
        endpoint = isSelf ? `/api/friends/list` : `/api/friends/${userId}`;
    }

    const res = await api.get(endpoint);
    
    if (mode === 'friends') {
      setUsers(res.data.friends || []);
    } else if (mode === 'mutual') {
      setUsers(res.data.mutualFriends || []);
    } else if (mode === 'requests' || mode === 'sent') {
      const allRequests = res.data.requests || [];
      if (mode === 'requests') {
        setUsers(allRequests.filter(req => req.type === 'received'));
      } else {
        setUsers(allRequests.filter(req => req.type === 'sent'));
      }
    }

  } catch (err) {
    console.error('Error fetching friends list:', err.response?.data || err);
    
    // 🔧 FIXED: Better error handling for different scenarios
    if (err.response?.status === 403) {
      if (mode === 'friends') {
        Alert.alert(
          'Private Friends List', 
          'This user\'s friends list is private. You need to be friends with them to see their friends.',
          [
            { text: 'OK', onPress: () => navigation.goBack() }
          ]
        );
      } else {
        Alert.alert('Private', 'You don\'t have permission to view this information');
        navigation.goBack();
      }
    } else if (err.response?.status === 404) {
      Alert.alert('Not Found', 'The requested information was not found');
      navigation.goBack();
    } else {
      Alert.alert('Error', 'Failed to load the requested information. Please try again.');
    }
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

  const handlePressUser = (clickedUser) => {
    navigation.navigate('ProfileScreen', { userId: clickedUser._id });
  };

  const handleAcceptRequest = async (userId, username) => {
    try {
      await api.post(`/api/friends/accept/${userId}`);
      
      // Remove from the current list
      setUsers(prev => prev.filter(user => user._id !== userId));
      
      Alert.alert('Success', `You are now friends with ${username}!`);
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request');
    }
  };

  const handleRejectRequest = async (userId, username) => {
    try {
      await api.delete(`/api/friends/reject/${userId}`);
      
      // Remove from the current list
      setUsers(prev => prev.filter(user => user._id !== userId));
      
      Alert.alert('Success', `Declined friend request from ${username}`);
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      Alert.alert('Error', 'Failed to reject friend request');
    }
  };

  const handleCancelRequest = async (userId, username) => {
    try {
      await api.delete(`/api/friends/cancel/${userId}`);
      
      // Remove from the current list
      setUsers(prev => prev.filter(user => user._id !== userId));
      
      Alert.alert('Success', `Cancelled friend request to ${username}`);
    } catch (error) {
      console.error('Error cancelling friend request:', error);
      Alert.alert('Error', 'Failed to cancel friend request');
    }
  };

  const handleRemoveFriend = async (userId, username) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${username} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/friends/remove/${userId}`);
              
              // Remove from the current list
              setUsers(prev => prev.filter(user => user._id !== userId));
              
              Alert.alert('Success', `Removed ${username} from friends`);
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert('Error', 'Failed to remove friend');
            }
          }
        }
      ]
    );
  };

  const renderActionButtons = (user) => {
    if (mode === 'requests') {
      // Friend request received - show Accept/Decline
      return (
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleAcceptRequest(user._id, user.username)}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.declineButton}
            onPress={() => handleRejectRequest(user._id, user.username)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={16} color="#FF3B30" />
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      );
    } else if (mode === 'sent') {
      // Sent request - show Cancel
      return (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => handleCancelRequest(user._id, user.username)}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={16} color="#8E8E93" />
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      );
    } else if (mode === 'friends' && isSelf) {
      // Your friends - show options menu
      return (
        <TouchableOpacity
          style={styles.optionsButton}
          onPress={() => {
            Alert.alert(
              user.username,
              'Choose an action',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'View Profile',
                  onPress: () => handlePressUser(user)
                },
                {
                  text: 'Remove Friend',
                  style: 'destructive',
                  onPress: () => handleRemoveFriend(user._id, user.username)
                }
              ]
            );
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#8E8E93" />
        </TouchableOpacity>
      );
    } else {
      // Other cases - just show View button
      return (
        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => handlePressUser(user)}
          activeOpacity={0.8}
        >
          <Text style={styles.viewButtonText}>View</Text>
        </TouchableOpacity>
      );
    }
  };

  const renderItem = ({ item }) => {
    const avatar = item.profilePicture
      ? `http://${API_BASE_URL}:3000${item.profilePicture}`
      : 'https://placehold.co/56x56.png?text=👤';

    // Show friendship date for friends list
    const showFriendshipDate = mode === 'friends' && item.friendshipDate;
    const friendshipDate = showFriendshipDate 
      ? new Date(item.friendshipDate).toLocaleDateString()
      : null;

    return (
      <View style={styles.userRow}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => handlePressUser(item)}
          activeOpacity={0.95}
        >
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <View style={styles.userDetails}>
            <Text style={styles.username}>{item.username}</Text>
            {item.displayName && (
              <Text style={styles.displayName}>{item.displayName}</Text>
            )}
            {friendshipDate && (
              <Text style={styles.friendshipDate}>Friends since {friendshipDate}</Text>
            )}
            {mode === 'requests' && item.requestMessage && (
              <Text style={styles.requestMessage} numberOfLines={2}>
                "{item.requestMessage}"
              </Text>
            )}
          </View>
        </TouchableOpacity>
        
        {renderActionButtons(item)}
      </View>
    );
  };

  const getEmptyStateContent = () => {
    switch (mode) {
      case 'friends':
        return {
          icon: 'people-outline',
          title: isSelf ? 'No friends yet' : 'No friends to show',
          subtitle: isSelf 
            ? 'Start connecting with people to build your network!'
            : 'This user hasn\'t shared their friends list or has no friends yet.'
        };
      case 'mutual':
        return {
          icon: 'people-circle-outline',
          title: 'No mutual friends',
          subtitle: 'You don\'t have any friends in common with this person yet.'
        };
      case 'requests':
        return {
          icon: 'mail-outline',
          title: 'No friend requests',
          subtitle: 'You don\'t have any pending friend requests.'
        };
      case 'sent':
        return {
          icon: 'paper-plane-outline',
          title: 'No sent requests',
          subtitle: 'You haven\'t sent any friend requests yet.'
        };
      default:
        return {
          icon: 'people-outline',
          title: 'No users found',
          subtitle: 'Try refreshing the page.'
        };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const emptyState = getEmptyStateContent();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {users.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons 
              name={emptyState.icon} 
              size={64} 
              color="#C7C7CC" 
            />
          </View>
          <Text style={styles.emptyTitle}>{emptyState.title}</Text>
          <Text style={styles.emptySubtitle}>{emptyState.subtitle}</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsText}>
              {users.length} {mode === 'friends' ? 'friends' : 
                           mode === 'mutual' ? 'mutual friends' :
                           mode === 'requests' ? 'friend requests' :
                           'sent requests'}
            </Text>
          </View>
          
          <FlatList
            data={users}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            refreshing={refreshing}
            onRefresh={() => fetchFriendsList(true)}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF' 
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  content: {
    flex: 1,
  },
  statsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 0.33,
    borderBottomColor: '#E1E1E1',
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    textAlign: 'center',
  },
  listContainer: {
    paddingVertical: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F6F6F6',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  displayName: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  friendshipDate: {
    fontSize: 12,
    color: '#C7C7CC',
    fontStyle: 'italic',
  },
  requestMessage: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
    marginTop: 2,
  },

  // Action Buttons
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  declineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
    gap: 4,
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    gap: 4,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  viewButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  optionsButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
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