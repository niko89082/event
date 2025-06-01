// screens/ProfileScreen.js - Updated with Proper Event Management
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
  const isSelf = userId === currentUser?._id;

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

      const { data } = await api.get(`/api/profile/${userId}`);
      setUser(data);
      setPosts(data.photos || []);
      setIsFollowing(data.isFollowing || false);
      setHasRequested(data.hasRequested || false);

      // Fetch events when switching to Events tab or if it's already active
      if (activeTab === 'Events') {
        await fetchUserEvents();
      }

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

  const fetchUserEvents = async () => {
    try {
      setEventsLoading(true);

      if (isSelf) {
        // For current user: get ALL events they're involved in
        const [attendingRes, hostedRes, sharedRes] = await Promise.all([
          // Get events user is attending
          api.get(`/api/events`, { 
            params: { 
              attendee: userId, 
              limit: 200,
              includePast: true 
            }
          }).catch(() => ({ data: { events: [] } })),
          
          // Get events user is hosting
          api.get(`/api/events`, { 
            params: { 
              host: userId, 
              limit: 200,
              includePast: true 
            }
          }).catch(() => ({ data: { events: [] } })),
          
          // Get currently shared/featured events
          api.get(`/api/profile/${userId}/shared-events`).catch(() => ({ data: { sharedEvents: [] } }))
        ]);

        const attending = attendingRes.data.events || attendingRes.data || [];
        const hosted = hostedRes.data.events || hostedRes.data || [];
        const shared = sharedRes.data.sharedEvents || [];

        console.log('🟡 Events fetched:', { attending: attending.length, hosted: hosted.length, shared: shared.length });

        // Combine and remove duplicates
        const allEvents = [...hosted, ...attending];
        const uniqueEvents = allEvents.filter((event, index, self) => 
          index === self.findIndex(e => e._id === event._id)
        );

        // Sort by date (upcoming first, then past events in reverse chronological order)
        const now = new Date();
        const upcomingEvents = uniqueEvents.filter(e => new Date(e.time) >= now);
        const pastEvents = uniqueEvents.filter(e => new Date(e.time) < now);
        
        upcomingEvents.sort((a, b) => new Date(a.time) - new Date(b.time));
        pastEvents.sort((a, b) => new Date(b.time) - new Date(a.time));
        
        const sortedEvents = [...upcomingEvents, ...pastEvents];

        // Mark events with additional metadata
        const eventsWithMetadata = sortedEvents.map(event => {
          const isHost = String(event.host?._id || event.host) === String(userId);
          const isAttending = event.attendees?.some(a => String(a._id || a) === String(userId));
          const isPast = new Date(event.time) < now;
          
          return {
            ...event,
            isHost,
            isAttending,
            isPast,
            relationshipType: isHost ? 'host' : 'attendee'
          };
        });

        console.log('🟢 Events processed:', eventsWithMetadata.length);
        setEvents(eventsWithMetadata);
        setSharedEventIds(new Set(shared.map(e => e._id)));

      } else {
        // For other users: only get their shared public events
        const { data } = await api.get(`/api/profile/${userId}/shared-events`);
        const shared = data.sharedEvents || [];
        
        const eventsWithMetadata = shared.map(event => ({
          ...event,
          isHost: String(event.host?._id || event.host) === String(userId),
          isShared: true,
          isPast: new Date(event.time) < new Date()
        }));

        setEvents(eventsWithMetadata);
      }

    } catch (error) {
      console.error('Error fetching events:', error);
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  const applyEventFilter = () => {
    let filtered = [...events];
    const now = new Date();

    switch (eventFilter) {
      case 'upcoming':
        filtered = events.filter(e => new Date(e.time) >= now);
        break;
      case 'past':
        filtered = events.filter(e => new Date(e.time) < now);
        break;
      case 'hosted':
        filtered = events.filter(e => e.isHost);
        break;
      case 'attending':
        filtered = events.filter(e => !e.isHost && e.isAttending);
        break;
      case 'shared':
        filtered = events.filter(e => sharedEventIds.has(e._id));
        break;
      default: // 'all'
        // Keep all events
        break;
    }

    setFilteredEvents(filtered);
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

  const handleTabChange = async (tabName) => {
    setActiveTab(tabName);
    
    // Fetch events when switching to Events tab
    if (tabName === 'Events' && events.length === 0) {
      await fetchUserEvents();
    }
  };

  const toggleEventSharing = async (eventId) => {
    try {
      const currentSharedIds = Array.from(sharedEventIds);
      let newSharedIds;

      if (sharedEventIds.has(eventId)) {
        // Remove from shared
        newSharedIds = currentSharedIds.filter(id => id !== eventId);
        setSharedEventIds(new Set(newSharedIds));
      } else {
        // Add to shared
        newSharedIds = [...currentSharedIds, eventId];
        setSharedEventIds(new Set(newSharedIds));
      }

      // Update on server
      await api.put(`/api/profile/${userId}/shared-events`, { eventIds: newSharedIds });

    } catch (error) {
      console.error('Error toggling event sharing:', error);
      Alert.alert('Error', 'Failed to update event sharing');
      // Revert local state on error
      fetchUserEvents();
    }
  };

  const handleManageSharedEvents = () => {
    setShowManageModal(false);
    navigation.navigate('SelectShareableEventsScreen', { 
      userId,
      currentSharedIds: Array.from(sharedEventIds),
      allEvents: events
    });
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
        onPress={() => handleTabChange('Posts')}
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
        onPress={() => handleTabChange('Events')}
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

  const renderEventFilterBar = () => {
    if (activeTab !== 'Events' || !isSelf) return null;

    const activeFilter = EVENT_FILTERS.find(f => f.key === eventFilter);

    return (
      <View style={styles.eventFilterBar}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.eventFilterContent}
        >
          {EVENT_FILTERS.map(filter => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.eventFilterChip,
                eventFilter === filter.key && styles.eventFilterChipActive
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
                styles.eventFilterChipText,
                eventFilter === filter.key && styles.eventFilterChipTextActive
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {isSelf && (
          <TouchableOpacity
            style={styles.manageEventsButton}
            onPress={() => setShowManageModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={18} color="#3797EF" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderManageModal = () => (
    <Modal
      visible={showManageModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowManageModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Manage Events</Text>
          <TouchableOpacity
            onPress={() => setShowManageModal(false)}
            style={styles.modalClose}
          >
            <Ionicons name="close" size={24} color="#8E8E93" />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          <TouchableOpacity
            style={styles.manageOption}
            onPress={handleManageSharedEvents}
            activeOpacity={0.8}
          >
            <View style={styles.manageOptionIcon}>
              <Ionicons name="eye-outline" size={24} color="#3797EF" />
            </View>
            <View style={styles.manageOptionContent}>
              <Text style={styles.manageOptionTitle}>Manage Shared Events</Text>
              <Text style={styles.manageOptionSubtitle}>
                Choose which events appear publicly on your profile
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manageOption}
            onPress={() => {
              setShowManageModal(false);
              navigation.navigate('CreateEventScreen');
            }}
            activeOpacity={0.8}
          >
            <View style={styles.manageOptionIcon}>
              <Ionicons name="add-circle-outline" size={24} color="#34C759" />
            </View>
            <View style={styles.manageOptionContent}>
              <Text style={styles.manageOptionTitle}>Create New Event</Text>
              <Text style={styles.manageOptionSubtitle}>
                Host a new event for your community
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manageOption}
            onPress={() => {
              setShowManageModal(false);
              navigation.navigate('EventListScreen');
            }}
            activeOpacity={0.8}
          >
            <View style={styles.manageOptionIcon}>
              <Ionicons name="compass-outline" size={24} color="#FF9500" />
            </View>
            <View style={styles.manageOptionContent}>
              <Text style={styles.manageOptionTitle}>Discover Events</Text>
              <Text style={styles.manageOptionSubtitle}>
                Find and join events in your area
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
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

  const renderEventCard = ({ item: event }) => {
    const eventDate = new Date(event.time);
    const isPast = eventDate < new Date();
    const isShared = sharedEventIds.has(event._id);
    const coverImage = event.coverImage 
      ? `http://${API_BASE_URL}:3000${event.coverImage}` 
      : null;

    return (
      <View style={styles.eventCard}>
        <TouchableOpacity
          onPress={() => navigation.navigate('EventDetailsScreen', { eventId: event._id })}
          activeOpacity={0.95}
        >
          <View style={styles.eventImageContainer}>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.eventImage} />
            ) : (
              <View style={styles.eventImagePlaceholder}>
                <Ionicons name="calendar-outline" size={32} color="#C7C7CC" />
              </View>
            )}
            
            {/* Event Status Badges */}
            <View style={styles.eventBadgesContainer}>
              {/* Host/Attending Badge */}
              <View style={[
                styles.eventStatusBadge,
                event.isHost ? styles.hostBadge : styles.attendingBadge
              ]}>
                <Ionicons 
                  name={event.isHost ? "star" : "checkmark"} 
                  size={12} 
                  color="#FFFFFF" 
                />
                <Text style={styles.eventStatusBadgeText}>
                  {event.isHost ? 'Host' : 'Going'}
                </Text>
              </View>

              {/* Past Event Indicator */}
              {isPast && (
                <View style={styles.pastEventBadge}>
                  <Ionicons name="time" size={12} color="#FFFFFF" />
                  <Text style={styles.pastEventBadgeText}>Past</Text>
                </View>
              )}

              {/* Shared Indicator */}
              {isShared && (
                <View style={styles.sharedBadge}>
                  <Ionicons name="eye" size={12} color="#FFFFFF" />
                </View>
              )}
            </View>
          </View>

          <View style={styles.eventContent}>
            <Text style={styles.eventTitle} numberOfLines={2}>
              {event.title}
            </Text>
            
            <View style={styles.eventMeta}>
              <View style={styles.eventMetaRow}>
                <Ionicons name="calendar-outline" size={14} color="#8E8E93" />
                <Text style={styles.eventMetaText}>
                  {eventDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: eventDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                  })}
                  {isPast && ' (Past)'}
                </Text>
              </View>
              
              <View style={styles.eventMetaRow}>
                <Ionicons name="location-outline" size={14} color="#8E8E93" />
                <Text style={styles.eventMetaText} numberOfLines={1}>
                  {event.location}
                </Text>
              </View>

              {event.attendees && event.attendees.length > 0 && (
                <View style={styles.eventMetaRow}>
                  <Ionicons name="people-outline" size={14} color="#8E8E93" />
                  <Text style={styles.eventMetaText}>
                    {event.attendees.length} {event.attendees.length === 1 ? 'person' : 'people'}
                  </Text>
                </View>
              )}

              {/* Event Category */}
              {event.category && (
                <View style={styles.categoryTag}>
                  <Text style={styles.categoryTagText}>{event.category}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* Event Actions (only for self) */}
        {isSelf && (
          <View style={styles.eventActions}>
            <TouchableOpacity
              style={[
                styles.shareToggle,
                isShared && styles.shareToggleActive
              ]}
              onPress={() => toggleEventSharing(event._id)}
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

  // Event Filter Bar
  eventFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  eventFilterContent: {
    paddingHorizontal: 16,
  },
  eventFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  eventFilterChipActive: {
    backgroundColor: '#3797EF',
    borderColor: '#3797EF',
  },
  eventFilterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    marginLeft: 4,
  },
  eventFilterChipTextActive: {
    color: '#FFFFFF',
  },
  manageEventsButton: {
    padding: 12,
    marginRight: 8,
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

  // Events Grid
  eventsGrid: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },

  // Event Cards
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
  },
  eventImageContainer: {
    height: 140,
    position: 'relative',
  },
  eventImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
  },
  eventImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventBadgesContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    gap: 8,
  },
  eventStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  hostBadge: {
    backgroundColor: '#FF9500',
  },
  attendingBadge: {
    backgroundColor: '#34C759',
  },
  eventStatusBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  pastEventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(142, 142, 147, 0.8)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pastEventBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 3,
  },
  sharedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3797EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventContent: {
    padding: 16,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    lineHeight: 20,
    marginBottom: 12,
  },
  eventMeta: {
    marginBottom: 12,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventMetaText: {
    fontSize: 13,
    color: '#8E8E93',
    marginLeft: 8,
    flex: 1,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
  },
  categoryTagText: {
    fontSize: 11,
    color: '#3797EF',
    fontWeight: '600',
  },

  // Event Actions
  eventActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  shareToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  shareToggleActive: {
    backgroundColor: '#3797EF',
    borderColor: '#3797EF',
  },
  shareToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginLeft: 6,
  },
  shareToggleTextActive: {
    color: '#FFFFFF',
  },
  editEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#E1E8F7',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  editEventButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3797EF',
    marginLeft: 4,
  },
  viewEventButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E1E1E1',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Loading Events
  loadingEventsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },

  // Empty States
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 100,
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
    borderRadius: 12,
  },
  createButtonText: {
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

  // Manage Modal
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
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  modalClose: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  manageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  manageOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  manageOptionContent: {
    flex: 1,
  },
  manageOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  manageOptionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
  },
});