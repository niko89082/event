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
import { useFriendRequestManager } from '../hooks/useFriendRequestManager';

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
  const friendRequestManager = useFriendRequestManager('ProfileScreen', {
      showSuccessAlerts: true, // Show success alerts for profile actions
      onAcceptSuccess: handleFriendRequestAccepted,
      onRejectSuccess: handleFriendRequestRejected,
      onCancelSuccess: handleFriendRequestCancelled,
      onSendSuccess: handleFriendRequestSent,
      onRefreshRequired: () => fetchUserProfile(true)
    });
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
  // NEW: Friends system state
  const [friendshipStatus, setFriendshipStatus] = useState('not-friends');
  const [friendshipData, setFriendshipData] = useState(null);
  const [mutualFriends, setMutualFriends] = useState([]);
  const [mutualEventsCount, setMutualEventsCount] = useState(0);
  const [friendsCount, setFriendsCount] = useState(0);
  
  const [eventFilter, setEventFilter] = useState('all');
  const [showManageModal, setShowManageModal] = useState(false);
  const [showMemoriesTab, setShowMemoriesTab] = useState(true);

  // NEW: Swipe tab system
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);
  const currentTabIndex = useRef(0);

  // Dynamic tab array based on conditions
const getTabs = () => {
  const tabs = ['Events']; // Removed 'Posts' from array
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
  function handleFriendRequestAccepted(data) {
    console.log('🎉 ProfileScreen: Friend request accepted', data);
    if (data.requesterId === userId) {
      setFriendshipStatus('friends');
      setFriendsCount(prev => prev + 1);
      // Refresh profile to show new content
      fetchUserProfile(true);
    }
  }
 // FIXED: Re-filter posts when friendship status changes
useEffect(() => {
  if (user && !loading) {
    console.log('🔄 === FRIENDSHIP STATUS CHANGE EFFECT ===');
    console.log('🔄 Friendship status changed, re-filtering posts:', friendshipStatus);
    console.log('🔄 User photos available:', user.photos?.length || 0);
    console.log('🔄 isSelf:', isSelf);
    
    let filteredPosts = user.photos || [];
    const shouldShowPosts = isSelf || friendshipStatus === 'friends';
    
    console.log('🔄 shouldShowPosts:', shouldShowPosts);
    
    if (!shouldShowPosts) {
      console.log('🔒 Hiding posts due to friendship status change');
      filteredPosts = [];
    } else {
      console.log('✅ Showing posts due to friendship status change');
    }
    
    const sortedPosts = filteredPosts.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    setPosts(sortedPosts);
    
    console.log('🔄 Posts after effect:', sortedPosts.length);
    console.log('🔄 === END FRIENDSHIP STATUS CHANGE EFFECT ===');
  }
}, [friendshipStatus, user, isSelf, loading]);
  function handleFriendRequestRejected(data) {
    console.log('❌ ProfileScreen: Friend request rejected', data);
    if (data.requesterId === userId) {
      setFriendshipStatus('not-friends');
    }
  }

  function handleFriendRequestCancelled(data) {
    console.log('🚫 ProfileScreen: Friend request cancelled', data);
    if (data.targetUserId === userId) {
      setFriendshipStatus('not-friends');
    }
  }

  function handleFriendRequestSent(data) {
    console.log('📤 ProfileScreen: Friend request sent', data);
    if (data.targetUserId === userId) {
      setFriendshipStatus('request-sent');
    }
  }

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

  // FIXED: Fetch friendship status with correct endpoint
  // FIXED: Fetch friendship status with better debugging
const fetchFriendshipStatus = async () => {
  console.log('🤝 === FETCHING FRIENDSHIP STATUS ===');
  console.log('🤝 userId:', userId);
  console.log('🤝 currentUser._id:', currentUser?._id);
  console.log('🤝 isSelf:', isSelf);
  
  if (isSelf) {
    console.log('🤝 Setting friendship status to self');
    setFriendshipStatus('self');
    return 'self';
  }

  try {
    console.log('🤝 Making API call to /api/friends/status/' + userId);
    const { data } = await api.get(`/api/friends/status/${userId}`);
    console.log('🤝 Friendship status response:', data);
    
    setFriendshipStatus(data.status);
    setFriendshipData(data.friendship);
    
    console.log('🤝 Friendship status set to:', data.status);
    
    // Fetch mutual friends if not friends yet
    if (data.status === 'not-friends') {
      try {
        const mutualRes = await api.get(`/api/friends/mutual/${userId}`);
        setMutualFriends(mutualRes.data.mutualFriends || []);
        console.log('👥 Mutual friends found:', mutualRes.data.mutualFriends?.length || 0);
      } catch (mutualError) {
        console.log('Could not fetch mutual friends:', mutualError);
      }
    }
    
    console.log('🤝 === FRIENDSHIP STATUS FETCH COMPLETE ===');
    return data.status;
  } catch (error) {
    console.error('❌ Error fetching friendship status:', error);
    console.error('❌ Error response:', error.response?.data);
    console.error('❌ Error status:', error.response?.status);
    setFriendshipStatus('not-friends');
    return 'not-friends';
  }
};

  // FIXED: Fetch friends count using correct endpoint
  const fetchFriendsCount = async () => {
  try {
    // For yourself, use /api/friends/list
    if (isSelf) {
      const { data } = await api.get('/api/friends/list?limit=1');
      setFriendsCount(data.total || 0);
    } else {
      // For other users, use /api/friends/:userId
      try {
        const { data } = await api.get(`/api/friends/${userId}?limit=1`);
        setFriendsCount(data.friendsCount || 0);
      } catch (error) {
        // If 403 (permission denied), we can still show the count from the error response
        if (error.response?.status === 403 && error.response?.data?.friendsCount !== undefined) {
          setFriendsCount(error.response.data.friendsCount);
          console.log('Friends list is private, but got count:', error.response.data.friendsCount);
        } else {
          console.log('Could not fetch friends count:', error);
          setFriendsCount(0);
        }
      }
    }
  } catch (error) {
    console.log('Could not fetch friends count:', error);
    setFriendsCount(0);
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
    console.log('📡 Current friendshipStatus before fetch:', friendshipStatus);
    
    // CRITICAL FIX: Fetch friendship status FIRST and WAIT for it to update
    let currentFriendshipStatus = 'not-friends';
    if (!isSelf) {
      console.log('🔒 Fetching friendship status first...');
      try {
        const { data } = await api.get(`/api/friends/status/${userId}`);
        currentFriendshipStatus = data.status;
        setFriendshipStatus(currentFriendshipStatus);
        setFriendshipData(data.friendship);
        console.log('🔒 Friendship status fetched and set:', currentFriendshipStatus);
        
        // Fetch mutual friends if not friends yet
        if (currentFriendshipStatus === 'not-friends' || !isSelf) {
          try {
            const mutualRes = await api.get(`/api/friends/mutual/${userId}`);
            setMutualFriends(mutualRes.data.mutualFriends || []);
            console.log('👥 Mutual friends:', mutualRes.data.mutualFriends?.length || 0);
          } catch (mutualError) {
            console.log('Could not fetch mutual friends:', mutualError);
          }

          // Fetch mutual events count
          try {
            const mutualEventsRes = await api.get(`/api/events/mutual/${userId}`);
            setMutualEventsCount(mutualEventsRes.data.count || 0);
            console.log('🎉 Mutual events:', mutualEventsRes.data.count || 0);
          } catch (mutualEventsError) {
            console.log('Could not fetch mutual events:', mutualEventsError);
          }
        }
      } catch (error) {
        console.error('❌ Error fetching friendship status:', error);
        currentFriendshipStatus = 'not-friends';
        setFriendshipStatus('not-friends');
      }
    } else {
      currentFriendshipStatus = 'self';
      setFriendshipStatus('self');
      console.log('🔒 User is self, setting friendship status to self');
    }
    
    // Now fetch profile data
    console.log('📡 Fetching profile data from /api/profile/' + userId);
    const { data } = await api.get(`/api/profile/${userId}`);
    console.log('✅ Profile data received:', { 
      username: data.username, 
      friendsCount: data.friendsCount,
      postsCount: data.photos?.length || 0,
      canViewContent: data.photos?.length > 0 || 'backend-filtered',
      backendFriendshipStatus: data.friendshipStatus, // Check if backend returns this
      canViewPrivateContent: data.canViewPrivateContent
    });
    
    setUser(data);
    
    // FIXED: Filter posts based on CURRENT friendship status (use local variable)
    let filteredPosts = data.photos || [];
    const shouldShowPosts = isSelf || currentFriendshipStatus === 'friends';
    
    console.log('📸 Post filtering logic:');
    console.log('  - isSelf:', isSelf);
    console.log('  - currentFriendshipStatus:', currentFriendshipStatus);
    console.log('  - shouldShowPosts:', shouldShowPosts);
    console.log('  - rawPhotosFromBackend:', data.photos?.length || 0);
    console.log('  - backendCanViewPrivateContent:', data.canViewPrivateContent);
    
    if (!shouldShowPosts) {
      console.log('🔒 Frontend filter: Hiding posts for non-friend, status:', currentFriendshipStatus);
      filteredPosts = [];
    } else {
      console.log('✅ Frontend filter: Showing posts, status:', currentFriendshipStatus);
    }
    
    const sortedPosts = filteredPosts.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    setPosts(sortedPosts);
    
    console.log('📸 Final posts set:', sortedPosts.length);
    
    // Set friends count from profile data or fetch separately
    if (data.friendsCount !== undefined) {
      setFriendsCount(data.friendsCount);
      console.log('👥 Friends count from profile:', data.friendsCount);
    } else {
      console.log('👥 Fetching friends count separately...');
      await fetchFriendsCount();
    }

    // ALWAYS fetch events to get the count (regardless of active tab)
    await fetchUserEvents();

    // Fetch memories if on Memories tab
    if (activeTabIndex === 1) {
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


useEffect(() => {
  if (activeTabIndex === 0 && !eventsLoading) { // Events tab is now index 0
    console.log('🔄 Re-checking events due to friendship status change:', friendshipStatus);
    
    if (!isSelf && friendshipStatus !== 'friends') {
      console.log('🔒 Clearing events - user is not a friend');
      setEvents([]);
    } else if (friendshipStatus === 'friends' && events.length === 0) {
      console.log('📅 Now friends - fetching events');
      fetchUserEvents();
    }
  }
}, [friendshipStatus, activeTabIndex, isSelf]);

  // FIXED: Fetch user events with better synchronization
const fetchUserEvents = async () => {
  try {
    setEventsLoading(true);
    
    // ENHANCED CHECK: Don't fetch events for non-friends
    if (!isSelf && friendshipStatus !== 'friends') {
      console.log('🔒 Not fetching events - user is not a friend. Status:', friendshipStatus);
      setEvents([]);
      setEventsCount(0); // Reset count for non-friends
      return;
    }
    
    console.log(`📅 Fetching events for userId: ${userId} (isSelf: ${isSelf}, friendship: ${friendshipStatus})`);
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
    
    console.log(`✅ Loaded ${userEvents.length} events for user ${userId} (friendship: ${friendshipStatus})`);
    
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

  // NEW: Handle friend actions
  const handleFriendAction = async () => {
    if (friendRequestManager.isProcessing()) return;

    try {
      switch (friendshipStatus) {
        case 'not-friends':
          await friendRequestManager.sendRequest(userId, 'I would like to add you as a friend.');
          break;
          
        case 'request-sent':
          Alert.alert(
            'Cancel Friend Request',
            `Cancel your friend request to ${user?.username}?`,
            [
              { text: 'Keep Request', style: 'cancel' },
              { 
                text: 'Cancel Request', 
                style: 'destructive',
                onPress: async () => {
                  try {
                    await friendRequestManager.cancelSentRequest(userId);
                  } catch (error) {
                    console.error('Cancel request failed:', error);
                  }
                }
              }
            ]
          );
          break;
          
        case 'request-received':
          Alert.alert(
            'Friend Request',
            `${user?.username} wants to be friends with you`,
            [
              {
                text: 'Decline',
                style: 'cancel',
                onPress: async () => {
                  try {
                    await friendRequestManager.rejectRequest(userId);
                  } catch (error) {
                    console.error('Reject request failed:', error);
                  }
                }
              },
              {
                text: 'Accept',
                onPress: async () => {
                  try {
                    await friendRequestManager.acceptRequest(userId);
                  } catch (error) {
                    console.error('Accept request failed:', error);
                  }
                }
              }
            ]
          );
          break;
          
        case 'friends':
          Alert.alert(
            'Remove Friend',
            `Are you sure you want to remove ${user?.username} from your friends?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await api.delete(`/api/friends/remove/${userId}`);
                    setFriendshipStatus('not-friends');
                    setFriendsCount(prev => Math.max(0, prev - 1));
                    Alert.alert('Success', 'Friend removed');
                    // Refresh to hide private content
                    fetchUserProfile(true);
                  } catch (error) {
                    Alert.alert('Error', 'Failed to remove friend');
                  }
                }
              }
            ]
          );
          break;
      }
    } catch (error) {
      console.error('Friend action error:', error);
      Alert.alert('Error', error.message || 'Failed to perform action');
    }
  };


  const renderFriendButton = () => {
  const isProcessing = friendRequestManager.isProcessing();
  
  return (
    <TouchableOpacity
      style={[
        styles.friendButton,
        friendshipStatus === 'friends' && styles.friendsButton,
        friendshipStatus === 'request-received' && styles.requestReceivedButton,
        friendshipStatus === 'request-sent' && styles.requestSentButton,
        isProcessing && styles.friendButtonDisabled
      ]}
      onPress={handleFriendAction}
      disabled={isProcessing}
      activeOpacity={0.8}
    >
      <View style={styles.friendButtonContent}>
        {isProcessing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons 
              name={
                friendshipStatus === 'friends' ? 'checkmark-circle' :
                friendshipStatus === 'request-received' ? 'mail' :
                friendshipStatus === 'request-sent' ? 'time' :
                'person-add'
              } 
              size={16} 
              color={
                friendshipStatus === 'friends' ? '#34C759' :
                friendshipStatus === 'request-received' ? '#FFFFFF' :
                friendshipStatus === 'request-sent' ? '#8E8E93' :
                '#FFFFFF'
              } 
              style={styles.friendButtonIcon}
            />
            <Text style={[
              styles.friendButtonText,
              friendshipStatus === 'friends' && styles.friendsButtonText,
              friendshipStatus === 'request-sent' && styles.requestSentButtonText
            ]}>
              {friendshipStatus === 'friends' ? 'Unfriend' :
               friendshipStatus === 'request-received' ? 'Respond' :
               friendshipStatus === 'request-sent' ? 'Requested' :
               'Friend'}
            </Text>
          </>
        )}
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

  // UPDATED: Profile header with friends system
const renderProfileHeader = () => {
  // Show events count based on friendship status
  const visibleEventsCount = (!isSelf && friendshipStatus !== 'friends') ? '—' : eventsCount;
  
  return (
    <View style={styles.profileHeader}>
      {/* Centered Avatar */}
      <View style={styles.centeredAvatarSection}>
        <Image
          source={{
            uri: user?.profilePicture
              ? `http://${API_BASE_URL}:3000${user.profilePicture}`
              : 'https://via.placeholder.com/88x88/F6F6F6/999999?text=User'
          }}
          style={styles.profileImage}
        />
      </View>

      {/* Centered Username and Bio */}
      <View style={styles.centeredProfileInfo}>
        <Text style={styles.username}>{user?.username}</Text>
        {user?.bio && (
          <Text style={styles.bio}>{user.bio}</Text>
        )}
      </View>

      {/* Stats Container WITH Events count */}
      <View style={styles.statsContainer}>
        {/* Events Count */}
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{visibleEventsCount}</Text>
          <Text style={styles.statLabel}>Events</Text>
        </View>
        
        {/* Friends Count */}
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => navigation.navigate('FriendsListScreen', { 
            userId, 
            mode: 'friends'
          })}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber}>{friendsCount}</Text>
          <Text style={styles.statLabel}>Friends</Text>
        </TouchableOpacity>
        
        {/* Show mutual friends or events - whichever is greater */}
        {!isSelf && (mutualFriends.length > 0 || mutualEventsCount > 0) && (
          <TouchableOpacity
            style={styles.statItem}
            onPress={() => {
              if (mutualFriends.length >= mutualEventsCount) {
                navigation.navigate('FriendsListScreen', { 
                  userId, 
                  mode: 'mutual'
                });
              }
            }}
            activeOpacity={mutualFriends.length >= mutualEventsCount ? 0.7 : 1}
            disabled={mutualFriends.length < mutualEventsCount}
          >
            <Text style={styles.statNumber}>
              {mutualFriends.length >= mutualEventsCount ? mutualFriends.length : mutualEventsCount}
            </Text>
            <Text style={styles.statLabel}>
              {mutualFriends.length >= mutualEventsCount ? 'Mutual' : 'Events'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Action Buttons with Friends System */}
      <View style={styles.actionButtons}>
        {isSelf ? (
          <View style={styles.selfActionButtons}>
            <TouchableOpacity
              style={styles.editProfileButton}
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
              <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            
            {/* Temporarily removed settings screen
            <TouchableOpacity
              style={styles.shareEventsButton}
              onPress={() => navigation.navigate('UserSettingsScreen')}
              activeOpacity={0.8}
            >
              <Ionicons name="settings-outline" size={20} color="#000000" />
            </TouchableOpacity>
            */}
          </View>
        ) : (
          renderFriendButton()
        )}
      </View>
    </View>
  );
};
  // Tab bar (same as before)
  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {tabs.map((tab, index) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, activeTabIndex === index && styles.activeTab]}
          onPress={() => handleTabPress(index)}
          activeOpacity={0.8}
        >
          <Ionicons 
            name={
              tab === 'Posts' ? 'grid-outline' : 
              tab === 'Events' ? 'calendar-outline' : 
              'library-outline'
            } 
            size={24} 
            color={activeTabIndex === index ? '#3797EF' : '#8E8E93'} 
          />
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
  // FIXED: Change activeTabIndex !== 1 to activeTabIndex !== 0 since Events is now index 0
  if (activeTabIndex !== 0 || !isSelf) return null;

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

  // Get content data for current tab (UPDATED for friends system)
  const getContentData = () => {
  if (activeTabIndex === 0) { // Posts
    return posts; // Backend already filtered these
  } else if (activeTabIndex === 1) { // Events
    if (eventsLoading) {
      return 'loading';
    }
    return isSelf ? filteredEvents : events; // Backend already filtered
  } else if (activeTabIndex === 2) { // Memories
    if (memoriesLoading) {
      return 'loading';
    }
    return memories; // Backend already filtered
  }
  return [];
};

  // Render content for each tab
  const renderTabContent = (tabIndex) => {
  let contentData;
  
  // Since Posts tab is removed, tab indices shift:
  // tabIndex 0 = Events (was previously 1)
  // tabIndex 1 = Memories (was previously 2)
  
  if (tabIndex === 0) { // Events (was previously index 1)
    if (eventsLoading) {
      contentData = 'loading';
    } else if (!isSelf && friendshipStatus !== 'friends') {
      contentData = 'private';
    } else {
      contentData = isSelf ? filteredEvents : events;
    }
  } else if (tabIndex === 1) { // Memories (was previously index 2)
    if (memoriesLoading) {
      contentData = 'loading';
    } else {
      contentData = memories;
    }
  } else {
    contentData = [];
  }

  // Show privacy message for non-friends
  if (contentData === 'private') {
    const tabName = tabs[tabIndex];
    
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="lock-closed-outline" size={64} color="#C7C7CC" />
        <Text style={styles.emptyTitle}>
          You are not friends with {user?.username}
        </Text>
        <Text style={styles.emptySubtitle}>
          {friendshipStatus === 'request-sent' 
            ? `Your friend request is pending. Once accepted, you'll be able to see their ${tabName.toLowerCase()}.`
            : friendshipStatus === 'request-received'
            ? `Accept their friend request to see their ${tabName.toLowerCase()}.`
            : `Become friends with ${user?.username} to see their ${tabName.toLowerCase()}.`
          }
        </Text>
        
        {/* Show mutual friends hint if available */}
        {friendshipStatus === 'not-friends' && mutualFriends.length > 0 && (
          <Text style={styles.mutualFriendsHint}>
            You have {mutualFriends.length} mutual friend{mutualFriends.length > 1 ? 's' : ''}
          </Text>
        )}
        
        {/* Friend action buttons */}
        {friendshipStatus === 'not-friends' && (
          <TouchableOpacity
            style={styles.friendRequestButton}
            onPress={handleFriendAction}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.friendRequestButtonText}>Send Friend Request</Text>
          </TouchableOpacity>
        )}
        
        {friendshipStatus === 'request-received' && (
          <TouchableOpacity
            style={styles.respondRequestButton}
            onPress={handleFriendAction}
            activeOpacity={0.8}
          >
            <Ionicons name="mail" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.respondRequestButtonText}>Respond to Request</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (contentData === 'loading') {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>
          {tabIndex === 0 ? 'Loading events...' : 'Loading memories...'}
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

  // Render the appropriate list based on NEW tab indices
  if (tabIndex === 0) { // Events
    return (
      <FlatList
        data={contentData}
        renderItem={renderEventCard}
        keyExtractor={(item) => item._id}
        scrollEnabled={false}
        contentContainerStyle={styles.eventsGrid}
      />
    );
  } else if (tabIndex === 1) { // Memories
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

  // Profile Header (same as before)
  profileHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  centeredAvatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F6F6F6',
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  centeredProfileInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  username: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 6,
    textAlign: 'center',
  },
  bio: {
    fontSize: 15,
    color: '#8E8E93',
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },

  // Stats Container
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 30,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    width: '90%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 3,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Action Buttons
  actionButtons: {
    width: '100%',
    alignItems: 'center',
  },
  selfActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  editProfileButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  editProfileButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  shareEventsButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrCodeButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#3797EF',
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
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
    paddingVertical: 8,
    paddingTop: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 4,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3797EF',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
  },
  activeTabText: {
    color: '#3797EF',
    fontWeight: '600',
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