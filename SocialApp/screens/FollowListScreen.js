// screens/FollowListScreen.js - Instagram/X style followers/following list
import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, 
  SafeAreaView, StatusBar, ActivityIndicator, Image, Alert,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function FollowListScreen({ route, navigation }) {
  const { userId, mode } = route.params || {}; // mode: 'followers' or 'following'
  const { currentUser } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followingStatus, setFollowingStatus] = useState({}); // Track who current user follows

  const isSelf = userId === currentUser?._id;
  const isFollowersMode = mode === 'followers';

  useEffect(() => {
    const title = isFollowersMode ? 'Followers' : 'Following';
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
      headerTitle: title,
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
      ),
      headerLeftContainerStyle: {
        paddingLeft: 16,
      },
    });
  }, [navigation, mode]);

  useEffect(() => {
    fetchList();
  }, [userId, mode]);

  const fetchList = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const endpoint = isFollowersMode 
        ? `/api/profile/${userId}/followers`
        : `/api/profile/${userId}/following`;
      
      const res = await api.get(endpoint);
      const userList = isFollowersMode ? res.data.followers : res.data.following;
      
      setUsers(userList || []);
      
      // If viewing followers, check which ones the current user follows
      if (isFollowersMode && !isSelf && currentUser) {
        const followingMap = {};
        userList.forEach(user => {
          // Check if current user follows this follower
          // We'll need to check this from the current user's following list
          followingMap[user._id] = false; // Default, will update if needed
        });
        setFollowingStatus(followingMap);
      }

    } catch (err) {
      console.error('Error fetching list:', err.response?.data || err);
      Alert.alert('Error', 'Failed to load list. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleFollow = async (targetUserId, isCurrentlyFollowing) => {
    try {
      if (isCurrentlyFollowing) {
        await api.delete(`/api/follow/unfollow/${targetUserId}`);
      } else {
        await api.post(`/api/follow/follow/${targetUserId}`);
      }
      
      setFollowingStatus(prev => ({
        ...prev,
        [targetUserId]: !isCurrentlyFollowing
      }));
    } catch (error) {
      console.error('Error following/unfollowing:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  const handlePressUser = (clickedUser) => {
    navigation.navigate('ProfileScreen', { userId: clickedUser._id });
  };

  const renderItem = ({ item }) => {
    const avatar = item.profilePicture
      ? `http://${API_BASE_URL}:3000${item.profilePicture}`
      : 'https://placehold.co/44x44.png?text=👤';

    const isFollowingUser = followingStatus[item._id] || false;
    const showFollowButton = !isSelf && isFollowersMode;

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
            {item.bio && (
              <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text>
            )}
          </View>
        </TouchableOpacity>
        
        {showFollowButton && (
          <TouchableOpacity
            style={[
              styles.followButton,
              isFollowingUser && styles.followingButton
            ]}
            onPress={() => handleFollow(item._id, isFollowingUser)}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.followButtonText,
              isFollowingUser && styles.followingButtonText
            ]}>
              {isFollowingUser ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2B8CEE" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {users.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons 
            name={isFollowersMode ? "people-outline" : "person-outline"} 
            size={64} 
            color="#C7C7CC" 
          />
          <Text style={styles.emptyTitle}>
            {isFollowersMode ? 'No followers yet' : 'Not following anyone'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {isFollowersMode 
              ? 'When someone follows this account, they\'ll appear here.'
              : 'When this account follows someone, they\'ll appear here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchList(true)}
              tintColor="#2B8CEE"
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
    backgroundColor: '#FFFFFF' 
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
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
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F6F6F6',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  displayName: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  bio: {
    fontSize: 13,
    color: '#8E8E93',
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2B8CEE',
    minWidth: 90,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  followingButtonText: {
    color: '#000000',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
});
