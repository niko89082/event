// components/EmptyStates/NoFriendsEmptyState.js - Empty State for New Users
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
export default function NoFriendsEmptyState({ navigation }) {
  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="people-outline" size={64} color="#C7C7CC" />
        </View>
        <Text style={styles.title}>Find Your First Friends</Text>
        <Text style={styles.subtitle}>
          Connect with friends to see their activities and discover events together
        </Text>
      </View>
      
      {/* Action Button */}
      <TouchableOpacity 
        style={styles.createEventButton}
        onPress={() => navigation.navigate('SearchScreen', { tab: 'users' })}
        activeOpacity={0.8}
      >
        <Ionicons name="search" size={18} color="#3797EF" />
        <Text style={styles.createEventButtonText}>Find Friends</Text>
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
    paddingHorizontal: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  header: {
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingBottom: 24,
  },
  
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
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
    marginBottom: 32,
  },
  
  createEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: 'rgba(55, 151, 239, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(55, 151, 239, 0.3)',
    marginTop: 0,
  },
  
  createEventButtonText: {
    fontSize: 15,
    color: '#3797EF',
    marginLeft: 8,
    fontWeight: '600',
  },
});
