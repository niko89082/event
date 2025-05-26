// components/CalendarTab.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView } from 'react-native';
import { Calendar } from 'react-native-calendars';
import api from '../services/api';

export default function CalendarTab({ navigation, userId }) {
  const [events, setEvents] = useState([]);
  const [markedDates, setMarkedDates] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState([]);

  useEffect(() => {
    if (userId) {
      fetchUserEvents();
    }
  }, [userId]);

  const fetchUserEvents = async () => {
    try {
      const res = await api.get(`/events/user/${userId}/calendar`);
      const userEvents = res.data.events || [];
      setEvents(userEvents);
      generateMarkedDates(userEvents);
    } catch (err) {
      console.error('CalendarTab fetch error:', err.response?.data || err);
    }
  };

  const generateMarkedDates = (allEvents) => {
    const marks = {};
    allEvents.forEach(evt => {
      if (!evt.time) return;
      const d = new Date(evt.time);
      const dateStr = toDateString(d);
      marks[dateStr] = { marked: true };
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
    const dayEvents = events.filter(evt => {
      if (!evt.time) return false;
      const d = new Date(evt.time);
      return toDateString(d) === dayObj.dateString;
    });
    setSelectedEvents(dayEvents);
  };

  return (
    <ScrollView style={styles.container}>
      <Calendar
        onDayPress={handleDayPress}
        markedDates={{
          ...markedDates,
          ...(selectedDate ? {
            [selectedDate]: {
              selected: true,
              selectedColor: '#00adf7',
              marked: true
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
          // square edges for day
          'stylesheet.day.basic': {
            base: {
              width: 32,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
            },
          },
        }}
      />

      {selectedDate && (
        <View style={styles.eventsContainer}>
          <Text style={styles.selectedDateText}>
            Events on {selectedDate}:
          </Text>
          {selectedEvents.length === 0 ? (
            <Text style={styles.noEvents}>No events</Text>
          ) : (
            <FlatList
              data={selectedEvents}
              keyExtractor={(evt) => evt._id}
              renderItem={({ item }) => (
                <View style={styles.eventItem}>
                  <Text style={styles.eventTitle}>{item.title}</Text>
                  <Text style={styles.eventTime}>
                    {new Date(item.time).toLocaleString()}
                  </Text>
                </View>
              )}
            />
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  eventsContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 12,
    borderRadius: 6,
  },
  selectedDateText: { fontWeight: '600', marginBottom: 6 },
  noEvents: { fontStyle: 'italic', color: '#666' },
  eventItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  eventTitle: { fontWeight: 'bold' },
  eventTime: { color: '#666', fontSize: 12 },
});