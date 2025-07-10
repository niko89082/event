// screens/EventListScreen.js - FIXED: Refresh events when returning from EventDetailsScreen
import React, { useEffect, useState, useContext } from 'react';
import { 
  View, FlatList, ActivityIndicator, StyleSheet, Button, 
  SafeAreaView, StatusBar, TouchableOpacity, Text, RefreshControl 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
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

  // FIXED: Use useFocusEffect to refresh events when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchEvents();
    }, [])
  );

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

  const handleAttendEvent = async (event) => {
    try {
      const response = await api.post(`/api/events/attend/${event._id}`);
      
      // Update local state to reflect attendance change
      setEvents(prevEvents => 
        prevEvents.map(e => 
          e._id === event._id 
            ? { ...e, attendees: [...(e.attendees || []), currentUserId] }
            : e
        )
      );
      
      return response.data;
    } catch (error) {
      console.error('Attend event error:', error);
      throw error;
    }
  };

  const renderEventCard = ({ item }) => (
    <EventCard
      event={item}
      currentUserId={currentUserId}
      navigation={navigation}
      onAttend={handleAttendEvent}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="calendar-outline" size={64} color="#C7C7CC" />
      </View>
      <Text style={styles.emptyTitle}>No Events Found</Text>
      <Text style={styles.emptySubtitle}>
        Check back later for new events or create your own!
      </Text>
      <TouchableOpacity 
        style={styles.createEventButton}
        onPress={() => navigation.navigate('CreateEventScreen')}
        activeOpacity={0.8}
      >
        <Text style={styles.createEventButtonText}>Create Event</Text>
      </TouchableOpacity>
    </View>
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
      
      <FlatList
        data={events}
        renderItem={renderEventCard}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#3797EF"
            colors={["#3797EF"]}
          />
        }
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={events.length === 0 ? styles.emptyContainer : styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  
  // Header
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },

  // List
  listContent: {
    paddingTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F6F6F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
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
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 160,
    alignItems: 'center',
  },
  createEventButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});