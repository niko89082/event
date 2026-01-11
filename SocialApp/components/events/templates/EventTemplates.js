// components/events/templates/EventTemplates.js - Template components for testing
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FeaturedEventsSection from '../FeaturedEventsSection';
import EventsFeedSection from '../EventsFeedSection';
import { getMockFeaturedEvents, getMockFeedEvents } from './MockEventData';

/**
 * Template component that renders mock featured events
 * Use this for testing the UI without creating real events
 */
export function FeaturedEventsTemplate({ navigation }) {
  return (
    <FeaturedEventsSection 
      navigation={navigation} 
      useMockData={true}
    />
  );
}

/**
 * Template component that renders mock feed events
 * Use this for testing the UI without creating real events
 */
export function FeedEventsTemplate({ navigation, activeTab }) {
  return (
    <EventsFeedSection
      navigation={navigation}
      activeTab={activeTab}
      useMockData={true}
    />
  );
}

/**
 * Helper to toggle between mock and real data
 * Set USE_MOCK_EVENTS=true in your environment or pass as prop
 */
export function useMockEvents() {
  // Check environment variable or return false by default
  // In development, you can set this to true
  return process.env.USE_MOCK_EVENTS === 'true' || false;
}


