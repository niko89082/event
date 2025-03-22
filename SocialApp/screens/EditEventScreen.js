import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import api from '../services/api';

export default function EditEventScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { eventId } = route.params || {};

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');

  useEffect(() => {
    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const res = await api.get(`/events/${eventId}`);
      const e = res.data;
      setTitle(e.title || '');
      setTime(e.time ? new Date(e.time).toISOString() : '');
      setLocation(e.location || '');
      setDescription(e.description || '');
      setMaxAttendees(e.maxAttendees?.toString() || '');
    } catch (err) {
      console.log('EditEvent => fetch error:', err.response?.data || err);
    }
  };

  const handleSave = async () => {
    try {
      await api.put(`/events/${eventId}`, {
        title,
        time,
        location,
        description,
        maxAttendees: parseInt(maxAttendees) || 0,
      });
      Alert.alert('Saved', 'Event updated successfully.');
      navigation.goBack();
    } catch (err) {
      console.log('EditEvent => update error:', err.response?.data || err);
      Alert.alert('Error', err.response?.data?.message || 'Could not update event.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Title</Text>
      <TextInput value={title} onChangeText={setTitle} style={styles.input} />

      <Text style={styles.label}>Time (ISO string or parse as you prefer)</Text>
      <TextInput value={time} onChangeText={setTime} style={styles.input} />

      <Text style={styles.label}>Location</Text>
      <TextInput value={location} onChangeText={setLocation} style={styles.input} />

      <Text style={styles.label}>Description</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        style={[styles.input, { height: 80 }]}
        multiline
      />

      <Text style={styles.label}>Max Attendees</Text>
      <TextInput
        value={maxAttendees}
        onChangeText={setMaxAttendees}
        keyboardType="numeric"
        style={styles.input}
      />

      <Button title="Save Changes" onPress={handleSave} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  label: { fontWeight: '600', marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 4,
    padding: 8, marginBottom: 12,
  },
});