// screens/ProfileScreen.js - UPDATED WITH SWIPE TABS + CENTERED HEADER + 2-COLUMN GRID
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
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
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
    const tabs = ['Posts', 'Events'];
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

  // FIXED: Clean PanResponder without debug logging
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2 && !isAnimating.current;
      },
      onStartShouldSetPanResponder: () => {
        return false; // Don't capture on start, wait for movement
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
        
        // Add resistance at boundaries
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
            // Swiping RIGHT -> previous tab
            targetIndex = currentTab - 1;
          } else if (dx < 0 && currentTab < tabs.length - 1) {
            // Swiping LEFT -> next tab
            targetIndex = currentTab + 1;
          }
        }
        
        switchToTab(targetIndex);
      },
      onPanResponderTerminationRequest: (evt, gestureState) => {
        // Be more protective of LTR swipes since they're getting terminated more
        const { dx } = gestureState;
        const isLTRSwipe = dx < 0;
        
        return isLTRSwipe 
          ? Math.abs(dx) < 10  // Very protective of LTR
          : Math.abs(dx) < 25; // Less protective of RTL
      },
      onPanResponderTerminate: (evt, gestureState) => {
        const { dx } = gestureState;
        const isLTRSwipe = dx < 0;
        
        // Enhanced recovery logic: More aggressive for LTR swipes
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

  // Switch to tab function
  const switchToTab = useCallback((index) => {
    const targetIndex = Math.max(0, Math.min(tabs.length - 1, index));
    
    if (isAnimating.current) return;
    
    isAnimating.current = true;
    
    const targetContentOffset = -targetIndex * SCREEN_WIDTH;
    
    // Update state first
    setActiveTabIndex(targetIndex);
    
    // Then animate horizontal movement
    Animated.timing(scrollX, {
      toValue: targetContentOffset,
      duration: ANIMATION_DURATION,
      useNativeDriver: true,
    }).start((finished) => {
      if (finished) {
        isAnimating.current = false;
        // Load data for the new tab if needed
        if (targetIndex === 1 && events.length === 0) {
          fetchUserEvents();
        } else if (targetIndex === 2 && memories.length === 0) {
          fetchUserMemories();
        }
      }
    });
  }, [tabs.length, events.length, memories.length]);

  // Handle tab press
  const handleTabPress = useCallback((index) => {
    switchToTab(index);
  }, [switchToTab]);

  // Fetch user profile data
  const fetchUserProfile = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      console.log('📡 Fetching profile data for userId:', userId);
      const { data } = await api.get(`/api/profile/${userId}`);
      console.log('✅ Profile data received:', { 
        username: data.username, 
        isPublic: data.isPublic,
        followersCount: data.followersCount,
        followingCount: data.followingCount,
        postsCount: data.photos?.length || 0
      });
      
      setUser(data);
      
      // FIXED: Sort posts by creation date (newest first)
      const sortedPosts = (data.photos || []).sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      setPosts(sortedPosts);
      
      setIsFollowing(data.isFollowing || false);
      setHasRequested(data.hasRequested || false);

      // Fetch events if on Events tab
      if (activeTabIndex === 1) {
        await fetchUserEvents();
      }

      // Fetch memories if on Memories tab
      if (activeTabIndex === 2) {
        await fetchUserMemories();
      }

      // Check if we should show memories tab for other users
      if (!isSelf) {
        await checkSharedMemories();
      }

    } catch (error) {
      console.error('❌ Error fetching profile:', error);
      if (error.response?.status === 404) {
        Alert.alert('Error', 'User not found');
        navigation.goBack();
      } else if (error.response?.status === 403) {
        Alert.alert('Private Account', 'This account is private.');
      } else {
        Alert.alert('Error', 'Failed to load profile');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch user events
  const fetchUserEvents = async () => {
  try {
    setEventsLoading(true);
    
    // PHASE 1 FIX: Always include past events
    const { data } = await api.get(`/api/events/user/${userId}?includePast=true&limit=100`);
    
    // Sort events by date (newest first for better UX)
    const sortedEvents = (data.events || []).sort((a, b) => 
      new Date(b.time) - new Date(a.time)
    );
    
    setEvents(sortedEvents);
    
    // Set shared event IDs if available
    if (isSelf && data.sharedEventIds) {
      setSharedEventIds(new Set(data.sharedEventIds));
    }
    
    console.log(`✅ Loaded ${sortedEvents.length} events for user ${userId}`);
    
  } catch (error) {
    console.error('❌ Error fetching events:', error);
    // Show user-friendly error
    Alert.alert('Error', 'Failed to load events. Please try again.');
  } finally {
    setEventsLoading(false);
  }
};

  // Fetch user memories
  const fetchUserMemories = async () => {
    try {
      setMemoriesLoading(true);
      const { data } = await api.get(`/api/memories/user/${userId}`);
      
      // Sort memories by creation date (newest first)
      const sortedMemories = (data.memories || []).sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      
      setMemories(sortedMemories);
    } catch (error) {
      console.error('Error fetching memories:', error);
    } finally {
      setMemoriesLoading(false);
    }
  };

  // Check if memories tab should be shown for other users
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

  // Apply event filters
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
      filtered.sort((a, b) => new Date(a.time) - new Date(b.time)); // Upcoming: earliest first
      break;
    case 'past':
      filtered = events.filter(e => new Date(e.time) <= now);
      filtered.sort((a, b) => new Date(b.time) - new Date(a.time)); // Past: most recent first
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
    default: // 'all'
      // Keep all events, sorted by date (most recent first)
      filtered.sort((a, b) => new Date(b.time) - new Date(a.time));
      break;
  }

  setFilteredEvents(filtered);
  console.log(`📊 Filtered events: ${filtered.length} (filter: ${eventFilter})`);
}, [events, eventFilter, sharedEventIds]);

  // Load profile on mount and when userId changes
  useEffect(() => {
    fetchUserProfile();
  }, [userId]);

  // Handle follow/unfollow
  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await api.delete(`/api/follow/unfollow/${userId}`);
        setIsFollowing(false);
      } else if (hasRequested) {
        await api.delete(`/api/follow/cancel/${userId}`);
        setHasRequested(false);
      } else {
        const response = await api.post(`/api/follow/follow/${userId}`);
        if (response.data.requested) {
          setHasRequested(true);
        } else {
          setIsFollowing(true);
        }
      }
    } catch (error) {
      console.error('Follow error:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  // Toggle event sharing
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

  // UPDATED: Centered profile header
  const renderProfileHeader = () => (
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

      {/* Stats Container - FIXED: Added clickable followers/following */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{posts.length}</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => navigation.navigate('FollowListScreen', { 
            userId, 
            mode: 'followers'
          })}
          activeOpacity={0.7}
        >
          <Text style={styles.statNumber}>{user?.followersCount || 0}</Text>
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
          <Text style={styles.statNumber}>{user?.followingCount || 0}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
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
            
            <TouchableOpacity
              style={styles.shareEventsButton}
              onPress={() => navigation.navigate('UserSettingsScreen')}
              activeOpacity={0.8}
            >
              <Ionicons name="settings-outline" size={20} color="#000000" />
            </TouchableOpacity>
          </View>
        ) : (
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
        )}
      </View>
    </View>
  );

  // UPDATED: Swipeable tab bar
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

  // Event filter bar (only for Events tab)
  const renderEventFilterBar = () => {
    if (activeTabIndex !== 1 || !isSelf) return null;

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

  // UPDATED: 2-column post grid with curved corners
  const renderPostGrid = ({ item }) => (
    <TouchableOpacity
      style={styles.postGridItem}
      onPress={() => navigation.navigate('PostDetailsScreen', { postId: item._id })}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: `http://${API_BASE_URL}:3000${item.paths[0]}` }}
        style={styles.postGridImage}
      />
    </TouchableOpacity>
  );

  // Event card renderer
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

  // Memory card renderer
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

  // Get content data for current tab
  const getContentData = () => {
    if (activeTabIndex === 0) { // Posts
      if (!user?.isPublic && !isSelf && !isFollowing) {
        return 'private';
      }
      return posts;
    } else if (activeTabIndex === 1) { // Events
      if (eventsLoading) {
        return 'loading';
      }
      return isSelf ? filteredEvents : events;
    } else if (activeTabIndex === 2) { // Memories
      if (memoriesLoading) {
        return 'loading';
      }
      return memories;
    }
    return [];
  };

  // Render content for each tab - FIXED: Always render all tabs for smooth swiping
  const renderTabContent = (tabIndex) => {
    // Always get content data regardless of active tab for smooth swiping
    let contentData;
    if (tabIndex === 0) { // Posts
      if (!user?.isPublic && !isSelf && !isFollowing) {
        contentData = 'private';
      } else {
        contentData = posts;
      }
    } else if (tabIndex === 1) { // Events
      if (eventsLoading) {
        contentData = 'loading';
      } else {
        contentData = isSelf ? filteredEvents : events;
      }
    } else if (tabIndex === 2) { // Memories
      if (memoriesLoading) {
        contentData = 'loading';
      } else {
        contentData = memories;
      }
    } else {
      contentData = [];
    }

    if (contentData === 'private') {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="lock-closed-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyTitle}>This account is private</Text>
          <Text style={styles.emptySubtitle}>
            Follow this account to see their content
          </Text>
        </View>
      );
    }

    if (contentData === 'loading') {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>
            {tabIndex === 1 ? 'Loading events...' : 'Loading memories...'}
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
                      : 'This user hasn\'t shared any events publicly yet.'
                    )
                )
              : isMemoriesTab
                ? (isSelf 
                    ? 'Create your first memory to preserve special moments'
                    : 'You don\'t have any shared memories with this person yet'
                  )
                : (isSelf 
                    ? 'When you share photos, they\'ll appear on your profile.'
                    : 'When they share photos, they\'ll appear here.'
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

    // Render the appropriate list based on tab
    if (tabIndex === 0) { // Posts - 2 column grid
      return (
        <FlatList
          data={contentData}
          renderItem={renderPostGrid}
          keyExtractor={(item) => item._id}
          numColumns={2}
          scrollEnabled={false}
          columnWrapperStyle={styles.postGridRow}
          contentContainerStyle={styles.postsGrid}
        />
      );
    } else if (tabIndex === 1) { // Events - card list
      return (
        <FlatList
          data={contentData}
          renderItem={renderEventCard}
          keyExtractor={(item) => item._id}
          scrollEnabled={false}
          contentContainerStyle={styles.eventsGrid}
        />
      );
    } else if (tabIndex === 2) { // Memories - card list
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
        
        {/* Swipeable Content - FIXED: Proper implementation */}
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

  // UPDATED: Centered Profile Header
  profileHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center', // Center everything
  },
  centeredAvatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 100, // INCREASED: Made larger (was 88)
    height: 100,
    borderRadius: 25, // ADJUSTED: Proportional to new size
    backgroundColor: '#F6F6F6',
    borderWidth: 1, // ADDED: Subtle border
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

  // UPDATED: Redesigned Stats Container - Extra spacing between numbers
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
    // ADDED: Subtle shadow for depth
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
    paddingHorizontal: 8, // ADDED: More spacing between stats
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8, // INCREASED: More space between number and label (was 6)
  },
  statLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    textAlign: 'center', // ADDED: Center alignment
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
    gap: 8, // ADDED: Consistent spacing
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
  // ADDED: QR Code button
  qrCodeButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#3797EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  followButton: {
    width: '100%',
    backgroundColor: '#3797EF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
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
    color: '#000000',
  },

  // ENHANCED: Tab Bar with better spacing
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
    paddingVertical: 8,
    paddingTop: 16, // ADDED: Padding between tabs and content above
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

  // Event Filter Bar with padding
  eventFilterBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingBottom: 16, // ADDED: Extra padding before first event
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
    overflow: 'hidden', // FIXED: Prevent content overflow during swipe
  },
  swipeableContent: {
    flexDirection: 'row',
    // Width is now set dynamically in render
  },
  tabContentWrapper: {
    width: SCREEN_WIDTH,
    minHeight: 400,
  },

  // UPDATED: 2-Column Posts Grid with padding
  postsGrid: {
    paddingHorizontal: 10,
    paddingTop: 12, // ADDED: Padding between tabs and first row
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
    borderRadius: 16, // Curved corners
    overflow: 'hidden',
    backgroundColor: '#F6F6F6',
    // Add subtle shadow
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
    borderWidth: 0.5, // ADDED: Very subtle border
    borderColor: '#E1E1E1',
  },

  // Events Grid with padding
  eventsGrid: {
    paddingHorizontal: 20,
    paddingTop: 12, // ADDED: Padding between filter bar and first event
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
});