// components/SharedEventsTab.js - Updated for new profile system
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
  Alert, Image, StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function SharedEventsTab({ navigation, userId, isSelf }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState([]);
  const [hostedEvents, setHostedEvents] = useState([]);

  useEffect(() => {
    fetchEvents();
  }, [userId]);

  const fetchEvents = useCallback(async (pull = false) => {
    try {
      pull ? setRefreshing(true) : setLoading(true);
      
      // Fetch shared events (events user explicitly chose to share)
      const { data: sharedData } = await api.get(`/api/profile/${userId}/shared-events`);
      const sharedEvents = sharedData.sharedEvents || [];
      
      // For other users, also fetch their public hosted events
      let publicHostedEvents = [];
      if (!isSelf) {
        try {
          const { data: hostedData } = await api.get(`/api/events?host=${userId}&public=true`);
          publicHostedEvents = hostedData.events || hostedData || [];
        } catch (error) {
          console.log('Could not fetch hosted events:', error);
        }
      }
      
      setEvents(sharedEvents);
      setHostedEvents(publicHostedEvents);
      
    } catch (err) {
      console.error('SharedEventsTab fetch error:', err.response?.data || err);
      if (err.response?.status === 403) {
        // Private account - show empty state
        setEvents([]);
        setHostedEvents([]);
      }
    } finally {
      pull ? setRefreshing(false) : setLoading(false);
    }
  }, [userId, isSelf]);

  const renderEventItem = ({ item }) => {
    const eventDate = new Date(item.time);
    const isPast = eventDate < new Date();
    const coverImage = item.coverImage 
      ? `http://${API_BASE_URL}:3000${item.coverImage}` 
      : null;
    
    const isHosted = String(item.host?._id || item.host) === String(userId);

    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => navigation.navigate('EventDetailsScreen', { eventId: item._id })}
        activeOpacity={0.95}
      >
        <View style={styles.eventImageContainer}>
          {coverImage ? (
            <Image source={{ uri: coverImage }} style={styles.eventImage} />
          ) : (
            <View style={styles.eventImagePlaceholder}>
              <Ionicons name="calendar-outline" size={28} color="#C7C7CC" />
            </View>
          )}
          
          {/* Event Type Badge */}
          <View style={[
            styles.eventTypeBadge,
            isHosted ? styles.hostedBadge : styles.attendedBadge
          ]}>
            <Ionicons 
              name={isHosted ? "star" : "checkmark"} 
              size={12} 
              color="#FFFFFF" 
            />
            <Text style={styles.eventTypeBadgeText}>
              {isHosted ? 'Hosted' : 'Attended'}
            </Text>
          </View>

          {/* Past Event Indicator */}
          {isPast && (
            <View style={styles.pastEventIndicator}>
              <Ionicons name="time" size={12} color="#FFFFFF" />
            </View>
          )}
        </View>

        <View style={styles.eventContent}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {item.title}
          </Text>
          
          <View style={styles.eventMeta}>
            <View style={styles.eventMetaRow}>
              <Ionicons name="calendar-outline" size={14} color="#8E8E93" />
              <Text style={styles.eventMetaText}>
                {eventDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: eventDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                })}
              </Text>
            </View>
            
            <View style={styles.eventMetaRow}>
              <Ionicons name="location-outline" size={14} color="#8E8E93" />
              <Text style={styles.eventMetaText} numberOfLines={1}>
                {item.location}
              </Text>
            </View>

            {item.attendees && item.attendees.length > 0 && (
              <View style={styles.eventMetaRow}>
                <Ionicons name="people-outline" size={14} color="#8E8E93" />
                <Text style={styles.eventMetaText}>
                  {item.attendees.length} {item.attendees.length === 1 ? 'person' : 'people'}
                </Text>
              </View>
            )}
          </View>

          {item.category && (
            <View style={styles.categoryTag}>
              <Text style={styles.categoryTagText}>{item.category}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = (title, data, emptyMessage) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCount}>({data.length})</Text>
      </View>
      
      {data.length === 0 ? (
        <View style={styles.sectionEmpty}>
          <Text style={styles.sectionEmptyText}>{emptyMessage}</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={e => e._id}
          renderItem={renderEventItem}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );

  const renderManageButton = () => {
    if (!isSelf) return null;

    return (
      <TouchableOpacity
        style={styles.manageButton}
        onPress={() => navigation.navigate('SelectShareableEventsScreen', { userId })}
        activeOpacity={0.8}
      >
        <Ionicons name="settings-outline" size={20} color="#3797EF" />
        <Text style={styles.manageButtonText}>Manage Shared Events</Text>
      </TouchableOpacity>
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

  // Check if user has any events to show
  const hasSharedEvents = events.length > 0;
  const hasHostedEvents = hostedEvents.length > 0;
  const hasAnyEvents = hasSharedEvents || hasHostedEvents;

  if (!hasAnyEvents) {
    return (
      <View style={styles.container}>
        {renderManageButton()}
        
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="share-outline" size={64} color="#C7C7CC" />
          </View>
          <Text style={styles.emptyTitle}>
            {isSelf ? 'No shared events' : 'No public events'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {isSelf 
              ? 'Choose which events to share publicly in your profile'
              : 'This user hasn\'t shared any events publicly yet'
            }
          </Text>
          
          {isSelf && (
            <TouchableOpacity
              style={styles.shareEventsButton}
              onPress={() => navigation.navigate('SelectShareableEventsScreen', { userId })}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.shareEventsButtonText}>Share Events</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderManageButton()}
      
      <FlatList
        data={[]}
        renderItem={() => null}
        ListHeaderComponent={() => (
          <View>
            {/* Shared Events Section */}
            {hasSharedEvents && renderSection(
              isSelf ? 'Shared Events' : 'Shared by User',
              events,
              'No events shared yet'
            )}
            
            {/* Hosted Events Section (for other users only) */}
            {!isSelf && hasHostedEvents && renderSection(
              'Public Events Hosted',
              hostedEvents,
              'No public hosted events'
            )}
          </View>
        )}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => fetchEvents(true)}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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
  scrollContent: {
    paddingBottom: 20,
  },

  // Manage Button
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F8FF',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E8F7',
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3797EF',
    marginLeft: 8,
  },

  // Sections
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginLeft: 8,
  },
  sectionEmpty: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  sectionEmptyText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  separator: {
    height: 12,
  },

  // Event Cards
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
  },
  eventImageContainer: {
    width: 100,
    height: 100,
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
  eventTypeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  hostedBadge: {
    backgroundColor: '#FF9500',
  },
  attendedBadge: {
    backgroundColor: '#34C759',
  },
  eventTypeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 3,
  },
  pastEventIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(142, 142, 147, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Event Content
  eventContent: {
    flex: 1,
    padding: 16,
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
    gap: 4,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventMetaText: {
    fontSize: 13,
    color: '#8E8E93',
    marginLeft: 6,
    flex: 1,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F8FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 8,
  },
  categoryTagText: {
    fontSize: 11,
    color: '#3797EF',
    fontWeight: '600',
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
  shareEventsButton: {
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
  shareEventsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});