// components/events/AttendingEventsView.js - Attending tab with Upcoming and Past sections
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import FeedEventCard from './FeedEventCard';
import api from '../../services/api';

export default function AttendingEventsView({
  navigation,
  currentUserId,
  useMockData = false,
}) {
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (useMockData) {
      setAllEvents([]);
      setLoading(false);
    } else {
      fetchAttendingData();
    }
  }, [currentUserId, useMockData]);

  const fetchAttendingData = async () => {
    try {
      setLoading(true);
      
      // Fetch attending events (both upcoming and past)
      let response;
      try {
        response = await api.get(`/api/events/attending?limit=100`);
      } catch (error) {
        // Fallback: get user's attending events from profile
        const userResponse = await api.get(`/api/profile/${currentUserId}`);
        const user = userResponse.data;
        const attendingEvents = user.attendingEvents || [];
        
        // Filter out events where user is host or cohost
        const filteredEvents = attendingEvents.filter(event => {
          const isHost = String(event.host?._id || event.host) === String(currentUserId);
          const isCohost = event.coHosts?.some(cohost => 
            String(cohost._id || cohost) === String(currentUserId)
          );
          return !isHost && !isCohost;
        });
        
        response = { data: { events: filteredEvents } };
      }
      
      const events = response.data.events || response.data || [];
      
      // Add friends going count for each event
      const eventsWithFriendsCount = await Promise.all(
        events.map(async (event) => {
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
      
      setAllEvents(eventsWithFriendsCount);
    } catch (error) {
      console.error('Error fetching attending data:', error);
      setAllEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAttendingData();
  };

  // Split events into upcoming and past
  const now = new Date();
  const upcomingEvents = allEvents
    .filter(event => new Date(event.time) > now)
    .sort((a, b) => new Date(a.time) - new Date(b.time));
  
  const pastEvents = allEvents
    .filter(event => new Date(event.time) <= now)
    .sort((a, b) => new Date(b.time) - new Date(a.time));

  if (loading && allEvents.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading your events...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Upcoming Events Section */}
      {upcomingEvents.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          {upcomingEvents.map((event) => (
            <FeedEventCard
              key={event._id}
              event={event}
              navigation={navigation}
              currentUserId={currentUserId}
            />
          ))}
        </View>
      )}

      {/* Past Events Section */}
      {pastEvents.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Past</Text>
          {pastEvents.map((event) => (
            <FeedEventCard
              key={event._id}
              event={event}
              navigation={navigation}
              currentUserId={currentUserId}
            />
          ))}
        </View>
      )}

      {/* Empty State */}
      {upcomingEvents.length === 0 && pastEvents.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Events You're Attending</Text>
          <Text style={styles.emptySubtitle}>
            Join events to see them here.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  section: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
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
});

