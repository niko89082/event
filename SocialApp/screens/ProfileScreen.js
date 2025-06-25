// screens/ProfileScreen.js - FIXED NAVIGATION ISSUE
import React, { useEffect, useState, useContext } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, StatusBar, Dimensions,
  FlatList, RefreshControl, Modal, ScrollView
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

export default function ProfileScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);

  const userId = params?.userId || currentUser?._id;
  // FIXED: Better logic for determining if this is self profile
  const isSelf = !params?.userId || userId === currentUser?._id;

  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [sharedEventIds, setSharedEventIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [activeTab, setActiveTab] = useState('Posts');
  const [eventFilter, setEventFilter] = useState('all');
  const [showEventFilters, setShowEventFilters] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);

  // FIXED: Set up navigation header with proper dependencies
  useEffect(() => {
    console.log('🔧 Setting up navigation header:', { 
      isSelf, 
      userId, 
      currentUserId: currentUser?._id,
      hasParams: !!params?.userId,
      username: user?.username 
    });

    navigation.setOptions({
      title: isSelf ? 'Profile' : user?.username || 'Profile',
      headerShown: true, // FIXED: Always show header
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
      headerRight: () => {
        // FIXED: Always render header buttons for self, regardless of navigation path
        if (isSelf) {
          console.log('🎯 Rendering header buttons for self profile');
          return (
            <View style={styles.headerRightContainer}>
              <TouchableOpacity
                onPress={() => {
                  console.log('🔗 QR button pressed, navigating to QrScreen');
                  navigation.navigate('QrScreen');
                }}
                style={styles.headerButton}
                activeOpacity={0.7}
              >
                <Ionicons name="qr-code-outline" size={24} color="#000000" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  console.log('⚙️ Settings button pressed, navigating to UserSettingsScreen');
                  navigation.navigate('UserSettingsScreen');
                }}
                style={styles.headerButton}
                activeOpacity={0.7}
              >
                <Ionicons name="settings-outline" size={24} color="#000000" />
              </TouchableOpacity>
            </View>
          );
        }
        console.log('❌ Not showing header buttons - not self profile');
        return null;
      },
      headerLeft: () => {
        // Only show back button if we have userId param (came from another profile)
        if (params?.userId) {
          return (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.headerButton}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={26} color="#000000" />
            </TouchableOpacity>
          );
        }
        return null;
      },
    });
  }, [navigation, isSelf, user?.username, params?.userId, currentUser?._id]);

  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 Screen focused, fetching profile for userId:', userId);
      fetchUserProfile();
    }, [userId])
  );

  // Apply event filter whenever events or filter changes
  useEffect(() => {
    applyEventFilter();
  }, [events, eventFilter, sharedEventIds]);

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
        followingCount: data.followingCount 
      });
      
      setUser(data);
      setPosts(data.photos || []);
      setIsFollowing(data.isFollowing || false);
      setHasRequested(data.hasRequested || false);

      // Fetch events when switching to Events tab or if it's already active
      if (activeTab === 'Events') {
        await fetchUserEvents();
      }

    } catch (error) {
      console.error('❌ Error fetching profile:', error);
      if (error.response?.status === 404) {
        Alert.alert('Error', 'User not found');
        navigation.goBack();
      } else if (error.response?.status === 403) {
        Alert.alert('Private Account', 'This account is private.');
      } else if (error.response?.status === 401) {
        Alert.alert('Authentication Error', 'Please log in again.');
      } else {
        Alert.alert('Error', 'Failed to load profile');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUserEvents = async () => {
    try {
      setEventsLoading(true);
      console.log('📅 Fetching events for userId:', userId);
      
      const { data } = await api.get(`/api/users/${userId}/events`);
      console.log('📅 Events received:', data.events?.length || 0);
      setEvents(data.events || []);
      
      // Fetch shared event IDs if viewing self
      if (isSelf) {
        try {
          const sharedResponse = await api.get('/api/users/shared-events');
          setSharedEventIds(new Set(sharedResponse.data.eventIds || []));
          console.log('👁️ Shared events:', sharedResponse.data.eventIds?.length || 0);
        } catch (sharedError) {
          console.error('Error fetching shared events:', sharedError);
        }
      }
      
    } catch (error) {
      console.error('❌ Error fetching events:', error);
      if (error.response?.status !== 404) {
        Alert.alert('Error', 'Failed to load events');
      }
    } finally {
      setEventsLoading(false);
    }
  };

  const applyEventFilter = () => {
    if (!Array.isArray(events)) {
      setFilteredEvents([]);
      return;
    }

    let filtered = [...events];
    const now = new Date();

    switch (eventFilter) {
      case 'upcoming':
        filtered = events.filter(e => new Date(e.time) > now);
        break;
      case 'past':
        filtered = events.filter(e => new Date(e.time) <= now);
        break;
      case 'hosted':
        filtered = events.filter(e => e.isHost);
        break;
      case 'attending':
        filtered = events.filter(e => e.isAttending && !e.isHost);
        break;
      case 'shared':
        filtered = events.filter(e => sharedEventIds.has(e._id));
        break;
      default: // 'all'
        break;
    }

    setFilteredEvents(filtered);
  };

  const handleTabSwitch = async (tab) => {
    setActiveTab(tab);
    if (tab === 'Events' && events.length === 0) {
      await fetchUserEvents();
    }
  };

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

  const renderProfileHeader = () => (
    <View style={styles.profileHeader}>
      <View style={styles.profileImageSection}>
        <Image
          source={{
            uri: user?.profilePicture
              ? `http://${API_BASE_URL}:3000${user.profilePicture}`
              : 'https://placehold.co/88x88.png?text=👤'
          }}
          style={styles.profileImage}
        />
        
        <View style={styles.profileInfo}>
          <Text style={styles.username}>{user?.username}</Text>
          {user?.bio && <Text style={styles.bio}>{user.bio}</Text>}
        </View>
      </View>

      {/* Stats - FIXED: Now shows correct follower counts */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{posts.length}</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => navigation.navigate('FollowListScreen', { 
            userId, type: 'followers' 
          })}
        >
          <Text style={styles.statNumber}>{user?.followersCount || 0}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => navigation.navigate('FollowListScreen', { 
            userId, type: 'following' 
          })}
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
              style={styles.shareEventsButton}
              onPress={() => setShowManageModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={18} color="#3797EF" />
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

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {['Posts', 'Events'].map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, activeTab === tab && styles.activeTab]}
          onPress={() => handleTabSwitch(tab)}
          activeOpacity={0.8}
        >
          <Ionicons 
            name={tab === 'Posts' ? 'grid-outline' : 'calendar-outline'} 
            size={24} 
            color={activeTab === tab ? '#000000' : '#8E8E93'} 
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderEventFilterBar = () => {
    if (activeTab !== 'Events' || !isSelf) return null;

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

  const renderEventCard = ({ item: event }) => {
    const isShared = sharedEventIds.has(event._id);
    const isPast = new Date(event.time) <= new Date();

    return (
      <View style={styles.eventCard}>
        {/* Event Cover */}
        <View style={styles.eventCoverContainer}>
          <Image
            source={{
              uri: event.coverImage
                ? `http://${API_BASE_URL}:3000${event.coverImage}`
                : 'https://placehold.co/400x200.png?text=Event'
            }}
            style={styles.eventCover}
          />
          
          {/* Event Status Badge */}
          <View style={styles.eventStatusBadge}>
            <Text style={styles.eventStatusText}>
              {isPast ? 'Past' : 'Upcoming'}
            </Text>
          </View>
        </View>

        {/* Event Info */}
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

        {/* Event Actions (only for self) */}
        {isSelf && (
          <View style={styles.eventActions}>
            {/* Share Toggle */}
            <TouchableOpacity
              style={[
                styles.shareToggleButton,
                isShared && styles.shareToggleButtonActive
              ]}
              onPress={() => toggleEventShare(event._id)}
              activeOpacity={0.8}
            >
              <Ionicons 
                name={isShared ? "eye" : "eye-off"} 
                size={16} 
                color={isShared ? "#FFFFFF" : "#8E8E93"} 
              />
              <Text style={[
                styles.shareToggleText,
                isShared && styles.shareToggleTextActive
              ]}>
                {isShared ? 'Shared' : 'Share'}
              </Text>
            </TouchableOpacity>

            {/* Edit button for hosted events */}
            {event.isHost && !isPast && (
              <TouchableOpacity
                style={styles.editEventButton}
                onPress={() => navigation.navigate('EditEventScreen', { eventId: event._id })}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={16} color="#3797EF" />
                <Text style={styles.editEventButtonText}>Edit</Text>
              </TouchableOpacity>
            )}

            {/* View Details button */}
            <TouchableOpacity
              style={styles.viewEventButton}
              onPress={() => navigation.navigate('EventDetailsScreen', { eventId: event._id })}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-forward-outline" size={16} color="#8E8E93" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // 🎯 FIX #3: REMOVED NAVIGATION TO MISSING SCREEN
  const renderManageModal = () => (
    <Modal
      visible={showManageModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowManageModal(false)}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Manage Events</Text>
          <View style={styles.modalPlaceholder} />
        </View>
        
        <View style={styles.modalContent}>
          <View style={styles.modalOption}>
            <Ionicons name="eye-outline" size={24} color="#3797EF" />
            <View style={styles.modalOptionContent}>
              <Text style={styles.modalOptionTitle}>Event Sharing</Text>
              <Text style={styles.modalOptionDescription}>
                Use the share toggle on each event card to control which events appear on your profile
              </Text>
            </View>
          </View>
          
          <View style={styles.modalOption}>
            <Ionicons name="calendar-outline" size={24} color="#3797EF" />
            <View style={styles.modalOptionContent}>
              <Text style={styles.modalOptionTitle}>Event Filters</Text>
              <Text style={styles.modalOptionDescription}>
                Switch between All, Upcoming, Past, Hosted, Attending, and Shared events
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setShowManageModal(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.modalCloseButtonText}>Got it!</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  const getContentData = () => {
    if (activeTab === 'Posts') {
      if (!user?.isPublic && !isSelf && !isFollowing) {
        return 'private';
      }
      return posts;
    } else {
      if (eventsLoading) {
        return 'loading';
      }
      return isSelf ? filteredEvents : events;
    }
  };

  const renderContent = () => {
    const contentData = getContentData();

    if (contentData === 'private') {
      return (
        <View style={styles.privateAccountContainer}>
          <Ionicons name="lock-closed-outline" size={64} color="#C7C7CC" />
          <Text style={styles.privateAccountTitle}>This account is private</Text>
          <Text style={styles.privateAccountSubtitle}>
            Follow this account to see their content
          </Text>
        </View>
      );
    }

    if (contentData === 'loading') {
      return (
        <View style={styles.loadingEventsContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      );
    }

    if (Array.isArray(contentData) && contentData.length === 0) {
      const isEventsTab = activeTab === 'Events';
      const hasFilter = isEventsTab && eventFilter !== 'all';
      
      return (
        <View style={styles.emptyContainer}>
          <Ionicons 
            name={isEventsTab ? "calendar-outline" : "camera-outline"} 
            size={64} 
            color="#C7C7CC" 
          />
          <Text style={styles.emptyTitle}>
            {isEventsTab 
              ? (hasFilter 
                  ? `No ${eventFilter} events`
                  : (isSelf ? 'No events found' : 'No shared events')
                )
              : (isSelf ? 'Share your first post' : 'No posts yet')
            }
          </Text>
          <Text style={styles.emptySubtitle}>
            {isEventsTab
              ? (hasFilter
                  ? `You don't have any ${eventFilter} events yet.`
                  : (isSelf 
                      ? 'Join or host events to see them here. You can share events on your profile for others to see.'
                      : 'This user hasn\'t shared any events publicly yet.'
                    )
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
                isEventsTab ? 'CreateEventScreen' : 'CreatePickerScreen'
              )}
              activeOpacity={0.8}
            >
              <Text style={styles.createButtonText}>
                {isEventsTab ? 'Create Event' : 'Create Post'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return contentData;
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

  const contentData = renderContent();
  const isPostsGrid = activeTab === 'Posts' && Array.isArray(contentData);
  const isEventsGrid = activeTab === 'Events' && Array.isArray(contentData);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <FlatList
        data={isPostsGrid ? contentData : (isEventsGrid ? contentData : [])}
        renderItem={isPostsGrid ? renderPostGrid : renderEventCard}
        keyExtractor={(item) => item._id}
        numColumns={isPostsGrid ? 3 : 1}
        key={`${activeTab}-${isPostsGrid ? 3 : 1}`} // Force re-render when switching tabs
        ListHeaderComponent={() => (
          <View>
            {renderProfileHeader()}
            {renderTabBar()}
            {renderEventFilterBar()}
          </View>
        )}
        ListEmptyComponent={() => (
          !Array.isArray(contentData) ? contentData : null
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
          isPostsGrid && contentData.length > 0 ? styles.postsGrid : 
          isEventsGrid ? styles.eventsGrid : {}
        }
        scrollEventThrottle={16}
      />

      {renderManageModal()}
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
  selfActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  editProfileButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 12,
  },
  editProfileButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  shareEventsButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  followButton: {
    flex: 1,
    backgroundColor: '#3797EF',
    paddingVertical: 12,
    borderRadius: 8,
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

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },

  // Event Filter Bar
  eventFilterBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
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

  // Posts Grid
  postsGrid: {
    paddingBottom: 40,
  },
  postGridItem: {
    width: SCREEN_WIDTH / 3,
    height: SCREEN_WIDTH / 3,
    padding: 1,
  },
  postGridImage: {
    flex: 1,
    backgroundColor: '#F6F6F6',
  },

  // Events Grid
  eventsGrid: {
    paddingBottom: 40,
  },
  eventCard: {
    marginHorizontal: 20,
    marginVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E1E1E1',
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
    borderRadius: 6,
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
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    color: '#3797EF',
    fontWeight: '500',
    marginBottom: 2,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  shareToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    gap: 4,
  },
  shareToggleButtonActive: {
    backgroundColor: '#3797EF',
  },
  shareToggleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
  },
  shareToggleTextActive: {
    color: '#FFFFFF',
  },
  editEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    gap: 4,
  },
  editEventButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3797EF',
  },
  viewEventButton: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty States
  privateAccountContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  privateAccountTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  privateAccountSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingEventsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Modal - FIXED: No longer navigates to missing screen
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#3797EF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  modalPlaceholder: {
    width: 50,
  },
  modalContent: {
    flex: 1,
    paddingTop: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  modalOptionContent: {
    flex: 1,
    marginLeft: 16,
  },
  modalOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  modalOptionDescription: {
    fontSize: 14,
    color: '#8E8E93',
  },
  modalCloseButton: {
    backgroundColor: '#3797EF',
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});