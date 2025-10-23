// components/EmptyStates/NoFriendsEmptyState.js - Empty State for New Users
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FriendRecommendations from '../FriendRecommendations';

export default function NoFriendsEmptyState({ navigation }) {
  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <Ionicons name="people-outline" size={64} color="#8E8E93" />
        <Text style={styles.title}>Find Your First Friends</Text>
        <Text style={styles.subtitle}>
          Connect with friends to see their activities and discover events together
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
      
      {/* Action Button */}
      <TouchableOpacity 
        style={styles.actionButton}
        onPress={() => navigation.navigate('SearchScreen', { tab: 'users' })}
        activeOpacity={0.8}
      >
        <Ionicons name="search" size={20} color="#FFFFFF" />
        <Text style={styles.actionButtonText}>Find Friends</Text>
      </TouchableOpacity>
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
    paddingBottom: 32,
  },
  
  title: {
    fontSize: 24,
    fontWeight: '700',
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
  
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3797EF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    marginHorizontal: 40,
    gap: 8,
    shadowColor: '#3797EF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
