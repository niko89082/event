// screens/AttendeeListScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import api from '../services/api';
import { useRoute, useNavigation } from '@react-navigation/native';

export default function AttendeeListScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { eventId } = route.params || {};

  const [attendees, setAttendees] = useState([]);

  useEffect(() => {
    fetchAttendees();
  }, [eventId]);

  const fetchAttendees = async () => {
    try {
      // We could re-fetch the event and then show event.attendees
      const res = await api.get(`/events/${eventId}`);
      setAttendees(res.data.attendees || []);
    } catch (err) {
      console.error('AttendeeList => error:', err.response?.data || err);
    }
  };

  const handlePressUser = (userId) => {
    navigation.navigate('ProfileScreen', { userId });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity onPress={() => handlePressUser(item._id)} style={styles.row}>
      <Text>{item.username}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Attendees</Text>
      <FlatList
        data={attendees}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 20, marginBottom: 12 },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
});