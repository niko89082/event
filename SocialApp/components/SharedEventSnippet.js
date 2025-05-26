// SharedEventSnippet.js
import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import api from '../services/api';
import { API_BASE_URL } from '@env';

export default function SharedEventSnippet({ message, senderName }) {
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (message.shareId) {
      fetchEvent(message.shareId);
    }
  }, [message]);

  const fetchEvent = async (eventId) => {
    try {
      const res = await api.get(`/events/${eventId}`);
      setEvent(res.data);
    } catch (err) {
      console.error('SharedEventSnippet => fetch error:', err);
      if (err.response?.status === 401) {
        setError('This event is private. You do not have access.');
      } else {
        setError('Could not load event.');
      }
    }
  };

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.sender}>{senderName} shared an event...</Text>
        <Text style={{ color: 'red' }}>{error}</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.container}>
        <Text style={styles.sender}>{senderName} shared an event...</Text>
        <Text>Loading event...</Text>
      </View>
    );
  }

  const coverUrl = event.coverImage
    ? `http://${API_BASE_URL}:3000${event.coverImage}`
    : null;

  return (
    <View style={styles.container}>
      <Text style={styles.sender}>{senderName} shared an event:</Text>
      {coverUrl && (
        <Image source={{ uri: coverUrl }} style={styles.eventImage} />
      )}
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.details}>{event.location}</Text>
      <Text style={styles.details}>Attendees: {event.attendees?.length || 0}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#efe',
    padding: 8,
    marginVertical: 4,
    borderRadius: 8,
  },
  sender: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  eventImage: {
    width: 150,
    height: 150,
    resizeMode: 'cover',
    marginVertical: 6,
  },
  title: { fontWeight: 'bold', fontSize: 16, marginBottom: 2 },
  details: { marginVertical: 2 },
});