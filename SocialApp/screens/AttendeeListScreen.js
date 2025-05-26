// screens/AttendeeListScreen.js
import React, { useEffect, useState, useContext } from 'react';
import {
  View, Text, FlatList, StyleSheet, Alert
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import api from '../services/api';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AuthContext } from '../services/AuthContext';

export default function AttendeeListScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { eventId } = route.params || {};

  const { currentUser } = useContext(AuthContext);
  const [attendees, setAttendees] = useState([]);
  const [isHostOrCoHost, setIsHostOrCoHost] = useState(false);

  useEffect(() => {
    fetchEventAndAttendees();
  }, [eventId]);

  const fetchEventAndAttendees = async () => {
    try {
      const res = await api.get(`/events/${eventId}`);
      const eventData = res.data;
      setAttendees(eventData.attendees || []);

      // Check if current user is host or co-host
      const userId = currentUser?._id;
      const isHost = (eventData.host?._id === userId);
      const isCoHost = eventData.coHosts?.some((c) => c._id === userId);
      setIsHostOrCoHost(isHost || isCoHost);
    } catch (err) {
      console.error('AttendeeList => error:', err.response?.data || err);
    }
  };

  // When user taps the row => open their profile
  const handlePressUser = (userId) => {
    navigation.navigate('ProfileScreen', { userId });
  };

  // Called when swiping row => showing "ban" or "remove" button
  const renderRightActions = (attendee) => {
    return (
      <View style={styles.rightActionContainer}>
        <TouchableOpacity
          style={styles.redXButton}
          onPress={() => confirmBanOrRemove(attendee)}
        >
          <Text style={styles.redXText}>X</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const confirmBanOrRemove = (attendee) => {
    Alert.alert(
      'Remove Attendee',
      `Do you want to permanently ban ${attendee.username}, or just remove them?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'default',
          onPress: () => banOrRemoveUser(attendee._id, false),
        },
        {
          text: 'Ban Permanently',
          style: 'destructive',
          onPress: () => banOrRemoveUser(attendee._id, true),
        },
      ]
    );
  };

  const banOrRemoveUser = async (userId, banPermanently) => {
    try {
      await api.post(`/events/${eventId}/banUser`, {
        userId,
        banPermanently
      });
      Alert.alert(
        banPermanently ? 'User banned' : 'User removed',
        banPermanently
          ? 'User has been banned from this event.'
          : 'User has been removed from the event.'
      );
      // Refresh attendee list
      fetchEventAndAttendees();
    } catch (error) {
      console.error('banOrRemoveUser =>', error.response?.data || error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to ban/remove user');
    }
  };

  // The row item
  const renderItem = ({ item }) => {
    // If NOT host/cohost => no swipe. We'll just do a normal row
    if (!isHostOrCoHost) {
      return (
        <TouchableOpacity onPress={() => handlePressUser(item._id)} style={styles.row}>
          <Text>{item.username}</Text>
        </TouchableOpacity>
      );
    }

    // Else => host can swipe to show ban button
    return (
      <Swipeable
        renderRightActions={() => renderRightActions(item)}
        overshootRight={false}
      >
        <TouchableOpacity onPress={() => handlePressUser(item._id)} style={styles.row}>
          <Text>{item.username}</Text>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Attendees</Text>
      <FlatList
        data={attendees}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 20, marginBottom: 12, fontWeight: 'bold' },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  separator: {
    height: 1, backgroundColor: '#ccc',
  },
  rightActionContainer: {
    width: 70, // or however wide you want the "ban" area
    justifyContent: 'center',
    alignItems: 'center',
  },
  redXButton: {
    width: 40,
    height: 40,
    backgroundColor: 'red',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  redXText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
});