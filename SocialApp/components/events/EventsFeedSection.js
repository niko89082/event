// components/events/EventsFeedSection.js - Feed section that renders events based on active tab
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import FeedEventCard from './FeedEventCard';
import FriendsActivityFeed from './FriendsActivityFeed';
import HostingEventsView from './HostingEventsView';
import AttendingEventsView from './AttendingEventsView';
import { getMockFeedEvents } from './templates/MockEventData';
import api from '../../services/api';

export default function EventsFeedSection({ 
  navigation, 
  activeTab, 
  currentUserId,
  useMockData = false 
}) {
  // For friends tab, use the new FriendsActivityFeed component
  if (activeTab === 'friends') {
    return (
      <FriendsActivityFeed
        navigation={navigation}
        currentUserId={currentUserId}
        useMockData={useMockData}
      />
    );
  }

  // For hosting tab, use the new HostingEventsView component
  if (activeTab === 'hosting') {
    return (
      <HostingEventsView
        navigation={navigation}
        currentUserId={currentUserId}
        useMockData={useMockData}
      />
    );
  }

  // For attending tab, use the new AttendingEventsView component
  if (activeTab === 'attending') {
    return (
      <AttendingEventsView
        navigation={navigation}
        currentUserId={currentUserId}
        useMockData={useMockData}
      />
    );
  }
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (useMockData) {
      setEvents(getMockFeedEvents());
      setLoading(false);
    } else {
      fetchEvents(1);
    }
  }, [activeTab, useMockData]);

  const fetchEvents = async (pageNum, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (pageNum === 1) {
        setLoading(true);
      }

      let response;
      const limit = 12;
      const skip = (pageNum - 1) * limit;

      switch (activeTab) {
        case 'friends':
          response = await api.get(`/api/events/following-events?page=${pageNum}&limit=${limit}`);
          break;
        case 'for-you':
          response = await api.get(`/api/events/discover?limit=${limit}&skip=${skip}`);
          break;
        case 'attending':
          // Try attending endpoint, fallback to user's attending events
          try {
            response = await api.get(`/api/events/attending?limit=${limit}&skip=${skip}`);
          } catch (error) {
            // Fallback: get user's attending events
            const userResponse = await api.get(`/api/users/${currentUserId}/events?type=attending&limit=${limit}&skip=${skip}`);
            response = { data: { events: userResponse.data.events || [] } };
          }
          break;
        case 'hosting':
          // Try hosting endpoint, fallback to user's hosting events
          try {
            response = await api.get(`/api/events/hosting?limit=${limit}&skip=${skip}`);
          } catch (error) {
            // Fallback: get user's hosting events
            const userResponse = await api.get(`/api/users/${currentUserId}/events?type=hosting&limit=${limit}&skip=${skip}`);
            response = { data: { events: userResponse.data.events || [] } };
          }
          break;
        default:
          response = await api.get(`/api/events/discover?limit=${limit}&skip=${skip}`);
      }

      // Check if response is an error (401, 403, etc.) before using data
      if (response.status >= 400) {
        console.warn(`API returned error status ${response.status} for ${activeTab} events`);
        throw new Error(`API error: ${response.status}`);
      }

      // Ensure we always get an array
      let fetchedEvents = [];
      if (response.data) {
        if (Array.isArray(response.data.events)) {
          fetchedEvents = response.data.events;
        } else if (Array.isArray(response.data)) {
          fetchedEvents = response.data;
        }
      }
      
      // Add friends going count for each event (with error handling)
      const eventsWithFriendsCount = await Promise.all(
        fetchedEvents.map(async (event) => {
          if (!currentUserId || !event.attendees?.length) {
            return { ...event, friendsGoingCount: 0 };
          }

          try {
            const friendsResponse = await api.get('/api/friends/list?status=accepted');
            const friends = friendsResponse.data?.friends || friendsResponse.data || [];
            const friendIds = friends.map(f => f._id || f);
            
            const friendsAttending = event.attendees.filter(attendee => {
              const attendeeId = attendee._id || attendee;
              return friendIds.some(fid => String(fid) === String(attendeeId));
            }).length;

            return { ...event, friendsGoingCount: friendsAttending };
          } catch (error) {
            // Silently fail - don't block event display if friends list fails
            console.warn('Could not fetch friends count for event:', event._id, error.message);
            return { ...event, friendsGoingCount: 0 };
          }
        })
      );

      if (pageNum === 1) {
        setEvents(eventsWithFriendsCount);
      } else {
        setEvents(prev => [...prev, ...eventsWithFriendsCount]);
      }

      setHasMore(fetchedEvents.length === limit);
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching events:', error);
      if (pageNum === 1) {
        setEvents([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    await fetchEvents(1, true);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      fetchEvents(page + 1);
    }
  };

  const renderEvent = ({ item }) => (
    <FeedEventCard
      event={item}
      navigation={navigation}
      currentUserId={currentUserId}
    />
  );

  const renderEmptyState = () => {
    let message = 'No events found';
    let subtitle = 'Check back later for new events';

    switch (activeTab) {
      case 'friends':
        message = 'No Events from Friends';
        subtitle = 'When friends create events, they\'ll appear here.';
        break;
      case 'attending':
        message = 'No Events You\'re Attending';
        subtitle = 'Join events to see them here.';
        break;
      case 'hosting':
        message = 'No Events You\'re Hosting';
        subtitle = 'Create an event to get started.';
        break;
      default:
        message = 'No Events Found';
        subtitle = 'Check back later for new events.';
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>{message}</Text>
        <Text style={styles.emptySubtitle}>{subtitle}</Text>
      </View>
    );
  };


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Feed</Text>
      </View>
      
      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      ) : events.length === 0 ? (
        renderEmptyState()
      ) : (
        <View>
          {events.map((event) => (
            <View key={event._id}>
              {renderEvent({ item: event })}
            </View>
          ))}
          {hasMore && (
            <TouchableOpacity 
              style={styles.loadMoreButton}
              onPress={handleLoadMore}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#3797EF" />
              ) : (
                <Text style={styles.loadMoreText}>Load More</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.2,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  emptyState: {
    paddingVertical: 60,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  loadMoreButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
  },
});

