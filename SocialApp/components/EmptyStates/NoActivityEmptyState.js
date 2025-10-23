// components/EmptyStates/NoActivityEmptyState.js - Empty State for Users with Friends
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FriendRecommendations from '../FriendRecommendations';
import EventDiscoverySuggestions from '../EventDiscoverySuggestions';

export default function NoActivityEmptyState({ navigation }) {
  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <Ionicons name="flash-outline" size={48} color="#8E8E93" />
        <Text style={styles.title}>No Recent Activity</Text>
        <Text style={styles.subtitle}>
          Check back soon for updates from your friends
        </Text>
      </View>
      
      {/* Friend Recommendations */}
      <FriendRecommendations 
        navigation={navigation}
        displayMode="empty"
        onFriendAdded={(user) => {
          console.log('🎉 Friend added from empty state:', user.username);
        }}
      />
      
      {/* Event Discovery */}
      <EventDiscoverySuggestions navigation={navigation} />
      
      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={() => navigation.navigate('CreateEventScreen')}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Create Event</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('SearchScreen', { tab: 'events' })}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={20} color="#3797EF" />
          <Text style={styles.secondaryButtonText}>Explore Events</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  header: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 24,
  },
  
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  
  actionButtons: {
    paddingHorizontal: 40,
    paddingTop: 20,
    gap: 12,
  },
  
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3797EF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3797EF',
    gap: 8,
  },
  
  secondaryButtonText: {
    color: '#3797EF',
    fontSize: 16,
    fontWeight: '600',
  },
});
