// components/UserEventsList.js - User's hosted + attending events
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity, SectionList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import EventCard from './EventCard';

export default function UserEventsList({ navigation, currentUserId }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchUserEvents();
  }, []);

  const fetchUserEvents = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Fetch hosted events
      const hostedResponse = await api.get(`/api/events?host=${currentUserId}&upcoming=true`);
      const hostedEvents = hostedResponse.data.events || hostedResponse.data || [];

      // Fetch attending events (from user profile)
      const userResponse = await api.get(`/api/profile/${currentUserId}`);
      const user = userResponse.data;
      
      // Filter attending events to only upcoming ones
      const attendingEvents = (user.attendingEvents || []).filter(event => {
        return new Date(event.time) > new Date() && String(event.host._id || event.host) !== String(currentUserId);
      });

      // Create sections
      const newSections = [];
      
      if (hostedEvents.length > 0) {
        newSections.push({
          title: 'Hosting',
          data: hostedEvents,
          icon: 'star',
          color: '#FF9500'
        });
      }
      
      if (attendingEvents.length > 0) {
        newSections.push({
          title: 'Attending',
          data: attendingEvents,
          icon: 'checkmark-circle',
          color: '#34C759'
        });
      }

      setSections(newSections);

    } catch (error) {
      console.error('User events fetch error:', error);
      setSections([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAttend = async (event) => {
    try {
      await api.post(`/api/events/attend/${event._id}`);
      fetchUserEvents(true);
    } catch (error) {
      console.error('Attend event error:', error);
    }
  };

  const handleLeaveEvent = async (event) => {
    try {
      await api.delete(`/api/events/attend/${event._id}`);
      fetchUserEvents(true);
    } catch (error) {
      console.error('Leave event error:', error);
    }
  };

  const renderEvent = ({ item, section }) => {
    const isHosting = section.title === 'Hosting';
    
    return (
      <View style={styles.eventWrapper}>
        <EventCard
          event={item}
          currentUserId={currentUserId}
          navigation={navigation}
          onAttend={isHosting ? undefined : handleLeaveEvent}
          compact={false}
        />
        
        {/* Additional actions for user's events */}
        <View style={styles.eventActions}>
          {isHosting ? (
            <>
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
                onPress={() => navigation.navigate('AttendeeListScreen', { eventId: item._id })}
                activeOpacity={0.8}
              >
                <Ionicons name="people-outline" size={16} color="#3797EF" />
                <Text style={styles.eventActionText}>
                  {item.attendees?.length || 0} attending
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.eventAction, styles.leaveAction]}
              onPress={() => handleLeaveEvent(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="exit-outline" size={16} color="#FF3B30" />
              <Text style={[styles.eventActionText, styles.leaveActionText]}>Leave</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderContent}>
        <View style={[styles.sectionIcon, { backgroundColor: section.color }]}>
          <Ionicons name={section.icon} size={16} color="#FFFFFF" />
        </View>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionCount}>({section.data.length})</Text>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="person-outline" size={64} color="#C7C7CC" />
      </View>
      <Text style={styles.emptyTitle}>No upcoming events</Text>
      <Text style={styles.emptySubtitle}>
        Create your first event or join events to see them here
      </Text>
      
      <View style={styles.emptyActions}>
        <TouchableOpacity
          style={styles.primaryEmptyButton}
          onPress={() => navigation.navigate('CreateEventScreen')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.primaryEmptyButtonText}>Create Event</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryEmptyButton}
          onPress={() => navigation.navigate('EventListScreen')}
          activeOpacity={0.8}
        >
          <Ionicons name="search" size={20} color="#3797EF" />
          <Text style={styles.secondaryEmptyButtonText}>Find Events</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActions}>
      <TouchableOpacity
        style={styles.quickAction}
        onPress={() => navigation.navigate('CreateEventScreen')}
        activeOpacity={0.8}
      >
        <View style={styles.quickActionIcon}>
          <Ionicons name="add" size={20} color="#34C759" />
        </View>
        <Text style={styles.quickActionText}>Create Event</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.quickAction}
        onPress={() => navigation.navigate('EventsCalendarScreen')}
        activeOpacity={0.8}
      >
        <View style={styles.quickActionIcon}>
          <Ionicons name="calendar" size={20} color="#3797EF" />
        </View>
        <Text style={styles.quickActionText}>Calendar View</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.quickAction}
        onPress={() => navigation.navigate('EventAnalyticsScreen')}
        activeOpacity={0.8}
      >
        <View style={styles.quickActionIcon}>
          <Ionicons name="analytics" size={20} color="#FF9500" />
        </View>
        <Text style={styles.quickActionText}>Analytics</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading your events...</Text>
      </View>
    );
  }

  if (sections.length === 0) {
    return (
      <View style={styles.container}>
        {renderQuickActions()}
        {renderEmptyState()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderQuickActions()}
      
      <SectionList
        sections={sections}
        keyExtractor={item => item._id}
        renderItem={renderEvent}
        renderSectionHeader={renderSectionHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchUserEvents(true)}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
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

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    textAlign: 'center',
  },

  // Section Header
  sectionHeader: {
    backgroundColor: '#F8F9FA',
    paddingVertical: 12,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sectionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },

  // List
  listContent: {
    paddingBottom: 20,
  },
  eventWrapper: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  eventActions: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#E1E8F7',
  },
  leaveAction: {
    backgroundColor: '#FFF0F0',
    borderColor: '#FFE1E1',
  },
  eventActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3797EF',
    marginLeft: 6,
  },
  leaveActionText: {
    color: '#FF3B30',
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
  emptyActions: {
    gap: 12,
    alignItems: 'center',
  },
  primaryEmptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryEmptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryEmptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
  },
  secondaryEmptyButtonText: {
    color: '#3797EF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});