// components/events/FriendsActivityFeed.js - Friends tab with activity feed design
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@env';
import api from '../../services/api';
import FeedEventCard from './FeedEventCard';

// Mock data generator for preview
const generateMockActivity = () => {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return [
    {
      _id: 'mock1',
      type: 'going',
      users: [
        {
          _id: 'user1',
          username: 'Sophie Miller',
          profilePicture: null,
        }
      ],
      timestamp: twoHoursAgo,
      event: {
        _id: 'event1',
        title: 'Neon Art Gala',
        time: tomorrow.toISOString(),
        location: 'The Broad Museum',
        category: 'Art',
        coverImage: null,
        friendsGoingCount: 3,
        attendees: [
          { _id: 'user1', profilePicture: null },
          { _id: 'user2', profilePicture: null },
        ]
      }
    },
    {
      _id: 'mock2',
      type: 'created',
      users: [
        {
          _id: 'user2',
          username: 'Liam Wilson',
          profilePicture: null,
        }
      ],
      timestamp: fiveHoursAgo,
      event: {
        _id: 'event2',
        title: 'Underground Beats',
        time: nextWeek.toISOString(),
        location: 'Warehouse 42, Arts District',
        category: 'Music',
        coverImage: null,
        friendsGoingCount: 8,
        attendees: [
          { _id: 'user2', profilePicture: null },
          { _id: 'user3', profilePicture: null },
        ]
      }
    },
    {
      _id: 'mock3',
      type: 'interested',
      users: [
        {
          _id: 'user3',
          username: 'Noah',
          profilePicture: null,
        },
        {
          _id: 'user4',
          username: 'Emma',
          profilePicture: null,
        }
      ],
      timestamp: yesterday,
      event: {
        _id: 'event3',
        title: 'Sunset Yoga',
        time: nextWeek.toISOString(),
        location: 'Central Park',
        category: 'Wellness',
        coverImage: null,
        friendsGoingCount: 5,
        attendees: []
      }
    }
  ];
};

// Format timestamp to relative time
const formatTimestamp = (timestamp) => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now - time;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins} minutes ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};


// Get activity text based on type
const getActivityText = (activity) => {
  const { type, users } = activity;
  const userCount = users.length;
  const firstName = users[0]?.username || 'Someone';
  const secondName = userCount > 1 ? users[1]?.username : null;

  switch (type) {
    case 'going':
      if (userCount === 1) {
        return `${firstName} is going to`;
      } else if (userCount === 2) {
        return `${firstName} & ${secondName} are going to`;
      } else {
        return `${firstName} & ${userCount - 1} others are going to`;
      }
    case 'created':
      if (userCount === 1) {
        return `${firstName} created an event`;
      } else if (userCount === 2) {
        return `${firstName} & ${secondName} created an event`;
      } else {
        return `${firstName} & ${userCount - 1} others created an event`;
      }
    case 'interested':
      if (userCount === 1) {
        return `${firstName} is interested in`;
      } else if (userCount === 2) {
        return `${firstName} & ${secondName} are interested in`;
      } else {
        return `${firstName} & ${userCount - 1} others are interested in`;
      }
    default:
      return 'Activity';
  }
};

export default function FriendsActivityFeed({
  navigation,
  currentUserId,
  useMockData = false,
  refreshing: externalRefreshing = false,
  onRefresh: externalOnRefresh,
}) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (useMockData) {
      setActivities(generateMockActivity());
      setLoading(false);
    } else {
      fetchActivities();
    }
  }, [useMockData, currentUserId]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API endpoint when available
      // For now, try to fetch real data, but fallback to mock if unavailable
      try {
        // Try to get friends' events and transform them into activity format
        const response = await api.get('/api/events/following-events?page=1&limit=20');
        const events = response.data.events || [];
        
        if (events.length > 0) {
          // Transform events into activity format
          const activities = events.map((event, index) => {
            const hoursAgo = index * 2 + 1; // Stagger timestamps
            const timestamp = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
            
            return {
              _id: event._id,
              type: 'going', // or 'created' if event.host matches friend
              users: event.host ? [{
                _id: event.host._id || event.host,
                username: event.host.username || event.host.name || 'Friend',
                profilePicture: event.host.profilePicture || null,
              }] : [],
              timestamp: timestamp,
              event: {
                ...event,
                friendsGoingCount: event.friendsGoingCount || 0,
              }
            };
          });
          setActivities(activities);
        } else {
          // No real data, use mock data
          setActivities(generateMockActivity());
        }
      } catch (apiError) {
        console.log('API not available, using mock data:', apiError.message);
        // Fallback to mock data
        setActivities(generateMockActivity());
      }
    } catch (error) {
      console.error('Error fetching friends activity:', error);
      // Fallback to mock data on error
      setActivities(generateMockActivity());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (externalOnRefresh) {
      await externalOnRefresh();
    }
    await fetchActivities();
  };

  const handleCreateEvent = () => {
    navigation.navigate('CreateEventScreen');
  };

  const handleActivityMore = (activity) => {
    // TODO: Show options menu
    console.log('More options for activity:', activity._id);
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading friends' activity...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing || externalRefreshing}
          onRefresh={handleRefresh}
          tintColor="#3797EF"
          colors={["#3797EF"]}
        />
      }
    >
      {/* Create New Event Card */}
      <TouchableOpacity
        style={styles.createEventCard}
        onPress={handleCreateEvent}
        activeOpacity={0.8}
      >
        <View style={styles.createEventIcon}>
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </View>
        <View style={styles.createEventText}>
          <Text style={styles.createEventTitle}>Create New Event</Text>
          <Text style={styles.createEventSubtitle}>
            Host your own party, meetup, or gathering.
          </Text>
        </View>
      </TouchableOpacity>

      {/* Friends' Activity Section */}
      <View style={styles.activitySection}>
        <Text style={styles.activitySectionTitle}>Friends' Activity</Text>

        {activities.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No activity from friends yet</Text>
            <Text style={styles.emptySubtext}>
              When friends create events or RSVP, they'll appear here.
            </Text>
          </View>
        ) : (
          activities.map((activity) => (
            <View key={activity._id} style={styles.activityCard}>
              {/* Activity Header */}
              <View style={styles.activityHeader}>
                <View style={styles.activityHeaderLeft}>
                  {/* Profile Pictures */}
                  <View style={styles.profilePicturesContainer}>
                    {activity.users.slice(0, 2).map((user, index) => (
                      <View
                        key={user._id}
                        style={[
                          styles.profilePicture,
                          index > 0 && styles.profilePictureOverlap
                        ]}
                      >
                        {user.profilePicture ? (
                          <Image
                            source={{ uri: `http://${API_BASE_URL}:3000${user.profilePicture}` }}
                            style={styles.profilePictureImage}
                          />
                        ) : (
                          <View style={styles.profilePicturePlaceholder}>
                            <Ionicons name="person" size={16} color="#8E8E93" />
                          </View>
                        )}
                      </View>
                    ))}
                  </View>

                  {/* Activity Text */}
                  <View style={styles.activityTextContainer}>
                    <Text style={styles.activityText}>
                      {getActivityText(activity)}
                    </Text>
                    <Text style={styles.activityTimestamp}>
                      {formatTimestamp(activity.timestamp)}
                    </Text>
                  </View>
                </View>

                {/* More Options */}
                <TouchableOpacity
                  style={styles.moreButton}
                  onPress={() => handleActivityMore(activity)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color="#8E8E93" />
                </TouchableOpacity>
              </View>

              {/* Event Card - Use FeedEventCard like For You section */}
              <FeedEventCard
                event={activity.event}
                navigation={navigation}
                currentUserId={currentUserId}
              />
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    paddingTop: 8,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8E8E93',
  },
  // Create Event Card
  createEventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  createEventIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3797EF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  createEventText: {
    flex: 1,
  },
  createEventTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  createEventSubtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  // Activity Section
  activitySection: {
    paddingHorizontal: 16,
  },
  activitySectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  // Activity Card
  activityCard: {
    marginBottom: 20,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  activityHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profilePicturesContainer: {
    flexDirection: 'row',
    marginRight: 12,
  },
  profilePicture: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  profilePictureOverlap: {
    marginLeft: -12,
  },
  profilePictureImage: {
    width: '100%',
    height: '100%',
  },
  profilePicturePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  activityTextContainer: {
    flex: 1,
  },
  activityText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  activityTimestamp: {
    fontSize: 13,
    color: '#8E8E93',
  },
  moreButton: {
    padding: 4,
    marginLeft: 8,
  },
});

