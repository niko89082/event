// components/EventRecommendations.js - Smart Event Discovery
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import EventCard from './EventCard';

const RECOMMENDATION_TYPES = [
  { key: 'all', label: 'For You', icon: 'star-outline' },
  { key: 'friends', label: 'Friends', icon: 'people-outline' },
  { key: 'nearby', label: 'Nearby', icon: 'location-outline' },
  { key: 'interests', label: 'Interests', icon: 'heart-outline' }
];

export default function EventRecommendations({ navigation, currentUserId }) {
  const [activeTab, setActiveTab] = useState('all');
  const [recommendations, setRecommendations] = useState([]);
  const [friendsActivity, setFriendsActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    fetchRecommendations();
    getCurrentLocation();
  }, [activeTab]);

  const getCurrentLocation = async () => {
    try {
      // Request location permission and get current location
      // This is a simplified implementation - you'd want to use expo-location
      // const { status } = await Location.requestForegroundPermissionsAsync();
      // if (status === 'granted') {
      //   const location = await Location.getCurrentPositionAsync({});
      //   setUserLocation({
      //     coordinates: [location.coords.longitude, location.coords.latitude]
      //   });
      // }
    } catch (error) {
      console.log('Location permission denied');
    }
  };

  const fetchRecommendations = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const promises = [];

      if (activeTab === 'all' || activeTab === 'interests') {
        const options = {
          limit: 20,
          ...(userLocation && { location: userLocation })
        };
        
        promises.push(
          api.get('/api/events/recommendations', { params: options })
        );
      }

      if (activeTab === 'all' || activeTab === 'friends') {
        promises.push(
          api.get('/api/events/friends-activity', { params: { limit: 10 } })
        );
      }

      if (activeTab === 'nearby' && userLocation) {
        promises.push(
          api.get('/api/events', {
            params: {
              location: JSON.stringify(userLocation),
              radius: 25,
              limit: 20
            }
          })
        );
      }

      const results = await Promise.all(promises);
      
      if (activeTab === 'all') {
        setRecommendations(results[0]?.data || []);
        setFriendsActivity(results[1]?.data || []);
      } else if (activeTab === 'friends') {
        setFriendsActivity(results[0]?.data || []);
      } else if (activeTab === 'interests') {
        setRecommendations(results[0]?.data || []);
      } else if (activeTab === 'nearby') {
        setRecommendations(results[0]?.data || []);
      }

    } catch (error) {
      console.error('Fetch recommendations error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAttend = async (event) => {
    try {
      await api.post(`/api/events/attend/${event._id}`);
      fetchRecommendations(true);
    } catch (error) {
      console.error('Attend event error:', error);
    }
  };

  const renderRecommendationHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.headerTitle}>Discover Events</Text>
      <Text style={styles.headerSubtitle}>
        {activeTab === 'all' && 'Personalized recommendations for you'}
        {activeTab === 'friends' && 'See what your friends are up to'}
        {activeTab === 'nearby' && 'Events happening near you'}
        {activeTab === 'interests' && 'Based on your interests'}
      </Text>
    </View>
  );

  const renderFriendsActivity = () => {
    if (friendsActivity.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="people" size={20} color="#3797EF" />
          <Text style={styles.sectionTitle}>Friend Activity</Text>
        </View>
        
        <FlatList
          data={friendsActivity.slice(0, 3)}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item._id}
          renderItem={({ item }) => (
            <View style={styles.friendActivityCard}>
              <EventCard
                event={item}
                currentUserId={currentUserId}
                navigation={navigation}
                onAttend={handleAttend}
                compact={true}
              />
              <View style={styles.activityBadge}>
                <Text style={styles.activityBadgeText}>
                  {item.activityType === 'hosting' ? '🎉 Hosting' : '✋ Going'}
                </Text>
              </View>
            </View>
          )}
          contentContainerStyle={styles.horizontalList}
        />
      </View>
    );
  };

  const renderRecommendationCard = ({ item }) => (
    <View style={styles.recommendationCard}>
      <EventCard
        event={item}
        currentUserId={currentUserId}
        navigation={navigation}
        onAttend={handleAttend}
      />
      
      {item.recommendationReason && (
        <View style={styles.recommendationBadge}>
          <Ionicons 
            name={getReasonIcon(item.recommendationReason)} 
            size={12} 
            color="#8E8E93" 
          />
          <Text style={styles.recommendationReason}>
            {item.recommendationReason}
          </Text>
        </View>
      )}
    </View>
  );

  const getReasonIcon = (reason) => {
    if (reason.includes('interest')) return 'heart';
    if (reason.includes('location')) return 'location';
    if (reason.includes('weather')) return 'partly-sunny';
    if (reason.includes('friend')) return 'people';
    return 'star';
  };

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {RECOMMENDATION_TYPES.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.tab,
            activeTab === tab.key && styles.activeTab
          ]}
          onPress={() => setActiveTab(tab.key)}
          activeOpacity={0.8}
        >
          <Ionicons 
            name={tab.icon} 
            size={16} 
            color={activeTab === tab.key ? '#3797EF' : '#8E8E93'} 
          />
          <Text style={[
            styles.tabText,
            activeTab === tab.key && styles.activeTabText
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3797EF" />
          <Text style={styles.loadingText}>Finding great events...</Text>
        </View>
      );
    }

    const displayData = activeTab === 'friends' ? friendsActivity : recommendations;

    if (displayData.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons 
            name={RECOMMENDATION_TYPES.find(t => t.key === activeTab)?.icon || 'calendar-outline'} 
            size={64} 
            color="#C7C7CC" 
          />
          <Text style={styles.emptyTitle}>
            {activeTab === 'friends' && 'No friend activity'}
            {activeTab === 'nearby' && 'No nearby events'}
            {activeTab === 'interests' && 'No matching events'}
            {activeTab === 'all' && 'No recommendations'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === 'friends' && 'Your friends haven\'t joined any events recently'}
            {activeTab === 'nearby' && 'Try expanding your search radius'}
            {activeTab === 'interests' && 'Update your interests in settings'}
            {activeTab === 'all' && 'Check back later for new recommendations'}
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={displayData}
        keyExtractor={item => item._id}
        renderItem={renderRecommendationCard}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchRecommendations(true)}
            tintColor="#3797EF"
          />
        }
        ListHeaderComponent={() => (
          <View>
            {renderRecommendationHeader()}
            {activeTab === 'all' && renderFriendsActivity()}
            {(activeTab === 'all' && recommendations.length > 0) && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="star" size={20} color="#3797EF" />
                  <Text style={styles.sectionTitle}>Recommended for You</Text>
                </View>
              </View>
            )}
          </View>
        )}
        contentContainerStyle={[
          styles.listContent,
          displayData.length === 0 && styles.emptyList
        ]}
      />
    );
  };

  return (
    <View style={styles.container}>
      {renderTabBar()}
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#3797EF',
    fontWeight: '600',
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
  },
  horizontalList: {
    paddingHorizontal: 16,
  },
  friendActivityCard: {
    marginRight: 16,
    position: 'relative',
  },
  activityBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activityBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  recommendationCard: {
    marginBottom: 16,
    position: 'relative',
  },
  recommendationBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recommendationReason: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '500',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyList: {
    flexGrow: 1,
  },
});