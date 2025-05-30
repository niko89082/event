// components/EventsTab.js - Combined Events View for Current User
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import EventCard from './EventCard';

const EVENT_FILTERS = [
  { key: 'all', label: 'All Events', icon: 'calendar-outline' },
  { key: 'upcoming', label: 'Upcoming', icon: 'time-outline' },
  { key: 'hosted', label: 'Hosting', icon: 'star-outline' },
  { key: 'attending', label: 'Attending', icon: 'checkmark-circle-outline' },
  { key: 'shared', label: 'Shared', icon: 'share-outline' }
];

export default function EventsTab({ navigation, userId, isSelf, currentUserId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    upcoming: 0,
    hosted: 0,
    attending: 0,
    shared: 0
  });

  useEffect(() => {
    if (isSelf) {
      fetchUserEvents();
    }
  }, [activeFilter, isSelf]);

  const fetchUserEvents = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      let endpoint = '';
      const now = new Date().toISOString();

      switch (activeFilter) {
        case 'upcoming':
          endpoint = `/api/events?userId=${userId}&upcoming=true`;
          break;
        case 'hosted':
          endpoint = `/api/events?host=${userId}`;
          break;
        case 'attending':
          endpoint = `/api/events?attendee=${userId}`;
          break;
        case 'shared':
          endpoint = `/api/profile/${userId}/shared-events`;
          break;
        default:
          endpoint = `/api/events?userId=${userId}`;
      }

      const { data } = await api.get(endpoint);
      
      let eventsList = [];
      if (activeFilter === 'shared') {
        eventsList = data.sharedEvents || [];
      } else {
        eventsList = data.events || data || [];
      }

      // Add user relationship metadata
      const eventsWithMeta = eventsList.map(event => ({
        ...event,
        userRelation: {
          isHost: String(event.host?._id || event.host) === String(userId),
          isAttending: event.attendees?.includes(userId) || false,
          isShared: event.isShared || false
        }
      }));

      setEvents(eventsWithMeta);
      
      // Calculate stats
      calculateStats(eventsWithMeta);

    } catch (error) {
      console.error('Error fetching events:', error);
      Alert.alert('Error', 'Failed to load events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateStats = (eventsList) => {
    const now = new Date();
    const newStats = {
      total: eventsList.length,
      upcoming: eventsList.filter(e => new Date(e.time) > now).length,
      hosted: eventsList.filter(e => e.userRelation?.isHost).length,
      attending: eventsList.filter(e => e.userRelation?.isAttending && !e.userRelation?.isHost).length,
      shared: eventsList.filter(e => e.userRelation?.isShared).length
    };
    setStats(newStats);
  };

  const handleEventAction = async (event, action) => {
    try {
      switch (action) {
        case 'attend':
          await api.post(`/api/events/attend/${event._id}`);
          break;
        case 'leave':
          await api.delete(`/api/events/attend/${event._id}`);
          break;
        case 'share':
          await toggleEventSharing(event._id, !event.userRelation?.isShared);
          break;
        case 'hide':
          await hideEventFromProfile(event._id);
          break;
      }
      fetchUserEvents(true);
    } catch (error) {
      console.error('Event action error:', error);
      Alert.alert('Error', 'Failed to perform action');
    }
  };

  const toggleEventSharing = async (eventId, shouldShare) => {
    try {
      const { data } = await api.get(`/api/profile/${userId}/shared-events`);
      const currentShared = data.sharedEvents || [];
      const currentIds = currentShared.map(e => e._id);
      
      let newIds;
      if (shouldShare) {
        newIds = [...currentIds, eventId];
      } else {
        newIds = currentIds.filter(id => id !== eventId);
      }
      
      await api.put(`/api/profile/${userId}/shared-events`, { eventIds: newIds });
    } catch (error) {
      throw error;
    }
  };

  const hideEventFromProfile = async (eventId) => {
    try {
      await api.put(`/api/events/${eventId}/visibility`, { showOnProfile: false });
    } catch (error) {
      throw error;
    }
  };

  const renderFilterBar = () => (
    <View style={styles.filterBar}>
      <View style={styles.activeFilterContainer}>
        <View style={styles.activeFilter}>
          <Ionicons 
            name={EVENT_FILTERS.find(f => f.key === activeFilter)?.icon || 'calendar-outline'} 
            size={16} 
            color="#3797EF" 
          />
          <Text style={styles.activeFilterText}>
            {EVENT_FILTERS.find(f => f.key === activeFilter)?.label}
          </Text>
          <Text style={styles.filterCount}>({stats[activeFilter] || stats.total})</Text>
        </View>
      </View>
      
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setShowFilters(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="options-outline" size={20} color="#3797EF" />
      </TouchableOpacity>
    </View>
  );

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
          <Text style={styles.filtersTitle}>Filter Events</Text>
          <TouchableOpacity onPress={() => setShowFilters(false)}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filtersContent}>
          {EVENT_FILTERS.map(filter => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterOption,
                activeFilter === filter.key && styles.selectedFilterOption
              ]}
              onPress={() => {
                setActiveFilter(filter.key);
                setShowFilters(false);
              }}
              activeOpacity={0.8}
            >
              <Ionicons 
                name={filter.icon} 
                size={20} 
                color={activeFilter === filter.key ? '#FFFFFF' : '#8E8E93'} 
              />
              <Text style={[
                styles.filterOptionText,
                activeFilter === filter.key && styles.selectedFilterOptionText
              ]}>
                {filter.label}
              </Text>
              <Text style={[
                styles.filterOptionCount,
                activeFilter === filter.key && styles.selectedFilterOptionText
              ]}>
                {stats[filter.key] || (filter.key === 'all' ? stats.total : 0)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => {
              setShowFilters(false);
              navigation.navigate('CreateEventScreen');
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={24} color="#3797EF" />
            <Text style={styles.quickActionText}>Create Event</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => {
              setShowFilters(false);
              navigation.navigate('SelectShareableEventsScreen', { userId });
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="share-outline" size={24} color="#3797EF" />
            <Text style={styles.quickActionText}>Manage Sharing</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderEventItem = ({ item }) => (
    <View style={styles.eventWrapper}>
      <EventCard
        event={item}
        currentUserId={userId}
        navigation={navigation}
        onAttend={() => handleEventAction(item, 'attend')}
        showActions={true}
      />
      
      {/* Event Management Actions for hosted events */}
      {item.userRelation?.isHost && (
        <View style={styles.eventActions}>
          <TouchableOpacity
            style={styles.eventAction}
            onPress={() => navigation.navigate('EditEventScreen', { eventId: item._id })}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color="#3797EF" />
            <Text style={styles.eventActionText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.eventAction}
            onPress={() => handleEventAction(item, 'share')}
            activeOpacity={0.8}
          >
            <Ionicons 
              name={item.userRelation?.isShared ? "eye" : "eye-off"} 
              size={16} 
              color={item.userRelation?.isShared ? "#34C759" : "#8E8E93"} 
            />
            <Text style={[
              styles.eventActionText,
              item.userRelation?.isShared && styles.eventActionTextActive
            ]}>
              {item.userRelation?.isShared ? 'Shared' : 'Share'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.eventAction}
            onPress={() => navigation.navigate('AttendeeListScreen', { eventId: item._id })}
            activeOpacity={0.8}
          >
            <Ionicons name="people-outline" size={16} color="#3797EF" />
            <Text style={styles.eventActionText}>Attendees</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Actions for attending events */}
      {item.userRelation?.isAttending && !item.userRelation?.isHost && (
        <View style={styles.eventActions}>
          <TouchableOpacity
            style={styles.eventAction}
            onPress={() => handleEventAction(item, 'leave')}
            activeOpacity={0.8}
          >
            <Ionicons name="exit-outline" size={16} color="#FF3B30" />
            <Text style={[styles.eventActionText, { color: '#FF3B30' }]}>Leave</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.eventAction}
            onPress={() => handleEventAction(item, 'share')}
            activeOpacity={0.8}
          >
            <Ionicons 
              name={item.userRelation?.isShared ? "eye" : "eye-off"} 
              size={16} 
              color={item.userRelation?.isShared ? "#34C759" : "#8E8E93"} 
            />
            <Text style={[
              styles.eventActionText,
              item.userRelation?.isShared && styles.eventActionTextActive
            ]}>
              {item.userRelation?.isShared ? 'Shared' : 'Share'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderEmptyState = () => {
    const filter = EVENT_FILTERS.find(f => f.key === activeFilter);
    
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name={filter?.icon || 'calendar-outline'} size={64} color="#C7C7CC" />
        </View>
        <Text style={styles.emptyTitle}>
          {activeFilter === 'hosted' && 'No hosted events'}
          {activeFilter === 'attending' && 'No attending events'}
          {activeFilter === 'upcoming' && 'No upcoming events'}
          {activeFilter === 'shared' && 'No shared events'}
          {activeFilter === 'all' && 'No events yet'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {activeFilter === 'hosted' && 'Events you create will appear here'}
          {activeFilter === 'attending' && 'Events you join will appear here'}
          {activeFilter === 'upcoming' && 'Your future events will appear here'}
          {activeFilter === 'shared' && 'Events you choose to share publicly will appear here'}
          {activeFilter === 'all' && 'Your events and activities will appear here'}
        </Text>
        
        {(activeFilter === 'all' || activeFilter === 'hosted') && (
          <TouchableOpacity
            style={styles.createEventButton}
            onPress={() => navigation.navigate('CreateEventScreen')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.createEventButtonText}>Create Event</Text>
          </TouchableOpacity>
        )}

        {activeFilter === 'shared' && (
          <TouchableOpacity
            style={styles.manageButton}
            onPress={() => navigation.navigate('SelectShareableEventsScreen', { userId })}
            activeOpacity={0.8}
          >
            <Ionicons name="settings" size={20} color="#3797EF" />
            <Text style={styles.manageButtonText}>Manage Sharing</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderFilterBar()}
      
      <FlatList
        data={events}
        keyExtractor={item => item._id}
        renderItem={renderEventItem}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchUserEvents(true)}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContainer,
          events.length === 0 && styles.emptyListContainer
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
  activeFilterContainer: {
    flex: 1,
  },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  activeFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
    marginLeft: 8,
  },
  filterCount: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
  },

  // Events List
  listContainer: {
    paddingBottom: 20,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  eventWrapper: {
    marginBottom: 8,
  },
  eventActions: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: -8,
    marginBottom: 8,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    justifyContent: 'space-around',
  },
  eventAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  eventActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3797EF',
    marginLeft: 6,
  },
  eventActionTextActive: {
    color: '#34C759',
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
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 8,
  },
  selectedFilterOption: {
    backgroundColor: '#3797EF',
  },
  filterOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginLeft: 12,
    flex: 1,
  },
  selectedFilterOptionText: {
    color: '#FFFFFF',
  },
  filterOptionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 0.5,
    borderTopColor: '#E1E1E1',
    justifyContent: 'space-around',
  },
  quickAction: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3797EF',
    marginTop: 8,
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
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  createEventButton: {
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
  createEventButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
  },
  manageButtonText: {
    color: '#3797EF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});