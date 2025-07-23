// components/HomeFeedTabs.js - CORRECTED: Updated with ActivityFeed
import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import ActivityFeed from './ActivityFeed'; // ✅ CHANGED: Import ActivityFeed instead of PostsFeed
import EventsFeed  from './EventsFeed';

const Tab = createMaterialTopTabNavigator();

export default function HomeFeedTabs() {
  console.log('🟡 HomeFeedTabs: Rendering with ActivityFeed');
  
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarIndicatorStyle: {
          backgroundColor: '#000000',
          height: 2,
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 16,
          fontWeight: '600',
          textTransform: 'none',
        },
      }}
    >
      <Tab.Screen 
        name="Activity" 
        component={ActivityFeed} // ✅ CHANGED: Use ActivityFeed component
        options={{
          tabBarLabel: 'Activity', // ✅ CHANGED: Changed label from "Posts" to "Activity"
        }}
      />
      <Tab.Screen 
        name="Events" 
        component={EventsFeed}
        options={{
          tabBarLabel: 'Events',
        }}
      />
    </Tab.Navigator>
  );
}