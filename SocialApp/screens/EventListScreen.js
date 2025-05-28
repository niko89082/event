// screens/EventListScreen.js - Updated with improved UI
import React, { useEffect, useState, useContext } from 'react';
import { 
  View, FlatList, ActivityIndicator, StyleSheet, Button, 
  SafeAreaView, StatusBar, TouchableOpacity, Text, RefreshControl 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import EventCard from '../components/EventCard';
import { AuthContext } from '../services/AuthContext';

export default function EventListScreen({ navigation }) {
  const { currentUser } = useContext(AuthContext);
  const currentUserId = currentUser?._id;

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: '#FFFFFF',
        shadowOpacity: 0,
        elevation: 0,
        borderBottomWidth: 0.33,
        borderBottomColor: '#E1E1E1',
        height: 88,
      },
      headerTitleStyle: {
        fontWeight: '700',
        fontSize: 22,
        color: '#000000',
      },
      headerTitle: 'Events',
      headerRight: () => (
        <View style={styles.headerRightContainer}>
          <TouchableOpacity
            onPress={() => navigation.navigate('CalendarScreen')}
            style={styles.headerButton}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={24} color="#000000" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('CreateEventScreen')}
            style={styles.headerButton}
            activeOpacity={0.7}
          >
            <Ionicons name="add-outline" size={26} color="#000000" />
          </TouchableOpacity>
        </View>
      ),
      headerLeft: () => null, // Remove back button since this is a tab screen
    });
  }, [navigation]);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      // The server now only returns events the user is allowed to see
      const res = await api.get('/api/events');
      setEvents(res.data);
    } catch (err) {
      console.error('Error fetching events:', err.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  };

  // Called when user taps the card
  const handlePressEvent = (event) => {
    navigation.navigate('EventDetailsScreen', { eventId: event._id });
  };

  // Called when user taps "Attend"
  const handleAttend = async (event) => {
    try {
      const res = await api.post(`/api/events/attend/${event._id}`);
      console.log('Attending =>', res.data);
      // Optionally re-fetch events or update local state
      fetchEvents();
    } catch (err) {
      console.error('Error attending event:', err.response?.data || err);
    }
  };

  const renderEvent = ({ item }) => (
    <EventCard
      event={item}
      currentUserId={currentUserId}
      onPressEvent={handlePressEvent}
      onAttend={handleAttend}
      navigation={navigation}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {events.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="calendar-outline" size={64} color="#C7C7CC" />
          </View>
          <Text style={styles.emptyTitle}>No Events Yet</Text>
          <Text style={styles.emptySubtitle}>
            Discover upcoming events or create your own to get started.
          </Text>
          <TouchableOpacity 
            style={styles.createEventButton}
            onPress={() => navigation.navigate('CreateEventScreen')}
            activeOpacity={0.8}
          >
            <Text style={styles.createEventText}>Create Event</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsText}>
              {events.length} events available
            </Text>
          </View>
          
          <FlatList
            data={events}
            keyExtractor={(item) => item._id}
            renderItem={renderEvent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={handleRefresh}
                tintColor="#3797EF"
                colors={["#3797EF"]}
              />
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 4,
  },
  centered: {
    flex: 1, 
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  content: {
    flex: 1,
  },
  statsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.33,
    borderBottomColor: '#E1E1E1',
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    textAlign: 'center',
  },
  listContainer: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#FFFFFF',
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  createEventButton: {
    backgroundColor: '#3797EF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  createEventText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});