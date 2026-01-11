// screens/ProfileScreen.js - FIXED: Updated with correct API endpoints
import React, { useEffect, useState, useContext, useRef, useCallback } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, StatusBar, Dimensions,
  FlatList, RefreshControl, Modal, ScrollView, Animated, PanResponder
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import { API_BASE_URL } from '@env';
import PostActivityComponent from '../components/PostActivityComponent';
import PhotoGrid from '../components/PhotoGrid';
import usePostsStore from '../stores/postsStore';
import AboutSection from '../components/AboutSection';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Event filter options for the Events tab
const EVENT_FILTERS = [
  { key: 'all', label: 'All Events', icon: 'calendar-outline' },
  { key: 'upcoming', label: 'Upcoming', icon: 'arrow-up-circle-outline' },
  { key: 'past', label: 'Past', icon: 'time-outline' },
  { key: 'hosted', label: 'Hosted', icon: 'star-outline' },
  { key: 'attending', label: 'Attending', icon: 'checkmark-circle-outline' },
  { key: 'shared', label: 'Shared', icon: 'eye-outline' }
];

// Animation constants for swipe functionality
const ANIMATION_DURATION = 250;

export default function ProfileScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);

  const userId = params?.userId || currentUser?._id;
  const isSelf = !params?.userId || userId === currentUser?._id;
  // State
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [memories, setMemories] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [sharedEventIds, setSharedEventIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [eventsCount, setEventsCount] = useState(0);
  // Follow system state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  
  const [eventFilter, setEventFilter] = useState('all');
  const [showManageModal, setShowManageModal] = useState(false);
  const [showMemoriesTab, setShowMemoriesTab] = useState(true);

  // NEW: Swipe tab system
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);
  const currentTabIndex = useRef(0);

  // ✅ UPDATED: Dynamic tab array with Posts and Photos tabs
const getTabs = () => {
  const tabs = ['Posts', 'Photos', 'Events'];
  if (isSelf || showMemoriesTab) {
    tabs.push('Memories');
  }
  return tabs;
};

  const tabs = getTabs();

  // Update ref when active tab changes
  useEffect(() => {
    currentTabIndex.current = activeTabIndex;
  }, [activeTabIndex]);
  // Handle follow/unfollow
  const handleFollow = async () => {
    try {
      const userIdStr = userId?.toString();
      if (!userIdStr) {
        Alert.alert('Error', 'Invalid user ID');
        return;
      }

      if (isFollowing) {
        const response = await api.delete(`/api/follow/unfollow/${userIdStr}`);
        console.log('✅ Unfollow response:', response.data);
        setIsFollowing(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
      } else {
        const response = await api.post(`/api/follow/follow/${userIdStr}`);
        console.log('✅ Follow response:', response.data);
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('❌ Error following/unfollowing:', error);
      console.error('❌ Error response:', error.response?.data);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update follow status';
      Alert.alert('Error', errorMessage);
    }
  };

  // PanResponder for swipe functionality (same as before)
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2 && !isAnimating.current;
      },
      onStartShouldSetPanResponder: () => {
        return false;
      },
      onPanResponderGrant: () => {
        scrollX.stopAnimation();
        isAnimating.current = false;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (isAnimating.current) return;
        
        const { dx } = gestureState;
        const currentTab = currentTabIndex.current;
        const baseOffset = -currentTab * SCREEN_WIDTH;
        let newOffset = baseOffset + dx;
        
        const minOffset = -(tabs.length - 1) * SCREEN_WIDTH;
        const maxOffset = 0;
        const RESISTANCE_FACTOR = 0.25;
        
        if (newOffset > maxOffset) {
          newOffset = maxOffset + (newOffset - maxOffset) * RESISTANCE_FACTOR;
        } else if (newOffset < minOffset) {
          newOffset = minOffset + (newOffset - minOffset) * RESISTANCE_FACTOR;
        }
        
        if (Number.isFinite(newOffset)) {
          scrollX.setValue(newOffset);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (isAnimating.current) return;
        
        const { dx, vx } = gestureState;
        const currentTab = currentTabIndex.current;
        let targetIndex = currentTab;
        
        const DISTANCE_THRESHOLD = 60;
        const VELOCITY_THRESHOLD = 0.3;
        
        const shouldSwipe = Math.abs(dx) > DISTANCE_THRESHOLD || Math.abs(vx) > VELOCITY_THRESHOLD;
        
        if (shouldSwipe) {
          if (dx > 0 && currentTab > 0) {
            targetIndex = currentTab - 1;
          } else if (dx < 0 && currentTab < tabs.length - 1) {
            targetIndex = currentTab + 1;
          }
        }
        
        switchToTab(targetIndex);
      },
      onPanResponderTerminationRequest: (evt, gestureState) => {
        const { dx } = gestureState;
        const isLTRSwipe = dx < 0;
        
        return isLTRSwipe 
          ? Math.abs(dx) < 10
          : Math.abs(dx) < 25;
      },
      onPanResponderTerminate: (evt, gestureState) => {
        const { dx } = gestureState;
        const isLTRSwipe = dx < 0;
        
        const recoveryThreshold = isLTRSwipe ? 40 : 60;
        
        if (Math.abs(dx) > recoveryThreshold) {
          const currentTab = currentTabIndex.current;
          let targetIndex = currentTab;
          
          if (dx > 0 && currentTab > 0) {
            targetIndex = currentTab - 1;
          } else if (dx < 0 && currentTab < tabs.length - 1) {
            targetIndex = currentTab + 1;
          }
          
          if (targetIndex !== currentTab) {
            setTimeout(() => switchToTab(targetIndex), 50);
          }
        }
        
        isAnimating.current = false;
      },
    })
  ).current;

  // Switch to tab function (same as before)
  const switchToTab = useCallback((index) => {
  const targetIndex = Math.max(0, Math.min(tabs.length - 1, index));
  
  if (isAnimating.current) return;
  
  isAnimating.current = true;
  
  const targetContentOffset = -targetIndex * SCREEN_WIDTH;
  
  setActiveTabIndex(targetIndex);
  
  Animated.timing(scrollX, {
    toValue: targetContentOffset,
    duration: ANIMATION_DURATION,
    useNativeDriver: true,
  }).start((finished) => {
    if (finished) {
      isAnimating.current = false;
      // Updated: Events are now at index 0, Memories at index 1
      if (targetIndex === 0 && events.length === 0) {
        fetchUserEvents();
      } else if (targetIndex === 1 && memories.length === 0) {
        fetchUserMemories();
      }
    }
  });
}, [tabs.length, events.length, memories.length]);
  // Handle tab press
  const handleTabPress = useCallback((index) => {
    switchToTab(index);
  }, [switchToTab]);

  // Fetch follow status
  const fetchFollowStatus = async () => {
    if (isSelf) {
      return;
    }

    try {
      const { data } = await api.get(`/api/profile/${userId}`);
      setIsFollowing(data.isFollowing || false);
    } catch (error) {
      console.error('Error fetching follow status:', error);
    }
  };

  // Fetch follow counts
  const fetchFollowCounts = async () => {
    try {
      const { data: followersData } = await api.get(`/api/profile/${userId}/followers`);
      const { data: followingData } = await api.get(`/api/profile/${userId}/following`);
      setFollowersCount(followersData.count || 0);
      setFollowingCount(followingData.count || 0);
    } catch (error) {
      console.log('Could not fetch follow counts:', error);
    }
  };

  // Fetch user profile data (UPDATED for friends system)
// FIXED: Fetch user profile data with proper sequencing and debugging
const fetchUserProfile = async (isRefresh = false) => {
  try {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    console.log('📡 === PROFILE FETCH START ===');
    console.log('📡 Fetching profile data for userId:', userId);
    console.log('📡 isSelf:', isSelf);
    
    // Fetch follow status if not self
    if (!isSelf) {
      await fetchFollowStatus();
    }
    
    // Fetch profile data
    console.log('📡 Fetching profile data from /api/profile/' + userId);
    const { data } = await api.get(`/api/profile/${userId}`);
    console.log('✅ Profile data received:', { 
      username: data.username, 
      postsCount: data.postsCount || data.photos?.length || 0,
      canViewContent: data.photos?.length > 0 || 'backend-filtered'
    });
    
    setUser(data);
    
    // Show all posts (everything is public by default)
    const allPosts = data.photos || [];
    const postsWithUser = allPosts.map(post => ({
      ...post,
      user: post.user || {
        _id: data._id,
        username: data.username,
        profilePicture: data.profilePicture
      }
    }));
    const sortedPosts = postsWithUser.sort((a, b) => 
      new Date(b.createdAt || b.uploadDate) - new Date(a.createdAt || a.uploadDate)
    );
    setPosts(sortedPosts);
    
    // Sync posts to centralized store for like state management
    if (sortedPosts.length > 0) {
      usePostsStore.getState().setPosts(sortedPosts, currentUser?._id);
    }
    
    console.log('📸 Showing all posts (public by default):', sortedPosts.length);
    
    // Set follow counts from profile data
    if (data.followersCount !== undefined) {
      setFollowersCount(data.followersCount);
    }
    if (data.followingCount !== undefined) {
      setFollowingCount(data.followingCount);
    }
    if (data.isFollowing !== undefined) {
      setIsFollowing(data.isFollowing);
    }
    
    // Fetch follow counts if not provided
    if (data.followersCount === undefined || data.followingCount === undefined) {
      await fetchFollowCounts();
    }

    // ALWAYS fetch events to get the count (regardless of active tab)
    await fetchUserEvents();

    // Fetch memories if on Memories tab
    if (activeTabIndex === 3) {
      console.log('📚 On memories tab, fetching memories...');
      await fetchUserMemories();
    }

    // Check if we should show memories tab for other users
    if (!isSelf) {
      await checkSharedMemories();
    }
    
    console.log('✅ === PROFILE FETCH COMPLETE ===');

  } catch (error) {
    console.error('❌ Error fetching profile:', error);
    console.error('❌ Error details:', error.response?.data);
    console.error('❌ Error status:', error.response?.status);
    
    if (error.response?.status === 404) {
      Alert.alert('Error', 'User not found');
      navigation.goBack();
    } else if (error.response?.status === 403) {
      Alert.alert('Privacy Notice', 'Some content may be limited based on your connection with this user.');
      if (error.response?.data?.user) {
        setUser(error.response.data.user);
        setPosts([]); // Backend restricted posts
      }
    } else {
      Alert.alert('Error', 'Failed to load profile');
    }
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

  // Handle post deletion
  const handlePostDelete = async (postId) => {
    try {
      // Remove from local state
      setPosts(prevPosts => prevPosts.filter(p => p._id !== postId));
      console.log('✅ Post removed from local state:', postId);
    } catch (error) {
      console.error('❌ Error removing post from state:', error);
    }
  };

  // Handle post update
  const handlePostUpdate = async (postId, updates) => {
    try {
      // Update local state
      setPosts(prevPosts => 
        prevPosts.map(p => 
          p._id === postId ? { ...p, ...updates } : p
        )
      );
      console.log('✅ Post updated in local state:', postId, updates);
    } catch (error) {
      console.error('❌ Error updating post in state:', error);
    }
  };

  // Handle like/unlike for posts
  const handlePostLike = async (postId) => {
    try {
      console.log('🔄 Toggling like for post:', postId);
      
      // Find the post in the current posts array
      const postIndex = posts.findIndex(p => p._id === postId);
      if (postIndex === -1) {
        console.warn('⚠️ Post not found in local state:', postId);
        return;
      }

      const post = posts[postIndex];
      const wasLiked = post.userLiked || (post.likes && post.likes.includes && post.likes.includes(currentUser?._id));
      const newLiked = !wasLiked;
      const newCount = wasLiked ? (post.likeCount || post.likes?.length || 0) - 1 : (post.likeCount || post.likes?.length || 0) + 1;

      // Optimistic update
      const updatedPosts = [...posts];
      updatedPosts[postIndex] = {
        ...post,
        userLiked: newLiked,
        likeCount: newCount,
        likes: newLiked 
          ? [...(post.likes || []), currentUser?._id].filter(Boolean)
          : (post.likes || []).filter(id => String(id) !== String(currentUser?._id))
      };
      setPosts(updatedPosts);

      // Make API call
      const response = await api.post(`/api/photos/like/${postId}`);
      
      // Update with server response
      const finalPosts = [...updatedPosts];
      finalPosts[postIndex] = {
        ...finalPosts[postIndex],
        userLiked: response.data.userLiked || response.data.liked,
        likeCount: response.data.likeCount || response.data.likes?.length || 0,
        likes: response.data.likes || finalPosts[postIndex].likes
      };
      setPosts(finalPosts);

      console.log('✅ Like toggled successfully');
    } catch (error) {
      console.error('❌ Error toggling like:', error.response?.data || error);
      
      // Revert optimistic update on error
      const postIndex = posts.findIndex(p => p._id === postId);
      if (postIndex !== -1) {
        const post = posts[postIndex];
        const updatedPosts = [...posts];
        updatedPosts[postIndex] = {
          ...post,
          userLiked: !post.userLiked,
          likeCount: post.userLiked ? (post.likeCount || 0) - 1 : (post.likeCount || 0) + 1
        };
        setPosts(updatedPosts);
      }
      
      Alert.alert('Error', 'Failed to like post. Please try again.');
    }
  };

useEffect(() => {
  if (activeTabIndex === 2 && !eventsLoading) { // Events tab is now index 2
    if (events.length === 0) {
      fetchUserEvents();
    }
  }
}, [activeTabIndex, isSelf]);

  // Fetch user events
const fetchUserEvents = async () => {
  try {
    setEventsLoading(true);
    
    console.log(`📅 Fetching events for userId: ${userId} (isSelf: ${isSelf})`);
    const { data } = await api.get(`/api/events/user/${userId}?includePast=true&limit=100`);
    
    const sortedEvents = (data.events || []).sort((a, b) => 
      new Date(b.time) - new Date(a.time)
    );
    
    // ENHANCED SAFETY CHECK: Make sure events belong to the correct user
    const userEvents = sortedEvents.filter(event => {
      const eventUserId = event.host?._id || event.host;
      const isUserEvent = String(eventUserId) === String(userId) || 
                         event.userRelationship === 'host' ||
                         event.userRelationship === 'attendee';
      
      if (!isUserEvent) {
        console.warn('🚨 Filtering out event that doesn\'t belong to user:', event._id);
      }
      
      return isUserEvent;
    });
    
    setEvents(userEvents);
    // NEW: Set events count (hosted + attended)
    setEventsCount(userEvents.length);
    
    if (isSelf && data.sharedEventIds) {
      setSharedEventIds(new Set(data.sharedEventIds));
    }
    
    console.log(`✅ Loaded ${userEvents.length} events for user ${userId}`);
    
  } catch (error) {
    console.error('❌ Error fetching events:', error);
    if (error.response?.status === 403) {
      setEvents([]);
      setEventsCount(0); // Reset count on error
      console.log('📝 Events restricted by backend privacy filtering');
    } else {
      Alert.alert('Error', 'Failed to load events. Please try again.');
    }
  } finally {
    setEventsLoading(false);
  }
};


  // Fetch user memories (same as before)
  const fetchUserMemories = async () => {
  try {
    setMemoriesLoading(true);
    const { data } = await api.get(`/api/memories/user/${userId}`);
    
    // Backend already filtered memories based on participation and friendship
    const sortedMemories = (data.memories || []).sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    setMemories(sortedMemories);
    console.log(`✅ Loaded ${sortedMemories.length} memories for user ${userId} (backend filtered)`);
  } catch (error) {
    console.error('Error fetching memories:', error);
    if (error.response?.status === 403) {
      // Backend restricted memories due to privacy
      setMemories([]);
      console.log('📝 Memories restricted by backend privacy filtering');
    }
    // Don't show alert for memories since they're optional content
  } finally {
    setMemoriesLoading(false);
  }
};

  // Check shared memories (same as before)
  const checkSharedMemories = async () => {
    try {
      const { data } = await api.get(`/api/memories/user/${userId}`, {
        params: { page: 1, limit: 1 }
      });
      
      const hasSharedMemories = data.memories && data.memories.length > 0;
      setShowMemoriesTab(hasSharedMemories);
    } catch (error) {
      console.error('Error checking shared memories:', error);
      setShowMemoriesTab(false);
    }
  };

  // Apply event filters (same as before)
  useEffect(() => {
    if (!Array.isArray(events)) {
      setFilteredEvents([]);
      return;
    }

    let filtered = [...events];
    const now = new Date();

    switch (eventFilter) {
      case 'upcoming':
        filtered = events.filter(e => new Date(e.time) > now);
        filtered.sort((a, b) => new Date(a.time) - new Date(b.time));
        break;
      case 'past':
        filtered = events.filter(e => new Date(e.time) <= now);
        filtered.sort((a, b) => new Date(b.time) - new Date(a.time));
        break;
      case 'hosted':
        filtered = events.filter(e => e.isHost || e.userRelationship === 'host');
        break;
      case 'attending':
        filtered = events.filter(e => (e.isAttending || e.userRelationship === 'attendee') && !e.isHost);
        break;
      case 'shared':
        filtered = events.filter(e => sharedEventIds.has(e._id));
        break;
      default:
        filtered.sort((a, b) => new Date(b.time) - new Date(a.time));
        break;
    }

    setFilteredEvents(filtered);
  }, [events, eventFilter, sharedEventIds]);

  // Load profile on mount and when userId changes
  useEffect(() => {
    fetchUserProfile();
  }, [userId]);

  // Handle follow/unfollow action
  const handleFollowAction = async () => {
    try {
      await handleFollow();
      // Refresh follow status and counts after action
      await Promise.all([
        fetchFollowStatus(),
        fetchFollowCounts()
      ]);
    } catch (error) {
      console.error('Follow action error:', error);
    }
  };


  const renderFollowButton = () => {
    if (isSelf) return null;
    
    return (
      <TouchableOpacity
        style={[
          styles.friendButton,
          isFollowing && styles.friendsButton
        ]}
        onPress={handleFollowAction}
        activeOpacity={0.8}
      >
        <View style={styles.friendButtonContent}>
          <Ionicons 
            name={isFollowing ? 'checkmark-circle' : 'person-add'} 
            size={16} 
            color={isFollowing ? '#34C759' : '#FFFFFF'} 
            style={styles.friendButtonIcon}
          />
          <Text style={[
            styles.friendButtonText,
            isFollowing && styles.friendsButtonText
          ]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };


  // Toggle event sharing (same as before)
  const toggleEventShare = async (eventId) => {
    try {
      const isCurrentlyShared = sharedEventIds.has(eventId);
      
      if (isCurrentlyShared) {
        await api.delete(`/api/users/shared-events/${eventId}`);
        setSharedEventIds(prev => {
          const updated = new Set(prev);
          updated.delete(eventId);
          return updated;
        });
      } else {
        await api.post(`/api/users/shared-events/${eventId}`);
        setSharedEventIds(prev => new Set([...prev, eventId]));
      }
      
    } catch (error) {
      console.error('Error toggling event share:', error);
      Alert.alert('Error', 'Failed to update event sharing');
    }
  };

  // UPDATED: Profile header matching new UI design
const renderProfileHeader = () => {
  // All accounts are public, so show events count
  const visibleEventsCount = eventsCount;
  
  // Format numbers for display
  const formatNumber = (num) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };
  
  return (
    <View style={styles.profileHeader}>
      {/* Profile Picture and Stats Row */}
      <View style={styles.profileTopRow}>
        <View style={styles.profileImageContainer}>
          <Image
            source={{
              uri: user?.profilePicture
                ? `http://${API_BASE_URL}:3000${user.profilePicture}`
                : 'https://via.placeholder.com/84x84/F6F6F6/999999?text=User'
            }}
            style={styles.profileImage}
          />
          {isSelf && (
            <TouchableOpacity
              style={styles.profilePictureEditButton}
              onPress={() => navigation.navigate('EditProfileScreen')}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Stats Row - Horizontal */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.statItem}
            onPress={() => navigation.navigate('FollowListScreen', { 
              userId, 
              mode: 'followers'
            })}
            activeOpacity={0.7}
          >
            <Text style={styles.statNumber}>{formatNumber(followersCount)}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.statItem}
            onPress={() => navigation.navigate('FollowListScreen', { 
              userId, 
              mode: 'following'
            })}
            activeOpacity={0.7}
          >
            <Text style={styles.statNumber}>{formatNumber(followingCount)}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
          
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{visibleEventsCount}</Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>
        </View>
      </View>

      {/* Username with Verification Badge */}
      <View style={styles.profileInfo}>
        <View style={styles.usernameRow}>
          <Text style={styles.username}>{user?.username || 'User'}</Text>
          {/* Verification badge - can be added based on user verification status */}
        </View>
        
        {/* Bio */}
        {user?.bio && (
          <Text style={styles.bio}>{user.bio}</Text>
        )}
        
        {/* Location and Website */}
        <View style={styles.metaInfo}>
          {user?.hometown && (
            <View style={styles.metaItem}>
              <Ionicons name="location" size={14} color="#4C739A" />
              <Text style={styles.metaText}>{user.hometown}</Text>
            </View>
          )}
          {user?.socialMediaLinks?.website && (
            <View style={styles.metaItem}>
              <Text style={styles.metaSeparator}>•</Text>
              <Ionicons name="link" size={14} color="#4C739A" />
              <Text style={[styles.metaText, styles.metaLink]}>{user.socialMediaLinks.website}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {isSelf ? (
          <View style={styles.selfActionButtons}>
            <TouchableOpacity
              style={styles.editProfileButtonFull}
              onPress={() => navigation.navigate('EditProfileScreen')}
              activeOpacity={0.8}
            >
              <Text style={styles.editProfileButtonText}>Edit Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.qrCodeButton}
              onPress={() => navigation.navigate('QrScreen')}
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code-outline" size={20} color="#2B8CEE" />
            </TouchableOpacity>
          </View>
        ) : (
          renderFollowButton()
        )}
      </View>
    </View>
  );
};
  // Tab bar - Updated to match new design
  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {tabs.map((tab, index) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, activeTabIndex === index && styles.activeTab]}
          onPress={() => handleTabPress(index)}
          activeOpacity={0.8}
        >
          {activeTabIndex === index && <View style={styles.activeTabIndicator} />}
          <Text style={[
            styles.tabText,
            activeTabIndex === index && styles.activeTabText
          ]}>
            {tab}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Event filter bar (same as before)
  const renderEventFilterBar = () => {
  // ✅ UPDATED: Events tab is now index 2
  if (activeTabIndex !== 2 || !isSelf) return null;

  return (
    <View style={styles.eventFilterBar}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.eventFilters}
      >
        {EVENT_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.eventFilterButton,
              eventFilter === filter.key && styles.eventFilterButtonActive
            ]}
            onPress={() => setEventFilter(filter.key)}
            activeOpacity={0.8}
          >
            <Ionicons 
              name={filter.icon} 
              size={16} 
              color={eventFilter === filter.key ? '#FFFFFF' : '#8E8E93'} 
            />
            <Text style={[
              styles.eventFilterText,
              eventFilter === filter.key && styles.eventFilterTextActive
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};


  // Post grid renderer (same as before)

  /*
const renderPostGrid = ({ item }) => (
  <TouchableOpacity
    style={styles.postGridItem}
    onPress={() => navigation.navigate('UnifiedDetailsScreen', { 
  postId: item._id,
  postType: 'post',
  post: {
    ...item,
    user: item.user || {
      _id: currentUser._id,
      username: currentUser.username,
      profilePicture: currentUser.profilePicture
    }
  }
})}
    activeOpacity={0.8}
  >
    <Image
      source={{ uri: `http://${API_BASE_URL}:3000${item.paths[0]}` }}
      style={styles.postGridImage}
    />
  </TouchableOpacity>
);*/

  // Event card renderer (same as before)
  const renderEventCard = ({ item: event }) => {
    const isShared = sharedEventIds.has(event._id);
    const isPast = new Date(event.time) <= new Date();

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('EventDetailsScreen', { eventId: event._id })}
        activeOpacity={0.95}
      >
        <View style={styles.eventCard}>
          <View style={styles.eventCoverContainer}>
            <Image
              source={{
                uri: event.coverImage
                  ? `http://${API_BASE_URL}:3000${event.coverImage}`
                  : 'https://placehold.co/400x200.png?text=Event'
              }}
              style={styles.eventCover}
            />
            
            <View style={styles.eventStatusBadge}>
              <Text style={styles.eventStatusText}>
                {isPast ? 'Past' : 'Upcoming'}
              </Text>
            </View>
          </View>

          <View style={styles.eventInfo}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventDate}>
              {new Date(event.time).toLocaleDateString()} at{' '}
              {new Date(event.time).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
            <Text style={styles.eventLocation}>{event.location}</Text>
            
            {event.description && (
              <Text style={styles.eventDescription} numberOfLines={2}>
                {event.description}
              </Text>
            )}
          </View>

          {isSelf && (
            <View style={styles.eventActions}>
              <TouchableOpacity
                style={[
                  styles.shareToggleButton,
                  isShared && styles.shareToggleButtonActive
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  toggleEventShare(event._id);
                }}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name={isShared ? "eye" : "eye-off"} 
                  size={16} 
                  color={isShared ? '#FFFFFF' : '#8E8E93'} 
                />
                <Text style={[
                  styles.shareToggleText,
                  isShared && styles.shareToggleTextActive
                ]}>
                  {isShared ? 'Shared' : 'Share'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Memory card renderer (same as before)
  const renderMemoryCard = ({ item: memory }) => {
    const getCoverPhotoUrl = () => {
      if (memory.photos && memory.photos.length > 0) {
        const firstPhoto = memory.photos[0];
        if (firstPhoto.url) {
          return firstPhoto.url.startsWith('http') 
            ? firstPhoto.url
            : `http://${API_BASE_URL}:3000${firstPhoto.url}`;
        }
      }
      return 'https://placehold.co/400x160.png?text=Memory';
    };

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('MemoryDetailsScreen', { memoryId: memory._id })}
        activeOpacity={0.95}
      >
        <View style={styles.memoryCard}>
          <View style={styles.memoryCoverContainer}>
            <Image
              source={{ uri: getCoverPhotoUrl() }}
              style={styles.memoryCover}
            />
            
            <View style={styles.memoryBadge}>
              <Ionicons name="library" size={16} color="#FFFFFF" />
            </View>
            
            {memory.photos && memory.photos.length > 1 && (
              <View style={styles.photoCount}>
                <Ionicons name="images" size={12} color="#FFFFFF" />
                <Text style={styles.photoCountText}>{memory.photos.length}</Text>
              </View>
            )}
          </View>

          <View style={styles.memoryInfo}>
            <Text style={styles.memoryTitle}>{memory.title}</Text>
            {memory.description && (
              <Text style={styles.memoryDescription} numberOfLines={2}>
                {memory.description}
              </Text>
            )}
            
            <View style={styles.memoryMetadata}>
              <Text style={styles.memoryDate}>
                {new Date(memory.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ✅ UPDATED: Get content data for current tab (Posts, Photos, Events, Memories)
  const getContentData = () => {
  if (activeTabIndex === 0) { // Posts
    return posts; // All posts (public by default)
  } else if (activeTabIndex === 1) { // Photos
    return posts.filter(post => post.paths && post.paths.length > 0); // Only photo posts
  } else if (activeTabIndex === 2) { // Events
    if (eventsLoading) {
      return 'loading';
    }
    return isSelf ? filteredEvents : events;
  } else if (activeTabIndex === 3) { // Memories
    if (memoriesLoading) {
      return 'loading';
    }
    return memories;
  }
  return [];
};

  // ✅ UPDATED: Render content for each tab (Posts, Photos, Events, Memories)
  const renderTabContent = (tabIndex) => {
  let contentData;
  
  // Tab indices:
  // tabIndex 0 = Posts
  // tabIndex 1 = Photos
  // tabIndex 2 = Events
  // tabIndex 3 = Memories
  
  if (tabIndex === 0) { // Posts
    contentData = posts; // All posts (public by default)
  } else if (tabIndex === 1) { // Photos
    contentData = posts.filter(post => post.paths && post.paths.length > 0);
  } else if (tabIndex === 2) { // Events
    if (eventsLoading) {
      contentData = 'loading';
    } else {
      // All accounts are public, so show events
      contentData = isSelf ? filteredEvents : events;
    }
  } else if (tabIndex === 3) { // Memories
    if (memoriesLoading) {
      contentData = 'loading';
    } else {
      contentData = memories;
    }
  } else {
    contentData = [];
  }

  // Note: All accounts are public, so no privacy checks needed
  // This section removed as it's no longer needed

  if (contentData === 'loading') {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>
          {tabIndex === 0 ? 'Loading posts...' : tabIndex === 1 ? 'Loading photos...' : tabIndex === 2 ? 'Loading events...' : 'Loading memories...'}
        </Text>
      </View>
    );
  }

  if (Array.isArray(contentData) && contentData.length === 0) {
    const tabName = tabs[tabIndex];
    const isEventsTab = tabName === 'Events';
    const isMemoriesTab = tabName === 'Memories';
    const hasFilter = isEventsTab && eventFilter !== 'all';
    
    return (
      <View style={styles.emptyContainer}>
        <Ionicons 
          name={
            isEventsTab ? "calendar-outline" : 
            isMemoriesTab ? "library-outline" : 
            "camera-outline"
          } 
          size={64} 
          color="#C7C7CC" 
        />
        <Text style={styles.emptyTitle}>
          {isEventsTab 
            ? (hasFilter 
                ? `No ${eventFilter} events`
                : (isSelf ? 'No events found' : 'No shared events')
              )
            : isMemoriesTab
              ? (isSelf ? 'No memories yet' : 'No shared memories')
              : (isSelf ? 'Share your first post' : 'No posts yet')
          }
        </Text>
        <Text style={styles.emptySubtitle}>
          {isEventsTab
            ? (hasFilter
                ? `You don't have any ${eventFilter} events yet.`
                : (isSelf 
                    ? 'Join or host events to see them here.'
                    : `You don't have any shared events with ${user?.username}.`
                  )
              )
            : isMemoriesTab
              ? (isSelf 
                  ? 'Create your first memory to preserve special moments'
                  : `You don't have any shared memories with ${user?.username} yet.`
                )
              : (isSelf 
                  ? 'When you share photos, they\'ll appear on your profile.'
                  : `${user?.username} hasn't shared any posts with friends yet.`
                )
          }
        </Text>
        {isSelf && (
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate(
              isEventsTab ? 'CreateEventScreen' : 
              isMemoriesTab ? 'CreateMemoryScreen' : 
              'CreatePickerScreen'
            )}
            activeOpacity={0.8}
          >
            <Text style={styles.createButtonText}>
              {isEventsTab ? 'Create Event' : 
               isMemoriesTab ? 'Create Memory' : 
               'Create Post'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (!Array.isArray(contentData)) {
    return null;
  }

  // ✅ UPDATED: Render the appropriate list based on tab indices (Posts, Photos, Events, Memories)
  if (tabIndex === 0) { // Posts
    if (contentData.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyTitle}>No posts yet</Text>
          <Text style={styles.emptySubtitle}>Posts will appear here</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={contentData}
        renderItem={({ item }) => (
          <PostActivityComponent
            activity={item}
            currentUserId={currentUser?._id}
            navigation={navigation}
          />
        )}
        keyExtractor={(item) => item._id}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    );
  } else if (tabIndex === 1) { // Photos
    if (contentData.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyTitle}>No photos yet</Text>
          <Text style={styles.emptySubtitle}>Photos will appear here</Text>
        </View>
      );
    }
    return (
      <PhotoGrid
        photos={contentData}
        navigation={navigation}
      />
    );
  } else if (tabIndex === 2) { // Events
    return (
      <FlatList
        data={contentData}
        renderItem={renderEventCard}
        keyExtractor={(item) => item._id}
        scrollEnabled={false}
        contentContainerStyle={styles.eventsGrid}
      />
    );
  } else if (tabIndex === 3) { // Memories
    return (
      <FlatList
        data={contentData}
        renderItem={renderMemoryCard}
        keyExtractor={(item) => item._id}
        scrollEnabled={false}
        contentContainerStyle={styles.memoriesGrid}
      />
    );
  }

  return null;
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ScrollView
        style={styles.scrollContainer}
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
      >
        {/* Profile Header */}
        {renderProfileHeader()}
        
        {/* About Section */}
        {user && (
          <AboutSection 
            user={user} 
            isSelf={isSelf}
            onEditPress={(section) => navigation.navigate('EditAboutScreen', { section, userAbout: user.about })}
            navigation={navigation}
          />
        )}
        
        {/* Tab Bar */}
        {renderTabBar()}
        
        {/* Event Filter Bar */}
        {renderEventFilterBar()}
        
        {/* Swipeable Content */}
        <View 
          style={styles.swipeableContainer}
          {...panResponder.panHandlers}
        >
          <Animated.View style={[
            styles.swipeableContent,
            { 
              transform: [{ translateX: scrollX }],
              width: SCREEN_WIDTH * tabs.length
            }
          ]}>
            {tabs.map((tab, index) => (
              <View key={tab} style={styles.tabContentWrapper}>
                {renderTabContent(index)}
              </View>
            ))}
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flex: 1,
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

  // Profile Header - Updated to match new UI design
  profileHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12, // Reduced from 8 to 12 for better spacing
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginBottom: 12,
  },
  profileImageContainer: {
    position: 'relative',
    width: 84,
    height: 84,
  },
  profileImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#E2E8F0',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profilePictureEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2B8CEE',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D141B',
    lineHeight: 20,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4C739A',
  },
  profileInfo: {
    marginBottom: 16,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  username: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0D141B',
    lineHeight: 24,
  },
  bio: {
    fontSize: 14,
    color: '#0D141B',
    lineHeight: 20,
    marginTop: 4,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaSeparator: {
    fontSize: 12,
    color: '#4C739A',
    marginHorizontal: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#4C739A',
  },
  metaLink: {
    fontWeight: '500',
    color: '#0D141B',
  },

  // Action Buttons
  actionButtons: {
    width: '100%',
    marginTop: 12,
    marginBottom: 8, // Reduced from 16 to 8
  },
  selfActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  editProfileButtonFull: {
    flex: 1,
    backgroundColor: '#2B8CEE',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfileButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  qrCodeButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#E7EDF3',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // NEW: Friend Button Styles
  friendButton: {
    width: '100%',
    backgroundColor: '#3797EF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  friendsButton: {
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#34C759',
  },
  requestReceivedButton: {
    backgroundColor: '#FF9500',
  },
  requestSentButton: {
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  friendButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendButtonIcon: {
    marginRight: 6,
  },
  friendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  friendsButtonText: {
    color: '#34C759',
  },
  requestSentButtonText: {
    color: '#8E8E93',
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E7EDF3',
    paddingTop: 0, // Reduced from 4 to 0
    marginTop: 0, // Ensure no top margin
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeTab: {
    // Active indicator handled by activeTabIndicator
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#2B8CEE',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4C739A',
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: '#0D141B',
    fontWeight: '700',
  },

  // Event Filter Bar
  eventFilterBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  eventFilters: {
    paddingHorizontal: 20,
    gap: 12,
  },
  eventFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    gap: 6,
  },
  eventFilterButtonActive: {
    backgroundColor: '#3797EF',
  },
  eventFilterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  eventFilterTextActive: {
    color: '#FFFFFF',
  },

  // Swipeable Content Container
  swipeableContainer: {
    minHeight: 400,
    overflow: 'hidden',
  },
  swipeableContent: {
    flexDirection: 'row',
  },
  tabContentWrapper: {
    width: SCREEN_WIDTH,
    minHeight: 400,
  },

  // Posts Grid
  postsGrid: {
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 20,
  },
  postGridRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  postGridItem: {
    width: (SCREEN_WIDTH - 40) / 2 - 5,
    height: (SCREEN_WIDTH - 40) / 2 - 5,
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F6F6F6',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  postGridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#E1E1E1',
  },

  // Events Grid
  eventsGrid: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  eventCard: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  eventCoverContainer: {
    position: 'relative',
  },
  eventCover: {
    width: '100%',
    height: 160,
    backgroundColor: '#F6F6F6',
  },
  eventStatusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  eventStatusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  eventInfo: {
    padding: 16,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  eventDate: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '600',
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 18,
  },
  eventActions: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  shareToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    alignSelf: 'flex-start',
    gap: 6,
  },
  shareToggleButtonActive: {
    backgroundColor: '#3797EF',
  },
  shareToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  shareToggleTextActive: {
    color: '#FFFFFF',
  },

  // Memories Grid
  memoriesGrid: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  memoryCard: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  memoryCoverContainer: {
    position: 'relative',
  },
  memoryCover: {
    width: '100%',
    height: 160,
    backgroundColor: '#F6F6F6',
  },
  memoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(55, 151, 239, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCount: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  photoCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  memoryInfo: {
    padding: 16,
  },
  memoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  memoryDescription: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 18,
    marginBottom: 12,
  },
  memoryMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memoryDate: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },

  // Empty States
  emptyContainer: {
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
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  mutualFriendsHint: {
    fontSize: 13,
    color: '#3797EF',
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 16,
    textAlign: 'center',
  },
  friendRequestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3797EF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 8,
  },
  friendRequestButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  respondRequestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 8,
  },
  respondRequestButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  friendButtonDisabled: {
    opacity: 0.6,
  },
});