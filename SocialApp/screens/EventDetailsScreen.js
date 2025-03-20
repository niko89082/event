// screens/EventDetailsScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator, Alert } from 'react-native';
import api from '../services/api';
import { useRoute, useNavigation } from '@react-navigation/native';

export default function EventDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { eventId } = route.params || {};

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (eventId) {
      fetchEventDetails();
    }
  }, [eventId]);

  const fetchEventDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/events/${eventId}`);
      setEvent(res.data);
    } catch (err) {
      console.error('EventDetails => error:', err.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  const handleAttend = async () => {
    // POST /events/attend/:eventId
    try {
      const res = await api.post(`/events/attend/${eventId}`);
      Alert.alert('Success', 'You are now attending this event.');
      fetchEventDetails(); // re-fetch to update attendees
    } catch (err) {
      console.log('Attend error:', err.response?.data || err);
      Alert.alert('Error', err.response?.data?.message || 'Could not attend.');
    }
  };

  const handleCheckinMode = () => {
    // Suppose only the host sees a "Check in" button
    navigation.navigate('QrScanScreen', { eventId });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.centered}>
        <Text>Event not found.</Text>
      </View>
    );
  }

  // Possibly check if current user is host => show "Scan to check in"
  // e.g. const isHost = (event.host?._id === currentUserId);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.host}>
        Hosted by: {event.host?.username || 'Unknown'}
      </Text>
      <Text style={styles.meta}>
        {new Date(event.time).toLocaleString()} – {event.location}
      </Text>
      <Text style={styles.description}>{event.description}</Text>
      <Text style={styles.meta}>Max Attendees: {event.maxAttendees}</Text>
      <Text style={styles.meta}>Current Attendees: {event.attendees?.length || 0}</Text>

      <View style={{ marginTop: 16 }}>
        <Button title="Attend" onPress={handleAttend} />
      </View>

      {/* If user is host, show "Check In" */}
      {event.host && (
        <View style={{ marginTop: 16 }}>
          <Button title="Check In Attendees" onPress={handleCheckinMode} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  host: { fontWeight: '600', marginBottom: 4 },
  meta: { color: '#666', marginBottom: 4 },
  description: { marginVertical: 8 },
});