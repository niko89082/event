// components/EventsHub.js - NEW events discovery hub
import React, { useState, useContext } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext';
import FollowingEventsFeed from './FollowingEventsFeed';
import RecommendedEventsFeed from './RecommendedEventsFeed';
import NearbyEventsFeed from './NearbyEventsFeed';
import CategoryEventsBrowser from './CategoryEventsBrowser';
import UserEventsList from './UserEventsList';

const EVENTS_TABS = [
  { key: 'following', label: 'Following', icon: 'people-outline' },
  { key: 'for-you', label: 'For You', icon: 'star-outline' },
  { key: 'nearby', label: 'Nearby', icon: 'location-outline' },
  { key: 'browse', label: 'Browse', icon: 'grid-outline' },
  { key: 'your-events', label: 'Your Events', icon: 'person-outline' }
];

export default function EventsHub({ navigation }) {
  const { currentUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('following');

  const renderTab = ({ item }) => {
    const isActive = activeTab === item.key;
    
    return (
      <TouchableOpacity
        style={[styles.tab, isActive && styles.activeTab]}
        onPress={() => setActiveTab(item.key)}
        activeOpacity={0.8}
      >
        <Ionicons 
          name={item.icon} 
          size={16} 
          color={isActive ? '#FFFFFF' : '#8E8E93'} 
        />
        <Text style={[
          styles.tabText,
          isActive && styles.activeTabText
        ]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'following':
        return (
          <FollowingEventsFeed 
            navigation={navigation}
            currentUserId={currentUser?._id}
          />
        );
      
      case 'for-you':
        return (
          <RecommendedEventsFeed 
            navigation={navigation}
            currentUserId={currentUser?._id}
          />
        );
      
      case 'nearby':
        return (
          <NearbyEventsFeed 
            navigation={navigation}
            currentUserId={currentUser?._id}
          />
        );
      
      case 'browse':
        return (
          <CategoryEventsBrowser 
            navigation={navigation}
            currentUserId={currentUser?._id}
          />
        );
      
      case 'your-events':
        return (
          <UserEventsList 
            navigation={navigation}
            currentUserId={currentUser?._id}
          />
        );
      
      default:
        return <FollowingEventsFeed navigation={navigation} currentUserId={currentUser?._id} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <FlatList
          data={EVENTS_TABS}
          renderItem={renderTab}
          keyExtractor={item => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContent}
        />
      </View>
      
      {/* Content */}
      <View style={styles.content}>
        {renderTabContent()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  tabBarContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
  },
  activeTab: {
    backgroundColor: '#3797EF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
});

