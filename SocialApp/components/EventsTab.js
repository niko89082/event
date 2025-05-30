// components/EventsTab.js - Updated for Current User (Shared + Past Events)
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import EventCard from './EventCard';
import PastEventsTab from './PastEventsTab'; // Import the existing past events component

const EVENT_SECTIONS = [
  { key: 'shared', label: 'Shared Events', icon: 'share-outline' },
  { key: 'past', label: 'Past Events', icon: 'time-outline' }
];

export default function EventsTab({ navigation, userId, isSelf, currentUserId }) {
  const [activeSection, setActiveSection] = useState('shared');
  const [sharedEvents, setSharedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);

  useEffect(() => {
    if (isSelf && activeSection === 'shared') {
      fetchSharedEvents();
    }
  }, [activeSection, isSelf]);

  const fetchSharedEvents = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Get user's shared events
      const { data } = await api.get(`/api/profile/${userId}/shared-events`);
      const shared = data.sharedEvents || [];

      // Get user's upcoming hosted events (with visibility controls)
      const upcomingResponse = await api.get(`/api/events?host=${userId}&upcoming=true`);
      const upcomingHosted = upcomingResponse.data.events || upcomingResponse.data || [];

      // Combine shared events + upcoming hosted events
      // Remove duplicates (in case hosted event is also shared)
      const sharedIds = new Set(shared.map(e => e._id));
      const uniqueUpcoming = upcomingHosted.filter(e => !sharedIds.has(e._id));

      // Mark events as shared or hosted
      const markedShared = shared.map(event => ({
        ...event,
        isSharedEvent: true,
        isHostedEvent: String(event.host?._id || event.host) === String(userId)
      }));

      const markedHosted = uniqueUpcoming.map(event => ({
        ...event,
        isSharedEvent: false,
        isHostedEvent: true,
        canHide: true // Show hide option for hosted events
      }));

      const allEvents = [...markedShared, ...markedHosted].sort(
        (a, b) => new Date(a.time) - new Date(b.time)
      );

      setSharedEvents(allEvents);

    } catch (error) {
      console.error('Error fetching events:', error);
      Alert.alert('Error', 'Failed to load events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleEventAction = async (event, action) => {
    try {
      switch (action) {
        case 'share':
          await toggleEventSharing(event._id, !event.isSharedEvent);
          break;
        case 'hide':
          await hideEventFromProfile(event._id);
          break;
        case 'edit':
          navigation.navigate('EditEventScreen', { eventId: event._id });
          return;
        case 'attendees':
          navigation.navigate('AttendeeListScreen', { eventId: event._id });
          return;
      }
      
      // Refresh the list after action
      fetchSharedEvents(true);
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
      // This would require a new API endpoint to hide events from profile
      await api.put(`/api/events/${eventId}/profile-visibility`, { showOnProfile: false });
    } catch (error) {
      throw error;
    }
  };

  const renderSectionTabs = () => (
    <View style={styles.sectionTabs}>
      {EVENT_SECTIONS.map(section => (
        <TouchableOpacity
          key={section.key}
          style={[
            styles.sectionTab,
            activeSection === section.key && styles.activeSectionTab
          ]}
          onPress={() => setActiveSection(section.key)}
          activeOpacity={0.8}
        >
          <Ionicons 
            name={section.icon} 
            size={18} 
            color={activeSection === section.key ? '#FFFFFF' : '#8E8E93'} 
          />
          <Text style={[
            styles.sectionTabText,
            activeSection === section.key && styles.activeSectionTabText
          ]}>
            {section.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderManageButton = () => (
    <View style={styles.manageContainer}>
      <TouchableOpacity
        style={styles.manageButton}
        onPress={() => setShowManageModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="settings-outline" size={18} color="#3797EF" />
        <Text style={styles.manageButtonText}>Manage Events</Text>
      </TouchableOpacity>
    </View>
  );

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
            onPress={() => {
              setShowManageModal(false);
              navigation.navigate('SelectShareableEventsScreen', { userId });
            }}
            activeOpacity={0.8}
          >
            <View style={styles.manageOptionIcon}>
              <Ionicons name="share-outline" size={24} color="#3797EF" />
            </View>
            <View style={styles.manageOptionContent}>
              <Text style={styles.manageOptionTitle}>Share Events</Text>
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
              navigation.navigate('EventVisibilitySettings', { userId });
            }}
            activeOpacity={0.8}
          >
            <View style={styles.manageOptionIcon}>
              <Ionicons name="eye-outline" size={24} color="#FF9500" />
            </View>
            <View style={styles.manageOptionContent}>
              <Text style={styles.manageOptionTitle}>Event Visibility</Text>
              <Text style={styles.manageOptionSubtitle}>
                Control how your hosted events appear to others
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
        </ScrollView>
      </View>
    </Modal>
  );

  const renderSharedEventItem = ({ item }) => (
    <View style={styles.eventWrapper}>
      <EventCard
        event={item}
        currentUserId={currentUserId}
        navigation={navigation}
        onAttend={() => {}} // No attend action needed for own events
        showActions={false}
      />
      
      {/* Event Management Actions */}
      <View style={styles.eventActions}>
        {/* Share/Unshare Toggle */}
        <TouchableOpacity
          style={[
            styles.eventAction,
            item.isSharedEvent && styles.eventActionActive
          ]}
          onPress={() => handleEventAction(item, 'share')}
          activeOpacity={0.8}
        >
          <Ionicons 
            name={item.isSharedEvent ? "eye" : "eye-off"} 
            size={16} 
            color={item.isSharedEvent ? "#34C759" : "#8E8E93"} 
          />
          <Text style={[
            styles.eventActionText,
            item.isSharedEvent && styles.eventActionTextActive
          ]}>
            {item.isSharedEvent ? 'Shared' : 'Share'}
          </Text>
        </TouchableOpacity>

        {/* Edit (for hosted events) */}
        {item.isHostedEvent && (
          <TouchableOpacity
            style={styles.eventAction}
            onPress={() => handleEventAction(item, 'edit')}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color="#3797EF" />
            <Text style={styles.eventActionText}>Edit</Text>
          </TouchableOpacity>
        )}

        {/* Attendees (for hosted events) */}
        {item.isHostedEvent && (
          <TouchableOpacity
            style={styles.eventAction}
            onPress={() => handleEventAction(item, 'attendees')}
            activeOpacity={0.8}
          >
            <Ionicons name="people-outline" size={16} color="#3797EF" />
            <Text style={styles.eventActionText}>
              {item.attendees?.length || 0}
            </Text>
          </TouchableOpacity>
        )}

        {/* Hide (for hosted events that aren't shared) */}
        {item.canHide && !item.isSharedEvent && (
          <TouchableOpacity
            style={styles.eventAction}
            onPress={() => handleEventAction(item, 'hide')}
            activeOpacity={0.8}
          >
            <Ionicons name="eye-off-outline" size={16} color="#FF3B30" />
            <Text style={[styles.eventActionText, { color: '#FF3B30' }]}>Hide</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderSharedEventsContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      );
    }

    if (sharedEvents.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="share-outline" size={64} color="#C7C7CC" />
          </View>
          <Text style={styles.emptyTitle}>No shared events</Text>
          <Text style={styles.emptySubtitle}>
            Choose which events to display publicly on your profile, or create your first event.
          </Text>
          
          <View style={styles.emptyActions}>
            <TouchableOpacity
              style={styles.primaryEmptyButton}
              onPress={() => navigation.navigate('SelectShareableEventsScreen', { userId })}
              activeOpacity={0.8}
            >
              <Ionicons name="share" size={20} color="#FFFFFF" />
              <Text style={styles.primaryEmptyButtonText}>Share Events</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryEmptyButton}
              onPress={() => navigation.navigate('CreateEventScreen')}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color="#3797EF" />
              <Text style={styles.secondaryEmptyButtonText}>Create Event</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <FlatList
        data={sharedEvents}
        keyExtractor={item => item._id}
        renderItem={renderSharedEventItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchSharedEvents(true)}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />
    );
  };

  if (!isSelf) {
    return null; // This component is only for the current user
  }

  return (
    <View style={styles.container}>
      {renderSectionTabs()}
      {renderManageButton()}
      
      {activeSection === 'shared' ? (
        renderSharedEventsContent()
      ) : (
        // Use the existing PastEventsTab component
        <PastEventsTab 
          navigation={navigation} 
          userId={userId} 
          isSelf={isSelf} 
        />
      )}

      {renderManageModal()}
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

  // Section Tabs
  sectionTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  activeSectionTab: {
    backgroundColor: '#3797EF',
  },
  sectionTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginLeft: 8,
  },
  activeSectionTabText: {
    color: '#FFFFFF',
  },

  // Manage Button
  manageContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E1E8F7',
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
    marginLeft: 8,
  },

  // Events List
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  eventWrapper: {
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
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E1E1E1',
  },
  eventActionActive: {
    backgroundColor: '#F0F9F0',
    borderColor: '#34C759',
  },
  eventActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    marginLeft: 6,
  },
  eventActionTextActive: {
    color: '#34C759',
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