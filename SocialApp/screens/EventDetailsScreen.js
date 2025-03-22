import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator, Alert } from 'react-native';
import api from '../services/api';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AuthContext } from '../services/AuthContext';  // <--- so we can check currentUser

export default function EventDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { eventId } = route.params || {};

  const { currentUser } = useContext(AuthContext);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  // We'll see who the current user is, so we can check if they're the host
  const isHost = event?.host?._id === currentUser?._id;

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
    try {
      await api.post(`/events/attend/${eventId}`);
      Alert.alert('Success', 'You are now attending this event.');
      fetchEventDetails(); // re-fetch to update attendees
    } catch (err) {
      console.log('Attend error:', err.response?.data || err);
      Alert.alert('Error', err.response?.data?.message || 'Could not attend.');
    }
  };

  const handleCheckinMode = () => {
    navigation.navigate('QrScanScreen', { eventId });
  };

  // Navigate to a new "EditEventScreen" if user is host
  const handleEditEvent = () => {
    navigation.navigate('EditEventScreen', { eventId });
  };

  // Show a screen listing all attendees
  const handleViewAttendees = () => {
    navigation.navigate('AttendeeListScreen', {
      eventId,
      // optionally: attendees: event.attendees,
      // or just fetch inside AttendeeListScreen
    });
  };

  // Show a screen listing all "checked in" attendees, if you track that
  const handleViewCheckins = () => {
    navigation.navigate('CheckinListScreen', { eventId });
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

      {/* If user is host, show more controls */}
      {isHost && (
        <>
          <View style={{ marginTop: 16 }}>
            <Button title="Check In Attendees" onPress={handleCheckinMode} />
          </View>

          <View style={{ marginTop: 16 }}>
            <Button title="Edit Event" onPress={handleEditEvent} />
          </View>
        </>
      )}

      {/* Everyone can see who is attending, presumably */}
      <View style={{ marginTop: 16 }}>
        <Button title="View Attendees" onPress={handleViewAttendees} />
      </View>

      {/* If you want a separate screen for "checkedIn" */}
      <View style={{ marginTop: 16 }}>
        <Button title="View Checked-In" onPress={handleViewCheckins} />
      </View>
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