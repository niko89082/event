// screens/ProfileScreen.js - True Instagram-style Scrolling
import React, { useEffect, useState, useContext, useRef } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, StatusBar, Dimensions,
  FlatList, RefreshControl, Animated
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import { API_BASE_URL } from '@env';

// Import components
import EventsTab from '../components/EventsTab';
import SharedEventsTab from '../components/SharedEventsTab';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const Tab = createMaterialTopTabNavigator();

export default function ProfileScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);

  const userId = params?.userId || currentUser?._id;
  const isSelf = userId === currentUser?._id;

  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [activeTab, setActiveTab] = useState('Posts');

  // Set up navigation header
  useEffect(() => {
    navigation.setOptions({
      title: isSelf ? 'Profile' : user?.username || 'Profile',
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
      headerRight: () => (
        <View style={styles.headerRightContainer}>
          {isSelf && (
            <TouchableOpacity
              onPress={() => navigation.navigate('UserSettingsScreen')}
              style={styles.headerButton}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={24} color="#000000" />
            </TouchableOpacity>
          )}
        </View>
      ),
    });
  }, [navigation, isSelf, user]);

  useFocusEffect(
    React.useCallback(() => {
      fetchUserProfile();
    }, [userId])
  );

  const fetchUserProfile = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const { data } = await api.get(`/api/profile/${userId}`);
      setUser(data);
      setPosts(data.photos || []);
      setIsFollowing(data.isFollowing || false);
      setHasRequested(data.hasRequested || false);

    } catch (error) {
      console.error('Error fetching profile:', error);
      if (error.response?.status === 404) {
        Alert.alert('Error', 'User not found');
        navigation.goBack();
      } else if (error.response?.status === 403) {
        Alert.alert('Private Account', 'This account is private.');
      } else if (error.response?.status === 401) {
        Alert.alert('Authentication Error', 'Please log in again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await api.delete(`/api/follow/unfollow/${userId}`);
        setIsFollowing(false);
      } else {
        const { data } = await api.post(`/api/follow/follow/${userId}`);
        if (data.requestSent) {
          setHasRequested(true);
        } else {
          setIsFollowing(true);
        }
      }
    } catch (error) {
      console.error('Follow error:', error);
      Alert.alert('Error', 'Unable to follow/unfollow user');
    }
  };

  const renderProfileHeader = () => {
    if (!user) return null;

    const avatar = user.profilePicture
      ? `http://${API_BASE_URL}:3000${user.profilePicture}`
      : 'https://placehold.co/120x120.png?text=👤';

    const followerCount = user.followers?.length || 0;
    const followingCount = user.following?.length || 0;
    const postCount = posts.length;

    return (
      <View style={styles.profileHeader}>
        {/* Profile Image and Basic Info */}
        <View style={styles.profileImageSection}>
          <Image source={{ uri: avatar }} style={styles.profileImage} />
          <View style={styles.profileInfo}>
            <Text style={styles.username}>{user.username}</Text>
            {user.bio && (
              <Text style={styles.bio} numberOfLines={3}>
                {user.bio}
              </Text>
            )}
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{postCount}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>

          <TouchableOpacity
            style={styles.statItem}
            onPress={() => navigation.navigate('FollowListScreen', {
              userId,
              mode: 'followers'
            })}
            activeOpacity={0.8}
            disabled={!user.isPublic && !isSelf && !isFollowing}
          >
            <Text style={styles.statNumber}>{followerCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statItem}
            onPress={() => navigation.navigate('FollowListScreen', {
              userId,
              mode: 'following'
            })}
            activeOpacity={0.8}
            disabled={!user.isPublic && !isSelf && !isFollowing}
          >
            <Text style={styles.statNumber}>{followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {isSelf ? (
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() => navigation.navigate('EditProfileScreen')}
              activeOpacity={0.8}
            >
              <Text style={styles.editProfileButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.followButton,
                  (isFollowing || hasRequested) && styles.followingButton
                ]}
                onPress={handleFollow}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.followButtonText,
                  (isFollowing || hasRequested) && styles.followingButtonText
                ]}>
                  {hasRequested ? 'Requested' : isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.messageButton}
                onPress={() => navigation.navigate('ChatScreen', {
                  recipientId: userId,
                  headerUser: user
                })}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble-outline" size={20} color="#3797EF" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderTabBar = () => (
    <View style={styles.tabBarContainer}>
      <TouchableOpacity
        style={[styles.tabBarItem, activeTab === 'Posts' && styles.activeTabBarItem]}
        onPress={() => setActiveTab('Posts')}
        activeOpacity={0.8}
      >
        <Ionicons 
          name="grid-outline" 
          size={24} 
          color={activeTab === 'Posts' ? '#000000' : '#8E8E93'} 
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabBarItem, activeTab === 'Events' && styles.activeTabBarItem]}
        onPress={() => setActiveTab('Events')}
        activeOpacity={0.8}
      >
        <Ionicons 
          name="calendar-outline" 
          size={24} 
          color={activeTab === 'Events' ? '#000000' : '#8E8E93'} 
        />
      </TouchableOpacity>
    </View>
  );

  const renderPostGrid = ({ item }) => (
    <TouchableOpacity
      style={styles.postThumbnail}
      onPress={() => navigation.navigate('PostDetailsScreen', { postId: item._id })}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: `http://${API_BASE_URL}:3000${item.paths[0]}` }}
        style={styles.postImage}
      />
      {item.event && (
        <View style={styles.eventIndicator}>
          <Ionicons name="calendar" size={12} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderPostsContent = () => {
    if (!user.isPublic && !isSelf && !isFollowing) {
      return (
        <View style={styles.privateAccountContainer}>
          <Ionicons name="lock-closed-outline" size={64} color="#C7C7CC" />
          <Text style={styles.privateAccountTitle}>This account is private</Text>
          <Text style={styles.privateAccountSubtitle}>
            Follow this account to see their posts
          </Text>
        </View>
      );
    }

    if (posts.length === 0) {
      return (
        <View style={styles.emptyPostsContainer}>
          <Ionicons name="camera-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyPostsTitle}>
            {isSelf ? 'Share your first post' : 'No posts yet'}
          </Text>
          <Text style={styles.emptyPostsSubtitle}>
            {isSelf
              ? 'When you share photos, they\'ll appear on your profile.'
              : 'When they share photos, they\'ll appear here.'
            }
          </Text>
          {isSelf && (
            <TouchableOpacity
              style={styles.createPostButton}
              onPress={() => navigation.navigate('CreatePickerScreen')}
              activeOpacity={0.8}
            >
              <Text style={styles.createPostButtonText}>Create Post</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return posts;
  };

  const renderEventsContent = () => {
    return (
      <View style={styles.eventsTabContainer}>
        {isSelf ? (
          <EventsTab 
            navigation={navigation} 
            userId={userId} 
            isSelf={isSelf}
            currentUserId={currentUser?._id}
          />
        ) : (
          <SharedEventsTab 
            navigation={navigation} 
            userId={userId} 
            isSelf={isSelf} 
          />
        )}
      </View>
    );
  };

  if (loading && !user) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="person-outline" size={80} color="#C7C7CC" />
        <Text style={styles.errorTitle}>Profile not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // For Posts tab - use FlatList for Instagram-like scrolling
  if (activeTab === 'Posts') {
    const postsData = renderPostsContent();
    
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        
        <FlatList
          data={Array.isArray(postsData) ? postsData : []}
          renderItem={renderPostGrid}
          keyExtractor={(item) => item._id}
          numColumns={3}
          ListHeaderComponent={() => (
            <View>
              {renderProfileHeader()}
              {renderTabBar()}
            </View>
          )}
          ListEmptyComponent={() => (
            Array.isArray(postsData) ? null : postsData
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchUserProfile(true)}
              tintColor="#3797EF"
              colors={["#3797EF"]}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            Array.isArray(postsData) && postsData.length > 0 ? styles.postsGrid : {}
          }
          scrollEventThrottle={16}
        />
      </SafeAreaView>
    );
  }

  // For Events tab - separate structure with its own scrolling
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <FlatList
        data={[]} // Empty data array, using ListHeaderComponent for content
        renderItem={() => null}
        ListHeaderComponent={() => (
          <View>
            {renderProfileHeader()}
            {renderTabBar()}
            {renderEventsContent()}
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchUserProfile(true)}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
        }
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#FFFFFF',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginTop: 16,
    marginBottom: 32,
  },
  goBackButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  goBackText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 4,
  },

  // Profile Header
  profileHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  profileImageSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: '#F6F6F6',
    marginRight: 20,
  },
  profileInfo: {
    flex: 1,
  },
  username: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editProfileButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editProfileButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  followButton: {
    flex: 1,
    backgroundColor: '#3797EF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  followingButton: {
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  followButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  followingButtonText: {
    color: '#8E8E93',
  },
  messageButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E1E8F7',
  },

  // Tab Bar
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  tabBarItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabBarItem: {
    borderBottomColor: '#000000',
  },

  // Posts Grid
  postsGrid: {
    padding: 2,
  },
  postThumbnail: {
    width: (SCREEN_WIDTH - 6) / 3,
    height: (SCREEN_WIDTH - 6) / 3,
    margin: 1,
    position: 'relative',
  },
  postImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
  },
  eventIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(55, 151, 239, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Events Tab Container
  eventsTabContainer: {
    minHeight: 400, // Ensure enough height for events content
    backgroundColor: '#F8F9FA',
  },

  // Empty States
  emptyPostsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 100,
  },
  emptyPostsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyPostsSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  createPostButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createPostButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Private Account
  privateAccountContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 100,
  },
  privateAccountTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  privateAccountSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
});