// components/PastEventsTab.js - Personal Past Events View
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Image, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import { API_BASE_URL } from '@env';

const TIME_PERIODS = [
  { key: 'recent', label: 'Last 30 Days', days: 30 },
  { key: 'quarter', label: 'Last 3 Months', days: 90 },
  { key: 'year', label: 'This Year', days: 365 },
  { key: 'all', label: 'All Time', days: null }
];

export default function PastEventsTab({ navigation, userId, isSelf }) {
  const { currentUser } = useContext(AuthContext);
  const [pastEvents, setPastEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('recent');
  const [stats, setStats] = useState({
    totalEvents: 0,
    hostedEvents: 0,
    attendedEvents: 0,
    favoriteCategory: null
  });

  useEffect(() => {
    if (isSelf && currentUser) {
      fetchPastEvents();
    }
  }, [selectedPeriod, isSelf, currentUser]);

  const fetchPastEvents = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const selectedFilter = TIME_PERIODS.find(p => p.key === selectedPeriod);
      let endDate = new Date();
      let startDate = null;

      if (selectedFilter.days) {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - selectedFilter.days);
      }

      const params = {
        endDate: endDate.toISOString(),
        ...(startDate && { startDate: startDate.toISOString() }),
        includeHosted: true,
        includeAttended: true
      };

      const { data } = await api.get('/api/users/past-events', { params });
      
      // Sort events by date (most recent first)
      const sortedEvents = (data.events || []).sort((a, b) => 
        new Date(b.time) - new Date(a.time)
      );
      
      setPastEvents(sortedEvents);
      setStats(data.stats || {
        totalEvents: sortedEvents.length,
        hostedEvents: sortedEvents.filter(e => e.isHost).length,
        attendedEvents: sortedEvents.filter(e => !e.isHost).length,
        favoriteCategory: data.stats?.favoriteCategory || null
      });

    } catch (error) {
      console.error('Error fetching past events:', error);
      Alert.alert('Error', 'Unable to load past events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const renderTimePeriodSelector = () => (
    <View style={styles.periodSelector}>
      <FlatList
        data={TIME_PERIODS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.key}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.periodTab,
              selectedPeriod === item.key && styles.activePeriodTab
            ]}
            onPress={() => setSelectedPeriod(item.key)}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.periodTabText,
              selectedPeriod === item.key && styles.activePeriodTabText
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.periodTabs}
      />
    </View>
  );

  const renderStatsCard = () => (
    <View style={styles.statsCard}>
      <Text style={styles.statsTitle}>Your Event History</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.totalEvents}</Text>
          <Text style={styles.statLabel}>Total Events</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.hostedEvents}</Text>
          <Text style={styles.statLabel}>Hosted</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.attendedEvents}</Text>
          <Text style={styles.statLabel}>Attended</Text>
        </View>
      </View>
      {stats.favoriteCategory && (
        <View style={styles.favoriteCategory}>
          <Ionicons name="star" size={16} color="#FFD700" />
          <Text style={styles.favoriteCategoryText}>
            Most attended: {stats.favoriteCategory}
          </Text>
        </View>
      )}
    </View>
  );

  const renderPastEventItem = ({ item }) => {
    const eventDate = new Date(item.time);
    const isHost = item.isHost;
    const coverImage = item.coverImage 
      ? `http://${API_BASE_URL}:3000${item.coverImage}` 
      : null;

    // Calculate how long ago
    const daysPast = Math.floor((Date.now() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
    let timeAgoText = '';
    if (daysPast < 1) timeAgoText = 'Today';
    else if (daysPast === 1) timeAgoText = 'Yesterday';
    else if (daysPast < 7) timeAgoText = `${daysPast} days ago`;
    else if (daysPast < 30) timeAgoText = `${Math.floor(daysPast / 7)} weeks ago`;
    else if (daysPast < 365) timeAgoText = `${Math.floor(daysPast / 30)} months ago`;
    else timeAgoText = `${Math.floor(daysPast / 365)} years ago`;

    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => navigation.navigate('EventDetailsScreen', { eventId: item._id })}
        activeOpacity={0.9}
      >
        <View style={styles.eventCardContent}>
          {/* Event Image */}
          <View style={styles.eventImageContainer}>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.eventImage} />
            ) : (
              <View style={styles.eventImagePlaceholder}>
                <Ionicons name="calendar-outline" size={24} color="#C7C7CC" />
              </View>
            )}
            {/* Host/Attended Badge */}
            <View style={[
              styles.roleBadge,
              isHost ? styles.hostBadge : styles.attendedBadge
            ]}>
              <Ionicons 
                name={isHost ? "star" : "checkmark"} 
                size={12} 
                color="#FFFFFF" 
              />
            </View>
          </View>

          {/* Event Info */}
          <View style={styles.eventInfo}>
            <Text style={styles.eventTitle} numberOfLines={2}>
              {item.title}
            </Text>
            
            <View style={styles.eventMeta}>
              <View style={styles.eventDateRow}>
                <Ionicons name="calendar-outline" size={14} color="#8E8E93" />
                <Text style={styles.eventDate}>
                  {eventDate.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: eventDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                  })}
                </Text>
                <Text style={styles.timeAgo}>• {timeAgoText}</Text>
              </View>
              
              <View style={styles.eventLocationRow}>
                <Ionicons name="location-outline" size={14} color="#8E8E93" />
                <Text style={styles.eventLocation} numberOfLines={1}>
                  {item.location}
                </Text>
              </View>

              {item.category && (
                <View style={styles.categoryTag}>
                  <Text style={styles.categoryTagText}>{item.category}</Text>
                </View>
              )}
            </View>

            <View style={styles.eventFooter}>
              <Text style={styles.roleText}>
                {isHost ? 'You hosted this event' : 'You attended this event'}
              </Text>
              {item.attendeeCount && (
                <Text style={styles.attendeeCount}>
                  {item.attendeeCount} {item.attendeeCount === 1 ? 'person' : 'people'}
                </Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    const selectedFilter = TIME_PERIODS.find(p => p.key === selectedPeriod);
    
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="calendar-outline" size={64} color="#C7C7CC" />
        </View>
        <Text style={styles.emptyTitle}>No past events</Text>
        <Text style={styles.emptySubtitle}>
          You haven't hosted or attended any events in the {selectedFilter.label.toLowerCase()}.
        </Text>
        <TouchableOpacity
          style={styles.exploreButton}
          onPress={() => navigation.navigate('EventListScreen')}
          activeOpacity={0.8}
        >
          <Text style={styles.exploreButtonText}>Explore Events</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Only show to the user themselves
  if (!isSelf) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading your event history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderTimePeriodSelector()}
      
      <FlatList
        data={pastEvents}
        keyExtractor={item => item._id}
        renderItem={renderPastEventItem}
        ListHeaderComponent={pastEvents.length > 0 ? renderStatsCard : null}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchPastEvents(true)}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContainer,
          pastEvents.length === 0 && styles.emptyListContainer
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },

  // Period Selector
  periodSelector: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  periodTabs: {
    paddingHorizontal: 16,
  },
  periodTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  activePeriodTab: {
    backgroundColor: '#3797EF',
  },
  periodTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  activePeriodTabText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Stats Card
  statsCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3797EF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  favoriteCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  favoriteCategoryText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 8,
    fontWeight: '500',
  },

  // Event Cards
  listContainer: {
    paddingBottom: 20,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  eventCardContent: {
    flexDirection: 'row',
    padding: 16,
  },
  eventImageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  eventImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
  },
  eventImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  hostBadge: {
    backgroundColor: '#FF9500',
  },
  attendedBadge: {
    backgroundColor: '#34C759',
  },

  // Event Info
  eventInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    lineHeight: 20,
    marginBottom: 8,
  },
  eventMeta: {
    flex: 1,
  },
  eventDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 6,
  },
  timeAgo: {
    fontSize: 12,
    color: '#C7C7CC',
    marginLeft: 6,
  },
  eventLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventLocation: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 6,
    flex: 1,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  categoryTagText: {
    fontSize: 12,
    color: '#3797EF',
    fontWeight: '500',
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleText: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  attendeeCount: {
    fontSize: 12,
    color: '#8E8E93',
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  exploreButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  exploreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});