// components/events/EventsTabBar.js - Horizontal tab bar for Events screen
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const TABS = [
  { key: 'friends', label: 'Friends' },
  { key: 'for-you', label: 'For You' },
  { key: 'attending', label: 'Attending' },
  { key: 'hosting', label: 'Hosting' },
];

// Map tab keys to API endpoints/feed types
export const TAB_FEED_MAP = {
  'friends': 'following',
  'for-you': 'discover',
  'attending': 'attending',
  'hosting': 'hosting',
};

export default function EventsTabBar({ activeTab, onTabChange }) {
  return (
    <View style={styles.tabBarContainer}>
      {TABS.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={styles.tabButton}
          onPress={() => onTabChange(tab.key)}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.tabText,
            activeTab === tab.key && styles.tabTextActive
          ]}>
            {tab.label}
          </Text>
          {activeTab === tab.key && (
            <View style={styles.tabIndicator} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 8,
    marginTop: 0,
    paddingTop: 2,
    paddingBottom: 0,
    minHeight: 36,
    backgroundColor: '#FFFFFF',
  },
  
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingTop: 4,
    paddingBottom: 0,
  },
  
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.015,
    color: '#8E8E93',
    marginBottom: 6,
  },
  
  tabTextActive: {
    color: '#3797EF',
  },
  
  tabIndicator: {
    height: 3,
    width: '100%',
    backgroundColor: '#3797EF',
    borderRadius: 2,
    marginTop: 0,
  },
});

