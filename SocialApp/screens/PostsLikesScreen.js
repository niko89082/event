// screens/PostLikesScreen.js - Show who liked a post
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, ActivityIndicator, Alert, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function PostLikesScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);

  const { postId, likeCount } = params;
  const [likes, setLikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(new Set());

  useEffect(() => {
    fetchLikes();
    fetchFollowingStatus();
  }, [postId]);

  const fetchLikes = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/api/photos/${postId}/likes`);
      setLikes(data.likes || []);
    } catch (error) {
      console.error('Error fetching likes:', error);
      Alert.alert('Error', 'Failed to load likes');
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowingStatus = async () => {
    try {
      const { data } = await api.get('/api/users/following');
      const followingIds = new Set(data.following.map(user => user._id));
      setFollowing(followingIds);
    } catch (error) {
      console.error('Error fetching following status:', error);
    }
  };

  const handleFollow = async (userId) => {
    try {
      const isFollowing = following.has(userId);
      
      if (isFollowing) {
        await api.delete(`/api/users/unfollow/${userId}`);
        setFollowing(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      } else {
        await api.post(`/api/users/follow/${userId}`);
        setFollowing(prev => new Set([...prev, userId]));
      }
    } catch (error) {
      console.error('Follow/unfollow error:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  const getProfilePictureUrl = (user) => {
    if (!user?.profilePicture) {
      return 'https://placehold.co/48x48.png?text=👤';
    }
    
    if (user.profilePicture.startsWith('http')) {
      return user.profilePicture;
    }
    
    const path = user.profilePicture.startsWith('/') 
      ? user.profilePicture 
      : `/${user.profilePicture}`;
    
    return `http://${API_BASE_URL}:3000${path}`;
  };

  const renderLikeItem = ({ item: user }) => {
    const isCurrentUser = user._id === currentUser._id;
    const isFollowingUser = following.has(user._id);

    return (
      <View style={styles.likeItem}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => navigation.navigate('ProfileScreen', { userId: user._id })}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: getProfilePictureUrl(user) }}
            style={styles.avatar}
          />
          <View style={styles.userDetails}>
            <Text style={styles.username}>{user.username}</Text>
            {user.name && (
              <Text style={styles.fullName}>{user.name}</Text>
            )}
          </View>
        </TouchableOpacity>

        {!isCurrentUser && (
          <TouchableOpacity
            style={[
              styles.followButton,
              isFollowingUser && styles.followingButton
            ]}
            onPress={() => handleFollow(user._id)}
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

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="heart-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>No likes yet</Text>
      <Text style={styles.emptySubtitle}>
        Be the first to show some love! ❤️
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerButton}
          >
            <Ionicons name="chevron-back" size={28} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Likes</Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading likes...</Text>
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
          style={styles.headerButton}
        >
          <Ionicons name="chevron-back" size={28} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {likeCount} {likeCount === 1 ? 'Like' : 'Likes'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Likes List */}
      <FlatList
        data={likes}
        keyExtractor={(item) => item._id}
        renderItem={renderLikeItem}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={likes.length === 0 ? styles.emptyListContainer : styles.listContainer}
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  headerRight: {
    width: 36,
  },

  // List
  listContainer: {
    paddingVertical: 8,
  },
  emptyListContainer: {
    flex: 1,
  },

  // Like Item
  likeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
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
  },
  fullName: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },

  // Follow Button
  followButton: {
    backgroundColor: '#3797EF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: 'transparent',
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

  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
});