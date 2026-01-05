// components/events/HostingEventsView.js - Hosting tab with stats, create card, and event list
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FeedEventCard from './FeedEventCard';
import api from '../../services/api';
import { API_BASE_URL } from '@env';

export default function HostingEventsView({
  navigation,
  currentUserId,
  useMockData = false,
}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    eventsCreated: 0,
    totalAttendees: 0,
  });

  useEffect(() => {
    if (useMockData) {
      setStats({ eventsCreated: 4, totalAttendees: 128 });
      setEvents([]);
      setLoading(false);
    } else {
      fetchHostingData();
    }
  }, [currentUserId, useMockData]);

  const fetchHostingData = async () => {
    try {
      setLoading(true);
      
      // Fetch hosting events and stats
      const response = await api.get(`/api/events/hosting?limit=50`);
      const data = response.data;
      
      setEvents(data.events || []);
      setStats({
        eventsCreated: data.stats?.eventsCreated || data.events?.length || 0,
        totalAttendees: data.stats?.totalAttendees || 0,
      });
    } catch (error) {
      console.error('Error fetching hosting data:', error);
      // Fallback: try user events endpoint
      try {
        const userResponse = await api.get(`/api/users/${currentUserId}/events?type=hosted&limit=50&includePast=false`);
        const userEvents = (userResponse.data.events || []).map(event => ({
          ...event,
          hostingType: 'hosted',
          isHost: true,
          isCoHost: false,
        }));
        setEvents(userEvents);
        
        // Calculate stats from events
        const totalAttendees = userEvents.reduce((sum, event) => {
          return sum + (event.attendees?.length || 0);
        }, 0);
        
        setStats({
          eventsCreated: userEvents.length,
          totalAttendees: totalAttendees,
        });
      } catch (fallbackError) {
        console.error('Fallback fetch also failed:', fallbackError);
        setEvents([]);
        setStats({ eventsCreated: 0, totalAttendees: 0 });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHostingData();
  };

  const handleCreateEvent = () => {
    navigation.navigate('CreateEventScreen');
  };

  const handleManageEvent = (event) => {
    navigation.navigate('EventDetailsScreen', { eventId: event._id });
  };

  if (loading && events.length === 0) {
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
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Stats Card */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.eventsCreated}</Text>
          <Text style={styles.statLabel}>EVENTS CREATED</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, styles.statNumberBlue]}>
            {stats.totalAttendees}
          </Text>
          <Text style={styles.statLabel}>TOTAL ATTENDEES</Text>
        </View>
      </View>

      {/* Create New Event Card */}
      <TouchableOpacity
        style={styles.createCard}
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

      {/* Your Hosted Events Section */}
      <View style={styles.eventsSection}>
        <Text style={styles.sectionTitle}>Your Hosted Events</Text>
        
        {events.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No Events Yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first event to get started!
            </Text>
          </View>
        ) : (
          events.map((event) => (
            <HostingEventCard
              key={event._id}
              event={event}
              navigation={navigation}
              currentUserId={currentUserId}
              onManage={handleManageEvent}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

// Hosting-specific event card component
function HostingEventCard({ event, navigation, currentUserId, onManage }) {
  const handlePress = () => {
    navigation.navigate('EventDetailsScreen', { eventId: event._id });
  };

  const handleMorePress = (e) => {
    e.stopPropagation();
    // TODO: Show options menu (edit, delete, etc.)
    console.log('More options for event:', event._id);
  };

  const handleManagePress = (e) => {
    e.stopPropagation();
    if (onManage) {
      onManage(event);
    } else {
      navigation.navigate('EventDetailsScreen', { eventId: event._id });
    }
  };

  // Determine hosting type
  const hostingType = event.hostingType || (event.isHost ? 'hosted' : 'co-hosting');
  const isCoHosting = hostingType === 'co-hosting';

  const coverImage = event.coverImage
    ? `http://${API_BASE_URL}:3000${event.coverImage}`
    : null;

  // Format date
  const eventDate = new Date(event.time);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(
    eventDate.getFullYear(),
    eventDate.getMonth(),
    eventDate.getDate()
  );

  let timeLabel = '';
  let timeColor = '#3797EF';

  if (eventDay.getTime() === today.getTime()) {
    timeLabel = 'TODAY';
    timeColor = '#3797EF';
  } else if (eventDay.getTime() === today.getTime() + 86400000) {
    timeLabel = 'TOMORROW';
    timeColor = '#3797EF';
  } else {
    const daysDiff = Math.floor((eventDay - today) / 86400000);
    if (daysDiff <= 7) {
      // Format: "SAT, NOV 12"
      const weekday = eventDate.toLocaleDateString('en', { weekday: 'short' }).toUpperCase();
      const monthDay = eventDate.toLocaleDateString('en', { month: 'short', day: 'numeric' }).toUpperCase();
      timeLabel = `${weekday}, ${monthDay}`;
      timeColor = '#3797EF';
    } else {
      // Format: "NOV 15"
      timeLabel = eventDate.toLocaleDateString('en', {
        month: 'short',
        day: 'numeric',
      }).toUpperCase();
      timeColor = '#10B981';
    }
  }

  const time = eventDate.toLocaleTimeString('en', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const attendeeCount = event.attendees?.length || 0;

  return (
    <TouchableOpacity
      style={styles.hostingCard}
      onPress={handlePress}
      activeOpacity={0.95}
    >
      {/* Image */}
      <View style={styles.hostingImageContainer}>
        {coverImage ? (
          <Image
            source={{ uri: coverImage }}
            style={styles.hostingImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.hostingImage, styles.placeholderImage]}>
            <Ionicons name="calendar-outline" size={24} color="#C7C7CC" />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.hostingContent}>
        <View style={styles.hostingHeaderRow}>
          <View style={styles.hostingHeaderLeft}>
            <Text style={[styles.hostingTimeLabel, { color: timeColor }]}>
              {timeLabel} • {time}
            </Text>
            {/* Hosting Type Badge */}
            <View style={[styles.hostingBadge, isCoHosting && styles.cohostingBadge, { marginLeft: 8 }]}>
              <Text style={[styles.hostingBadgeText, isCoHosting && styles.cohostingBadgeText]}>
                {isCoHosting ? 'Co-hosting' : 'Hosted'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleMorePress}
            style={styles.moreButton}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

        <Text style={styles.hostingTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.hostingLocation} numberOfLines={1}>
          {event.location || 'Location TBD'}
        </Text>

        {/* Attendees */}
        <View style={styles.hostingAttendees}>
          <Ionicons name="people-outline" size={16} color="#64748B" />
          <Text style={[styles.hostingAttendeesText, { marginLeft: 6 }]}>
            {attendeeCount} attendee{attendeeCount === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      {/* Manage Button */}
      <TouchableOpacity
        style={styles.manageButton}
        onPress={handleManagePress}
        activeOpacity={0.7}
      >
        <Text style={styles.manageButtonText}>Manage</Text>
      </TouchableOpacity>
    </TouchableOpacity>
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
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  statNumberBlue: {
    color: '#3797EF',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  createCard: {
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
  eventsSection: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  hostingCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  hostingImageContainer: {
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 16,
  },
  hostingImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: '#F6F6F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hostingContent: {
    flex: 1,
    justifyContent: 'center',
  },
  hostingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  hostingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  hostingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#E0F2FE',
  },
  hostingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3797EF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cohostingBadge: {
    backgroundColor: '#FEF3C7',
  },
  cohostingBadgeText: {
    color: '#F59E0B',
  },
  hostingTimeLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  moreButton: {
    padding: 4,
  },
  hostingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
    lineHeight: 20,
  },
  hostingLocation: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  hostingAttendees: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostingAttendeesText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  manageButton: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#3797EF',
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

