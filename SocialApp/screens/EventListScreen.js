// screens/EventListScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Button } from 'react-native';
import api from '../services/api';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

export default function EventListScreen() {
  const navigation = useNavigation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // We fetch events whenever this screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [])
  );

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/events');
      setEvents(res.data);
    } catch (error) {
      console.error('EventListScreen => fetchEvents => error:', error.response?.data || error);
    } finally {
      setLoading(false);
    }
  };

  const handlePressEvent = (eventId) => {
    navigation.navigate('EventDetails', { eventId });
  };

  const handleCreateEvent = () => {
    navigation.navigate('CreateEventScreen');
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.eventItem} onPress={() => handlePressEvent(item._id)}>
      <Text style={styles.eventTitle}>{item.title}</Text>
      <Text style={styles.eventMeta}>{new Date(item.time).toLocaleString()} – {item.location}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Button title="Create Event" onPress={handleCreateEvent} />
      {events.length === 0 ? (
        <Text style={styles.noEvents}>No events found.</Text>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          style={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { marginTop: 8 },
  eventItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  eventTitle: {
    fontSize: 16, 
    fontWeight: 'bold',
    marginBottom: 4,
  },
  eventMeta: { color: '#666' },
  noEvents: {
    marginTop: 20, 
    fontStyle: 'italic',
    textAlign: 'center',
  },
});