// components/EmptyStates/NoActivityEmptyStateRedesigned.js - Instagram-style Empty State
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FriendRecommendationsRedesigned from '../FriendRecommendationsRedesigned';
import EventDiscoverySuggestions from '../EventDiscoverySuggestions';

export default function NoActivityEmptyStateRedesigned({ navigation }) {
  return (
    <ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Main Empty State */}
      <View style={styles.emptyStateContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name="flash-outline" size={48} color="#8E8E93" />
        </View>
        
        <Text style={styles.title}>No Recent Activity</Text>
        <Text style={styles.subtitle}>
          Check back soon for updates from your friends
        </Text>
      </View>
      
      {/* Friend Recommendations - Full Width */}
      <FriendRecommendationsRedesigned 
        navigation={navigation}
        displayMode="empty"
        onFriendAdded={(user) => {
          console.log('🎉 Friend added from empty state:', user.username);
        }}
      />
      
      {/* Event Discovery */}
      <EventDiscoverySuggestions navigation={navigation} />
      
      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  
  scrollContent: {
    paddingTop: 40,
    paddingBottom: 20,
  },
  
  emptyStateContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 32,
  },
  
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  
  actionButtonsContainer: {
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
    paddingVertical: 16,
    borderRadius: 12,
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
    paddingVertical: 16,
    borderRadius: 12,
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
