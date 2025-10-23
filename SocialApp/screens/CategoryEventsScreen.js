// screens/CategoryEventsScreen.js - Phase 1: Full category events view
import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import api from '../services/api';
import EventCard from '../components/EventCard'; // Use existing full event card

// Category icons (simplified version for header)
const CATEGORY_ICONS = {
  'Music': 'musical-notes',
  'Party': 'sparkles',
  'Social': 'people',
  'Club': 'business',
  'Sports': 'fitness',
  'Food': 'restaurant',
  'Business': 'briefcase',
  'Entertainment': 'film',
  'Art': 'color-palette',
  'Technology': 'laptop',
  'Education': 'school',
  'Health': 'heart',
  'Travel': 'airplane',
  'Celebration': 'gift',
  'Professional': 'medal',
  'Meeting': 'chatbubbles',
  'General': 'calendar',
};

export default function CategoryEventsScreen({ route, navigation }) {
  const { category } = route.params;
  const { currentUser } = useContext(AuthContext);
  
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    navigation.setOptions({
      title: `${category} Events`,
      headerStyle: {
        backgroundColor: '#FFFFFF',
        shadowColor: 'transparent',
        elevation: 0,
      },
      headerTintColor: '#000000',
      headerTitleStyle: {
        fontWeight: '600',
        fontSize: 18,
      },
      headerLeft: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#000000" />
        </TouchableOpacity>
      ),
    });

    loadCategoryEvents(false, false);
  }, [category, navigation]);

  const loadCategoryEvents = async (reset = false, loadMore = false) => {
    try {
      if (reset) {
        setRefreshing(true);
      } else if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const currentPage = reset ? 1 : loadMore ? page + 1 : 1;
      const response = await api.get('/api/events/discover', {
        params: {
          category: category,
          upcoming: true,
          limit: 20, // More events for full list view
          skip: (currentPage - 1) * 20
        }
      });

      const newEvents = response.data.events || response.data || [];

      if (reset || !loadMore) {
        setEvents(newEvents);
        setPage(1);
      } else {
        setEvents(prev => [...prev, ...newEvents]);
        setPage(currentPage);
      }

      setHasMore(newEvents.length === 20);

    } catch (error) {
      console.error(`Error loading ${category} events:`, error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const handleRefresh = () => {
    loadCategoryEvents(true, false);
  };

  const handleLoadMore = () => {
    if (hasMore && !loadingMore && !loading) {
      loadCategoryEvents(false, true);
    }
  };

  const handleEventPress = (event) => {
    navigation.navigate('EventDetailsScreen', { 
      eventId: event._id,
      event: event 
    });
  };

  const handleAttend = async (eventId) => {
    try {
      await api.post(`/api/events/attend/${eventId}`);
      // Update events list to reflect attendance
      setEvents(prev => prev.map(event => 
        event._id === eventId 
          ? { ...event, isAttending: !event.isAttending }
          : event
      ));
    } catch (error) {
      console.error('Error attending event:', error);
    }
  };

  const renderEvent = ({ item }) => (
    <EventCard
      event={item}
      currentUserId={currentUser?._id}
      onPress={() => handleEventPress(item)}
      onAttend={handleAttend}
      navigation={navigation}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons 
          name={CATEGORY_ICONS[category] || 'calendar-outline'} 
          size={64} 
          color="#C7C7CC" 
        />
      </View>
      <Text style={styles.emptyTitle}>No {category} Events</Text>
      <Text style={styles.emptySubtitle}>
        Check back later for new {category.toLowerCase()} events
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <View style={styles.categoryInfo}>
          <View style={styles.categoryIconContainer}>
            <Ionicons 
              name={CATEGORY_ICONS[category] || 'calendar-outline'} 
              size={28} 
              color="#3797EF" 
            />
          </View>
          <Text style={styles.categoryTitle}>{category}</Text>
        </View>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!hasMore) {
      return (
        <View style={styles.footerText}>
          <Text style={styles.endText}>
            You've reached the end of {category.toLowerCase()} events
          </Text>
        </View>
      );
    }

    if (loadingMore) {
      return (
        <View style={styles.footerLoading}>
          <ActivityIndicator size="small" color="#3797EF" />
          <Text style={styles.loadingText}>Loading more events...</Text>
        </View>
      );
    }

    return null;
  };

  if (loading && events.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Loading {category.toLowerCase()} events...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <FlatList
        data={events}
        keyExtractor={item => item._id}
        renderItem={renderEvent}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#3797EF"
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={events.length === 0 ? styles.emptyContainer : styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF', // White header stands out from gray background
  },
  headerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyIconContainer: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  footerText: {
    padding: 20,
    alignItems: 'center',
  },
  footerLoading: {
    padding: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  endText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
});