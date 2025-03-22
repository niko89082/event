// screens/CheckinListScreen.js (example)
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import api from '../services/api';
import { useRoute, useNavigation } from '@react-navigation/native';

export default function CheckinListScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { eventId } = route.params || {};

  const [checkedIn, setCheckedIn] = useState([]);

  useEffect(() => {
    fetchCheckins();
  }, [eventId]);

  const fetchCheckins = async () => {
    try {
      // Maybe event has a field "checkedInAttendees" or "attendees" with "checkedIn: true"
      // This example assumes a separate "checkedInAttendees" array:
      const res = await api.get(`/events/${eventId}`);
      setCheckedIn(res.data.checkedInAttendees || []);
    } catch (err) {
      console.log('CheckinList => error:', err.response?.data || err);
    }
  };

  const handlePressUser = (userId) => {
    navigation.navigate('ProfileScreen', { userId });
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, marginBottom: 12 }}>Checked-In Users</Text>
      <FlatList
        data={checkedIn}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handlePressUser(item._id)}>
            <Text style={{ marginVertical: 8 }}>{item.username}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}