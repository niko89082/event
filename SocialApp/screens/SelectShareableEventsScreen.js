// screens/SelectShareableEventsScreen.js - Manage Event Sharing
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, StatusBar, Image,
  RefreshControl, Modal, ScrollView
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import { API_BASE_URL } from '@env';

const EVENT_CATEGORIES = [
  { key: 'all', label: 'All Events', icon: 'calendar-outline' },
  { key: 'upcoming', label: 'Upcoming', icon: 'arrow-up-circle-outline' },
  { key: 'past', label: 'Past', icon: 'time-outline' },
  { key: 'hosted', label: 'Hosted', icon: 'star-outline' },
  { key: 'attending', label: 'Attending', icon: 'checkmark-circle-outline' }
];

export default function SelectShareableEventsScreen() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { currentUser } = useContext(AuthContext);

  const userId = params?.userId || currentUser?._id;
  const initialSharedIds = params?.currentSharedIds || [];
  const initialEvents = params?.allEvents || [];

  const [events, setEvents] = useState(initialEvents);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [sharedEventIds, setSharedEventIds] = useState(new Set(initialSharedIds));
  const [loading, setLoading] = useState(!initialEvents.length);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showPreview, setShowPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: 'Manage Shared Events',
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
      headerLeft: () => (
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <View style={styles.headerRightContainer}>
          <TouchableOpacity
            onPress={() => setShowPreview(true)}
            style={styles.headerButton}
            activeOpacity={0.7}
          >
            <Ionicons name="eye-outline" size={22} color="#3797EF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.headerButton, (!hasChanges || saving) && styles.disabledButton]}
            activeOpacity={0.7}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#3797EF" />
            ) : (
              <Text style={[styles.headerButtonText, styles.saveButtonText]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, hasChanges, saving]);

  useEffect(() => {
    if (!initialEvents.length) {
      fetchEvents();
    } else {
      applyFilter();
    }
  }, []);

  useEffect(() => {
    applyFilter();
  }, [events, selectedCategory]);

  useEffect(() => {
    // Check if there are changes
    const originalIds = new Set(initialSharedIds);
    const currentIds = sharedEventIds;
    
    const hasChanges = originalIds.size !== currentIds.size || 
                      [...originalIds].some(id => !currentIds.has(id)) ||
                      [...currentIds].some(id => !originalIds.has(id));
    
    setHasChanges(hasChanges);
  }, [sharedEventIds, initialSharedIds]);

  const fetchEvents = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Get all user's events (hosted and attending)
      const [hostedRes, attendingRes, sharedRes] = await Promise.all([
        api.get(`/api/events`, { 
          params: { 
            host: userId, 
            limit: 200,
            includePast: true 
          }
        }).catch(() => ({ data: { events: [] } })),
        
        api.get(`/api/events`, { 
          params: { 
            attendee: userId, 
            limit: 200,
            includePast: true 
          }
        }).catch(() => ({ data: { events: [] } })),
        
        api.get(`/api/profile/${userId}/shared-events`).catch(() => ({ data: { sharedEvents: [] } }))
      ]);

      const hosted = hostedRes.data.events || hostedRes.data || [];
      const attending = attendingRes.data.events || attendingRes.data || [];
      const shared = sharedRes.data.sharedEvents || [];

      // Combine and remove duplicates
      const allEvents = [...hosted, ...attending];
      const uniqueEvents = allEvents.filter((event, index, self) => 
        index === self.findIndex(e => e._id === event._id)
      );

      // Sort by date (upcoming first, then past events)
      const now = new Date();
      const upcomingEvents = uniqueEvents.filter(e => new Date(e.time) >= now);
      const pastEvents = uniqueEvents.filter(e => new Date(e.time) < now);
      
      upcomingEvents.sort((a, b) => new Date(a.time) - new Date(b.time));
      pastEvents.sort((a, b) => new Date(b.time) - new Date(a.time));
      
      const sortedEvents = [...upcomingEvents, ...pastEvents];

      // Add metadata
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

      setEvents(eventsWithMetadata);
      setSharedEventIds(new Set(shared.map(e => e._id)));

    } catch (error) {
      console.error('Error fetching events:', error);
      Alert.alert('Error', 'Failed to load events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilter = () => {
    let filtered = [...events];
    const now = new Date();

    switch (selectedCategory) {
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
      default: // 'all'
        // Keep all events
        break;
    }

    setFilteredEvents(filtered);
  };

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to leave?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const eventIds = Array.from(sharedEventIds);
      await api.put(`/api/profile/${userId}/shared-events`, { eventIds });
      
      Alert.alert('Success', 'Your shared events have been updated!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
      
    } catch (error) {
      console.error('Error saving shared events:', error);
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEventSharing = (eventId) => {
    const newSharedIds = new Set(sharedEventIds);
    
    if (newSharedIds.has(eventId)) {
      newSharedIds.delete(eventId);
    } else {
      newSharedIds.add(eventId);
    }
    
    setSharedEventIds(newSharedIds);
  };

  const selectAll = () => {
    const allEventIds = new Set(filteredEvents.map(e => e._id));
    setSharedEventIds(new Set([...sharedEventIds, ...allEventIds]));
  };

  const deselectAll = () => {
    const filteredEventIds = new Set(filteredEvents.map(e => e._id));
    const newSharedIds = new Set([...sharedEventIds].filter(id => !filteredEventIds.has(id)));
    setSharedEventIds(newSharedIds);
  };

  const renderCategoryFilter = () => (
    <View style={styles.categoryFilter}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryFilterContent}
      >
        {EVENT_CATEGORIES.map(category => (
          <TouchableOpacity
            key={category.key}
            style={[
              styles.categoryChip,
              selectedCategory === category.key && styles.categoryChipActive
            ]}
            onPress={() => setSelectedCategory(category.key)}
            activeOpacity={0.8}
          >
            <Ionicons 
              name={category.icon} 
              size={16} 
              color={selectedCategory === category.key ? '#FFFFFF' : '#8E8E93'} 
            />
            <Text style={[
              styles.categoryChipText,
              selectedCategory === category.key && styles.categoryChipTextActive
            ]}>
              {category.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderBulkActions = () => {
    const filteredSharedCount = filteredEvents.filter(e => sharedEventIds.has(e._id)).length;
    const allFiltered = filteredSharedCount === filteredEvents.length && filteredEvents.length > 0;

    return (
      <View style={styles.bulkActions}>
        <View style={styles.bulkActionsLeft}>
          <Text style={styles.selectionCount}>
            {sharedEventIds.size} of {events.length} events shared
          </Text>
          {filteredEvents.length > 0 && (
            <Text style={styles.filteredCount}>
              ({filteredSharedCount} of {filteredEvents.length} in current filter)
            </Text>
          )}
        </View>

        <View style={styles.bulkActionsRight}>
          <TouchableOpacity
            style={styles.bulkActionButton}
            onPress={allFiltered ? deselectAll : selectAll}
            activeOpacity={0.8}
          >
            <Text style={styles.bulkActionButtonText}>
              {allFiltered ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEventItem = ({ item: event }) => {
    const eventDate = new Date(event.time);
    const isPast = eventDate < new Date();
    const isShared = sharedEventIds.has(event._id);
    const coverImage = event.coverImage 
      ? `http://${API_BASE_URL}:3000${event.coverImage}` 
      : null;

    return (
      <TouchableOpacity
        style={styles.eventItem}
        onPress={() => toggleEventSharing(event._id)}
        activeOpacity={0.9}
      >
        <View style={styles.eventImageContainer}>
          {coverImage ? (
            <Image source={{ uri: coverImage }} style={styles.eventImage} />
          ) : (
            <View style={styles.eventImagePlaceholder}>
              <Ionicons name="calendar-outline" size={24} color="#C7C7CC" />
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
                size={10} 
                color="#FFFFFF" 
              />
            </View>

            {/* Past Event Indicator */}
            {isPast && (
              <View style={styles.pastEventBadge}>
                <Ionicons name="time" size={10} color="#FFFFFF" />
              </View>
            )}
          </View>

          {/* Selection Indicator */}
          <View style={[
            styles.selectionIndicator,
            isShared && styles.selectionIndicatorActive
          ]}>
            <Ionicons 
              name={isShared ? "checkmark-circle" : "ellipse-outline"} 
              size={24} 
              color={isShared ? "#34C759" : "#FFFFFF"} 
            />
          </View>
        </View>

        <View style={styles.eventContent}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {event.title}
          </Text>
          
          <View style={styles.eventMeta}>
            <View style={styles.eventMetaRow}>
              <Ionicons name="calendar-outline" size={12} color="#8E8E93" />
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
              <Ionicons name="location-outline" size={12} color="#8E8E93" />
              <Text style={styles.eventMetaText} numberOfLines={1}>
                {event.location}
              </Text>
            </View>

            <View style={styles.eventMetaRow}>
              <Ionicons name="people-outline" size={12} color="#8E8E93" />
              <Text style={styles.eventMetaText}>
                {event.relationshipType === 'host' ? 'Hosting' : 'Attending'} • {event.attendees?.length || 0} people
              </Text>
            </View>
          </View>

          {/* Sharing Status */}
          <View style={styles.sharingStatus}>
            <Text style={[
              styles.sharingStatusText,
              isShared && styles.sharingStatusTextActive
            ]}>
              {isShared ? 'Shared on Profile' : 'Private'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPreviewModal = () => {
    const sharedEvents = events.filter(e => sharedEventIds.has(e._id));
    
    return (
      <Modal
        visible={showPreview}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPreview(false)}
      >
        <SafeAreaView style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>Profile Preview</Text>
            <TouchableOpacity
              onPress={() => setShowPreview(false)}
              style={styles.previewClose}
            >
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.previewContent}>
            <Text style={styles.previewSubtitle}>
              These {sharedEvents.length} events will be visible on your profile:
            </Text>
            
            {sharedEvents.length === 0 ? (
              <View style={styles.previewEmpty}>
                <Ionicons name="eye-off-outline" size={64} color="#C7C7CC" />
                <Text style={styles.previewEmptyTitle}>No Events Shared</Text>
                <Text style={styles.previewEmptySubtitle}>
                  Select events to share them publicly on your profile
                </Text>
              </View>
            ) : (
              <View style={styles.previewEvents}>
                {sharedEvents.map(event => (
                  <View key={event._id} style={styles.previewEventItem}>
                    <View style={styles.previewEventImageContainer}>
                      {event.coverImage ? (
                        <Image 
                          source={{ uri: `http://${API_BASE_URL}:3000${event.coverImage}` }} 
                          style={styles.previewEventImage} 
                        />
                      ) : (
                        <View style={styles.previewEventImagePlaceholder}>
                          <Ionicons name="calendar-outline" size={20} color="#C7C7CC" />
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.previewEventContent}>
                      <Text style={styles.previewEventTitle} numberOfLines={1}>
                        {event.title}
                      </Text>
                      <Text style={styles.previewEventMeta}>
                        {new Date(event.time).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })} • {event.isHost ? 'Hosting' : 'Attending'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  const renderEmptyState = () => {
    const activeCategory = EVENT_CATEGORIES.find(c => c.key === selectedCategory);
    
    return (
      <View style={styles.emptyState}>
        <Ionicons name={activeCategory?.icon || "calendar-outline"} size={64} color="#C7C7CC" />
        <Text style={styles.emptyTitle}>
          No {selectedCategory === 'all' ? '' : selectedCategory + ' '}events found
        </Text>
        <Text style={styles.emptySubtitle}>
          {selectedCategory === 'all' 
            ? 'You don\'t have any events yet. Join or host events to see them here.'
            : `You don't have any ${selectedCategory} events.`
          }
        </Text>
        {selectedCategory === 'all' && (
          <TouchableOpacity
            style={styles.createEventButton}
            onPress={() => {
              navigation.goBack();
              navigation.navigate('CreateEventScreen');
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.createEventButtonText}>Create Event</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading events...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {renderCategoryFilter()}
      {filteredEvents.length > 0 && renderBulkActions()}
      
      <FlatList
        data={filteredEvents}
        keyExtractor={item => item._id}
        renderItem={renderEventItem}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchEvents(true)}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={filteredEvents.length === 0 ? styles.emptyList : styles.eventsList}
      />

      {renderPreviewModal()}
    </SafeAreaView>
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

  // Header
  headerButton: {
    padding: 8,
    marginHorizontal: 4,
  },
  headerButtonText: {
    fontSize: 16,
    color: '#3797EF',
  },
  saveButtonText: {
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Category Filter
  categoryFilter: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
    paddingVertical: 12,
  },
  categoryFilterContent: {
    paddingHorizontal: 16,
  },
  categoryChip: {
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
  categoryChipActive: {
    backgroundColor: '#3797EF',
    borderColor: '#3797EF',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    marginLeft: 4,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },

  // Bulk Actions
  bulkActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  bulkActionsLeft: {
    flex: 1,
  },
  selectionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  filteredCount: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  bulkActionsRight: {
    marginLeft: 16,
  },
  bulkActionButton: {
    backgroundColor: '#3797EF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bulkActionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Events List
  eventsList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  emptyList: {
    flexGrow: 1,
  },

  // Event Items
  eventItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
  },
  eventImageContainer: {
    width: 80,
    height: 80,
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
    top: 4,
    left: 4,
    flexDirection: 'row',
    gap: 4,
  },
  eventStatusBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hostBadge: {
    backgroundColor: '#FF9500',
  },
  attendingBadge: {
    backgroundColor: '#34C759',
  },
  pastEventBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(142, 142, 147, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
  selectionIndicatorActive: {
    // Additional styles if needed
  },
  eventContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    lineHeight: 18,
    marginBottom: 8,
  },
  eventMeta: {
    marginBottom: 8,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventMetaText: {
    fontSize: 11,
    color: '#8E8E93',
    marginLeft: 6,
    flex: 1,
  },
  sharingStatus: {
    alignSelf: 'flex-start',
  },
  sharingStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
  },
  sharingStatusTextActive: {
    color: '#34C759',
  },

  // Preview Modal
  previewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  previewClose: {
    padding: 8,
  },
  previewContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  previewSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 20,
    textAlign: 'center',
  },
  previewEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  previewEmptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  previewEmptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
  previewEvents: {
    gap: 12,
  },
  previewEventItem: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  previewEventImageContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    overflow: 'hidden',
  },
  previewEventImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
  },
  previewEventImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewEventContent: {
    flex: 1,
  },
  previewEventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  previewEventMeta: {
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
  emptyTitle: {
    fontSize: 18,
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
  createEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3797EF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createEventButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});