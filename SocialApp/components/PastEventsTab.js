// components/PastEventsTab.js - Enhanced Personal Past Events View
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Image, Alert, Modal
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

const EVENT_TYPES = [
  { key: 'all', label: 'All Events', icon: 'calendar-outline' },
  { key: 'hosted', label: 'Hosted', icon: 'star-outline' },
  { key: 'attended', label: 'Attended', icon: 'checkmark-circle-outline' }
];

export default function PastEventsTab({ navigation, userId, isSelf }) {
  const { currentUser } = useContext(AuthContext);
  const [pastEvents, setPastEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('recent');
  const [selectedType, setSelectedType] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState({
    totalEvents: 0,
    hostedEvents: 0,
    attendedEvents: 0,
    favoriteCategory: null,
    totalHours: 0,
    uniqueLocations: 0
  });

  useEffect(() => {
    if (isSelf && currentUser) {
      fetchPastEvents();
    }
  }, [selectedPeriod, selectedType, isSelf, currentUser]);

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
        includeHosted: selectedType === 'all' || selectedType === 'hosted',
        includeAttended: selectedType === 'all' || selectedType === 'attended'
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
        favoriteCategory: data.stats?.favoriteCategory || null,
        totalHours: data.stats?.totalHours || 0,
        uniqueLocations: data.stats?.uniqueLocations || 0
      });

    } catch (error) {
      console.error('Error fetching past events:', error);
      Alert.alert('Error', 'Unable to load past events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const renderFiltersModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.filtersContainer}>
        <View style={styles.filtersHeader}>
          <TouchableOpacity onPress={() => setShowFilters(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.filtersTitle}>Filter Past Events</Text>
          <TouchableOpacity onPress={() => setShowFilters(false)}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filtersContent}>
          {/* Time Period Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Time Period</Text>
            <View style={styles.filterOptions}>
              {TIME_PERIODS.map(period => (
                <TouchableOpacity
                  key={period.key}
                  style={[
                    styles.filterOption,
                    selectedPeriod === period.key && styles.selectedFilterOption
                  ]}
                  onPress={() => setSelectedPeriod(period.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.filterOptionText,
                    selectedPeriod === period.key && styles.selectedFilterOptionText
                  ]}>
                    {period.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Event Type Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Event Type</Text>
            <View style={styles.filterOptions}>
              {EVENT_TYPES.map(type => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.filterOption,
                    selectedType === type.key && styles.selectedFilterOption
                  ]}
                  onPress={() => setSelectedType(type.key)}
                  activeOpacity={0.8}
                >
                  <Ionicons 
                    name={type.icon} 
                    size={16} 
                    color={selectedType === type.key ? '#FFFFFF' : '#8E8E93'} 
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[
                    styles.filterOptionText,
                    selectedType === type.key && styles.selectedFilterOptionText
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderStatsCard = () => (
    <View style={styles.statsCard}>
      <Text style={styles.statsTitle}>Your Event Journey</Text>
      
      {/* Main Stats Grid */}
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

      {/* Additional Stats */}
      <View style={styles.additionalStats}>
        {stats.totalHours > 0 && (
          <View style={styles.additionalStatItem}>
            <Ionicons name="time-outline" size={16} color="#3797EF" />
            <Text style={styles.additionalStatText}>
              {Math.round(stats.totalHours)} hours of events
            </Text>
          </View>
        )}
        
        {stats.uniqueLocations > 0 && (
          <View style={styles.additionalStatItem}>
            <Ionicons name="location-outline" size={16} color="#3797EF" />
            <Text style={styles.additionalStatText}>
              {stats.uniqueLocations} unique locations
            </Text>
          </View>
        )}
        
        {stats.favoriteCategory && (
          <View style={styles.additionalStatItem}>
            <Ionicons name="star" size={16} color="#FFD700" />
            <Text style={styles.additionalStatText}>
              Most attended: {stats.favoriteCategory}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderFilterBar = () => (
    <View style={styles.filterBar}>
      <View style={styles.activeFilters}>
        <View style={styles.activeFilter}>
          <Text style={styles.activeFilterText}>
            {TIME_PERIODS.find(p => p.key === selectedPeriod)?.label}
          </Text>
        </View>
        <View style={styles.activeFilter}>
          <Text style={styles.activeFilterText}>
            {EVENT_TYPES.find(t => t.key === selectedType)?.label}
          </Text>
        </View>
      </View>
      
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setShowFilters(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="options-outline" size={20} color="#3797EF" />
        <Text style={styles.filterButtonText}>Filter</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPastEventItem = ({ item }) => {
    const eventDate = new Date(item.time);
    const isHost = Boolean(item.isHost);
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

    // Calculate event rating/memories
    const hasPhotos = (item.photoCount || 0) > 0;
    const attendeeCount = item.attendeeCount || 0;

    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => navigation.navigate('EventDetailsScreen', { eventId: item._id })}
        activeOpacity={0.95}
      >
        <View style={styles.eventCardContent}>
          {/* Event Image */}
          <View style={styles.eventImageContainer}>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.eventImage} />
            ) : (
              <View style={styles.eventImagePlaceholder}>
                <Ionicons name="calendar-outline" size={28} color="#C7C7CC" />
              </View>
            )}
            
            {/* Host/Attended Badge */}
            <View style={[
              styles.roleBadge,
              isHost ? styles.hostBadge : styles.attendedBadge
            ]}>
              <Ionicons 
                name={isHost ? "star" : "checkmark"} 
                size={14} 
                color="#FFFFFF" 
              />
            </View>

            {/* Photos Indicator */}
            {hasPhotos && (
              <View style={styles.photosIndicator}>
                <Ionicons name="camera" size={12} color="#FFFFFF" />
                <Text style={styles.photosCount}>{item.photoCount}</Text>
              </View>
            )}
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
                    weekday: 'short',
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
                {isHost ? '🌟 You hosted this event' : '✅ You attended this event'}
              </Text>
              {attendeeCount > 0 && (
                <View style={styles.attendeeInfo}>
                  <Ionicons name="people-outline" size={14} color="#8E8E93" />
                  <Text style={styles.attendeeCount}>
                    {attendeeCount} {attendeeCount === 1 ? 'person' : 'people'}
                  </Text>
                </View>
              )}
            </View>

            {/* Memory Actions */}
            <View style={styles.memoryActions}>
              {hasPhotos && (
                <TouchableOpacity
                  style={styles.memoryAction}
                  onPress={() => navigation.navigate('EventPhotosScreen', { eventId: item._id })}
                  activeOpacity={0.8}
                >
                  <Ionicons name="images-outline" size={16} color="#3797EF" />
                  <Text style={styles.memoryActionText}>View Photos</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={styles.memoryAction}
                onPress={() => handleShareMemory(item)}
                activeOpacity={0.8}
              >
                <Ionicons name="share-outline" size={16} color="#3797EF" />
                <Text style={styles.memoryActionText}>Share Memory</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const handleShareMemory = (event) => {
    const eventDate = new Date(event.time);
    const shareText = `Great memory from ${event.title} on ${eventDate.toLocaleDateString()}! 📸✨`;
    
    navigation.navigate('SelectChatScreen', {
      shareType: 'memory',
      shareId: event._id,
      shareText: shareText
    });
  };

  const renderEmptyState = () => {
    const selectedFilter = TIME_PERIODS.find(p => p.key === selectedPeriod);
    const selectedTypeLabel = EVENT_TYPES.find(t => t.key === selectedType);
    
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="calendar-outline" size={64} color="#C7C7CC" />
          <View style={styles.emptyIconOverlay}>
            <Ionicons name="time-outline" size={24} color="#FFFFFF" />
          </View>
        </View>
        <Text style={styles.emptyTitle}>No past events</Text>
        <Text style={styles.emptySubtitle}>
          You haven't {selectedType === 'hosted' ? 'hosted' : selectedType === 'attended' ? 'attended' : 'participated in'} any events in the {selectedFilter.label.toLowerCase()}.
        </Text>
        <TouchableOpacity
          style={styles.exploreButton}
          onPress={() => navigation.navigate('EventListScreen')}
          activeOpacity={0.8}
        >
          <Ionicons name="compass-outline" size={20} color="#FFFFFF" />
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
        <Text style={styles.loadingText}>Loading your event memories...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderFilterBar()}
      
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

      {renderFiltersModal()}
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

  // Filter Bar
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  activeFilters: {
    flexDirection: 'row',
    flex: 1,
  },
  activeFilter: {
    backgroundColor: '#F0F8FF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3797EF',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F0F8FF',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3797EF',
    marginLeft: 4,
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
  additionalStats: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 8,
  },
  additionalStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  additionalStatText: {
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
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
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
  },
  eventImagePlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
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
  photosIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  photosCount: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
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
    marginBottom: 12,
  },
  roleText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
    marginBottom: 4,
  },
  attendeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendeeCount: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },

  // Memory Actions
  memoryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  memoryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  memoryActionText: {
    fontSize: 12,
    color: '#3797EF',
    fontWeight: '500',
    marginLeft: 4,
  },

  // Filters Modal
  filtersContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  filtersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  cancelText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  filtersTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
  },
  filtersContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  filterSection: {
    marginBottom: 32,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  filterOptions: {
    gap: 8,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectedFilterOption: {
    backgroundColor: '#3797EF',
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  selectedFilterOptionText: {
    color: '#FFFFFF',
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyIconOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3797EF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
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
    marginLeft: 8,
  },
});