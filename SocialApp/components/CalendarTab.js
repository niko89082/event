// components/CalendarTab.js - Enhanced with Past Events Integration
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity,
  Alert, Modal, ActivityIndicator 
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

export default function CalendarTab({ navigation, userId }) {
  const [events, setEvents] = useState([]);
  const [pastEvents, setPastEvents] = useState([]);
  const [markedDates, setMarkedDates] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPastEventsModal, setShowPastEventsModal] = useState(false);
  const [calendarMode, setCalendarMode] = useState('upcoming'); // 'upcoming' or 'past'
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (userId) {
      fetchUserEvents();
    }
  }, [userId, calendarMode]);

  const fetchUserEvents = async () => {
    try {
      setLoading(true);
      
      if (calendarMode === 'upcoming') {
        // Fetch upcoming events
        const res = await api.get(`/events/user/${userId}/calendar`);
        const userEvents = res.data.events || [];
        setEvents(userEvents);
        generateMarkedDates(userEvents);
      } else {
        // Fetch past events for the current year
        const year = currentMonth.getFullYear();
        const res = await api.get(`/api/users/event-timeline`, {
          params: { year }
        });
        
        // Flatten timeline events
        const timelineEvents = [];
        res.data.timeline.forEach(month => {
          timelineEvents.push(...month.events);
        });
        
        setPastEvents(timelineEvents);
        generateMarkedDates(timelineEvents, true);
      }
    } catch (err) {
      console.error('CalendarTab fetch error:', err.response?.data || err);
      Alert.alert('Error', 'Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  };

  const generateMarkedDates = (allEvents, isPast = false) => {
    const marks = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    allEvents.forEach(evt => {
      if (!evt.time) return;
      const eventDate = new Date(evt.time);
      const dateStr = toDateString(eventDate);
      
      // Determine event status and color
      let color = '#3797EF'; // default blue for upcoming
      let textColor = '#FFFFFF';
      
      if (isPast || eventDate < today) {
        if (evt.isHost) {
          color = '#FF9500'; // orange for hosted events
        } else {
          color = '#34C759'; // green for attended events
        }
      }

      if (!marks[dateStr]) {
        marks[dateStr] = {
          marked: true,
          dotColor: color,
          events: []
        };
      }
      
      marks[dateStr].events.push(evt);
      
      // If multiple events on same day, show multiple dots
      if (marks[dateStr].events.length > 1) {
        marks[dateStr].dots = marks[dateStr].events.map((e, index) => ({
          color: index === 0 ? color : (e.isHost ? '#FF9500' : '#34C759'),
          selectedDotColor: '#FFFFFF'
        }));
      }
    });
    
    setMarkedDates(marks);
  };

  const toDateString = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleDayPress = (dayObj) => {
    setSelectedDate(dayObj.dateString);
    const markedDate = markedDates[dayObj.dateString];
    
    if (markedDate && markedDate.events) {
      setSelectedEvents(markedDate.events);
    } else {
      setSelectedEvents([]);
    }
  };

  const handleMonthChange = (month) => {
    const newMonth = new Date(month.year, month.month - 1);
    setCurrentMonth(newMonth);
    
    if (calendarMode === 'past') {
      // Fetch events for the new month if needed
      fetchUserEvents();
    }
  };

  const renderModeToggle = () => (
    <View style={styles.modeToggle}>
      <TouchableOpacity
        style={[
          styles.modeButton,
          calendarMode === 'upcoming' && styles.activeModeButton
        ]}
        onPress={() => setCalendarMode('upcoming')}
        activeOpacity={0.8}
      >
        <Ionicons 
          name="calendar-outline" 
          size={16} 
          color={calendarMode === 'upcoming' ? '#FFFFFF' : '#8E8E93'} 
        />
        <Text style={[
          styles.modeButtonText,
          calendarMode === 'upcoming' && styles.activeModeButtonText
        ]}>
          Upcoming
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.modeButton,
          calendarMode === 'past' && styles.activeModeButton
        ]}
        onPress={() => setCalendarMode('past')}
        activeOpacity={0.8}
      >
        <Ionicons 
          name="time-outline" 
          size={16} 
          color={calendarMode === 'past' ? '#FFFFFF' : '#8E8E93'} 
        />
        <Text style={[
          styles.modeButtonText,
          calendarMode === 'past' && styles.activeModeButtonText
        ]}>
          Past Events
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderEventItem = ({ item }) => {
    const eventDate = new Date(item.time);
    const isPast = eventDate < new Date();
    const isHost = Boolean(item.isHost);
    
    return (
      <TouchableOpacity
        style={[
          styles.eventItem,
          isPast && styles.pastEventItem
        ]}
        onPress={() => navigation.navigate('EventDetailsScreen', { eventId: item._id })}
        activeOpacity={0.9}
      >
        <View style={styles.eventItemContent}>
          <View style={styles.eventItemHeader}>
            <Text style={[
              styles.eventTitle,
              isPast && styles.pastEventTitle
            ]} numberOfLines={1}>
              {item.title}
            </Text>
            
            {isPast && (
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
            )}
          </View>
          
          <View style={styles.eventItemMeta}>
            <View style={styles.eventMetaRow}>
              <Ionicons name="time-outline" size={14} color="#8E8E93" />
              <Text style={styles.eventTime}>
                {eventDate.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </View>
            
            {item.location && (
              <View style={styles.eventMetaRow}>
                <Ionicons name="location-outline" size={14} color="#8E8E93" />
                <Text style={styles.eventLocation} numberOfLines={1}>
                  {item.location}
                </Text>
              </View>
            )}
          </View>

          {/* Show additional info for past events */}
          {isPast && (
            <View style={styles.pastEventInfo}>
              {item.photoCount > 0 && (
                <TouchableOpacity
                  style={styles.photosButton}
                  onPress={() => navigation.navigate('EventPhotosScreen', { eventId: item._id })}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={12} color="#3797EF" />
                  <Text style={styles.photosButtonText}>
                    {item.photoCount} {item.photoCount === 1 ? 'photo' : 'photos'}
                  </Text>
                </TouchableOpacity>
              )}
              
              <Text style={styles.pastEventRole}>
                {isHost ? 'You hosted this event' : 'You attended this event'}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderCalendarLegend = () => (
    <View style={styles.legend}>
      <Text style={styles.legendTitle}>Legend</Text>
      <View style={styles.legendItems}>
        {calendarMode === 'upcoming' ? (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#3797EF' }]} />
            <Text style={styles.legendText}>Upcoming Events</Text>
          </View>
        ) : (
          <>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF9500' }]} />
              <Text style={styles.legendText}>Hosted</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
              <Text style={styles.legendText}>Attended</Text>
            </View>
          </>
        )}
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
          <Ionicons name="add" size={20} color="#3797EF" />
        </View>
        <Text style={styles.quickActionText}>New Event</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.quickAction}
        onPress={() => setShowPastEventsModal(true)}
        activeOpacity={0.8}
      >
        <View style={styles.quickActionIcon}>
          <Ionicons name="stats-chart" size={20} color="#3797EF" />
        </View>
        <Text style={styles.quickActionText}>View Stats</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.quickAction}
        onPress={() => navigation.navigate('EventListScreen')}
        activeOpacity={0.8}
      >
        <View style={styles.quickActionIcon}>
          <Ionicons name="compass" size={20} color="#3797EF" />
        </View>
        <Text style={styles.quickActionText}>Discover</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStatsModal = () => (
    <Modal
      visible={showPastEventsModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Event Statistics</Text>
          <TouchableOpacity
            onPress={() => setShowPastEventsModal(false)}
            style={styles.modalCloseButton}
          >
            <Ionicons name="close" size={24} color="#8E8E93" />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          <TouchableOpacity
            style={styles.statsOption}
            onPress={() => {
              setShowPastEventsModal(false);
              navigation.navigate('PastEventsStats');
            }}
            activeOpacity={0.8}
          >
            <View style={styles.statsOptionIcon}>
              <Ionicons name="bar-chart" size={24} color="#3797EF" />
            </View>
            <View style={styles.statsOptionContent}>
              <Text style={styles.statsOptionTitle}>Detailed Analytics</Text>
              <Text style={styles.statsOptionSubtitle}>
                View comprehensive statistics about your event participation
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statsOption}
            onPress={() => {
              setShowPastEventsModal(false);
              navigation.navigate('EventMemories');
            }}
            activeOpacity={0.8}
          >
            <View style={styles.statsOptionIcon}>
              <Ionicons name="images" size={24} color="#FF9500" />
            </View>
            <View style={styles.statsOptionContent}>
              <Text style={styles.statsOptionTitle}>Event Memories</Text>
              <Text style={styles.statsOptionSubtitle}>
                Browse photos and memories from your past events
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statsOption}
            onPress={() => {
              setShowPastEventsModal(false);
              navigation.navigate('EventTimeline');
            }}
            activeOpacity={0.8}
          >
            <View style={styles.statsOptionIcon}>
              <Ionicons name="time" size={24} color="#34C759" />
            </View>
            <View style={styles.statsOptionContent}>
              <Text style={styles.statsOptionTitle}>Event Timeline</Text>
              <Text style={styles.statsOptionSubtitle}>
                See a chronological view of all your events
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={styles.loadingText}>Loading calendar...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {renderModeToggle()}
      
      <Calendar
        onDayPress={handleDayPress}
        onMonthChange={handleMonthChange}
        markedDates={{
          ...markedDates,
          ...(selectedDate ? {
            [selectedDate]: {
              ...markedDates[selectedDate],
              selected: true,
              selectedColor: '#3797EF',
            }
          } : {})
        }}
        theme={{
          backgroundColor: '#ffffff',
          calendarBackground: '#ffffff',
          dayTextColor: '#333',
          monthTextColor: '#333',
          textDayFontWeight: '500',
          textMonthFontWeight: '700',
          selectedDayBackgroundColor: '#3797EF',
          selectedDayTextColor: '#ffffff',
          todayTextColor: '#3797EF',
          arrowColor: '#3797EF',
          'stylesheet.day.basic': {
            base: {
              width: 32,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
            },
          },
        }}
        markingType={'multi-dot'}
      />

      {renderCalendarLegend()}
      {renderQuickActions()}

      {selectedDate && (
        <View style={styles.eventsContainer}>
          <Text style={styles.selectedDateText}>
            Events on {new Date(selectedDate).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}:
          </Text>
          
          {selectedEvents.length === 0 ? (
            <Text style={styles.noEvents}>No events on this date</Text>
          ) : (
            <FlatList
              data={selectedEvents}
              keyExtractor={(evt) => evt._id}
              renderItem={renderEventItem}
              scrollEnabled={false}
            />
          )}
        </View>
      )}

      {renderStatsModal()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8F9FA' 
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

  // Mode Toggle
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  activeModeButton: {
    backgroundColor: '#3797EF',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginLeft: 6,
  },
  activeModeButtonText: {
    color: '#FFFFFF',
  },

  // Legend
  legend: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  legendItems: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#8E8E93',
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
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
  },

  // Events Container
  eventsContainer: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedDateText: { 
    fontWeight: '600', 
    marginBottom: 12,
    fontSize: 16,
    color: '#000000',
  },
  noEvents: { 
    fontStyle: 'italic', 
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 20,
  },

  // Event Items
  eventItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F0F0F0',
  },
  pastEventItem: {
    opacity: 0.8,
  },
  eventItemContent: {
    flex: 1,
  },
  eventItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eventTitle: { 
    fontWeight: '700',
    fontSize: 16,
    color: '#000000',
    flex: 1,
  },
  pastEventTitle: {
    color: '#666666',
  },
  roleBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hostBadge: {
    backgroundColor: '#FF9500',
  },
  attendedBadge: {
    backgroundColor: '#34C759',
  },
  eventItemMeta: {
    marginBottom: 8,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventTime: { 
    color: '#8E8E93',
    fontSize: 14,
    marginLeft: 6,
  },
  eventLocation: {
    color: '#8E8E93',
    fontSize: 14,
    marginLeft: 6,
    flex: 1,
  },
  pastEventInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  photosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  photosButtonText: {
    fontSize: 12,
    color: '#3797EF',
    fontWeight: '500',
    marginLeft: 4,
  },
  pastEventRole: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },

  // Modal Styles
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
  modalCloseButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  statsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  statsOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statsOptionContent: {
    flex: 1,
  },
  statsOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  statsOptionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
  },
});