import React, { useEffect, useState, useContext } from 'react';
import { View, FlatList, ActivityIndicator, StyleSheet, Button } from 'react-native';
import api from '../services/api';
import EventCard from '../components/EventCard';
import { AuthContext } from '../services/AuthContext';

export default function EventListScreen({ navigation }) {
  const { currentUser } = useContext(AuthContext);
  const currentUserId = currentUser?._id;

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      // The server now only returns events the user is allowed to see
      const res = await api.get('/events');
      setEvents(res.data);
    } catch (err) {
      console.error('Error fetching events:', err.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  // Called when user taps the card
  const handlePressEvent = (event) => {
    navigation.navigate('EventDetails', { eventId: event._id });
  };

  // Called when user taps "Attend"
  const handleAttend = async (event) => {
    try {
      const res = await api.post(`/events/attend/${event._id}`);
      console.log('Attending =>', res.data);
      // Optionally re-fetch events or update local state
      fetchEvents();
    } catch (err) {
      console.error('Error attending event:', err.response?.data || err);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large"/>
      </View>
    );
  }

  return (
    <View>
      <Button 
      title="View My Calendar" 
      onPress={() => navigation.navigate('CalendarScreen')}
    />
    <FlatList
      data={events}
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => (
        <EventCard
          event={item}
          currentUserId={currentUserId}
          onPressEvent={handlePressEvent}
          onAttend={handleAttend}
          navigation={navigation}
        />
      )}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1, 
    justifyContent: 'center',
    alignItems: 'center',
  },
});