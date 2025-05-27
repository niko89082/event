// components/HomeFeedTabs.js
import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import PostsFeed   from './PostsFeed';
import EventsFeed  from './EventsFeed';

const Tab = createMaterialTopTabNavigator();

export default function HomeFeedTabs() {
  console.log('🟡 HomeFeedTabs: Rendering');
  
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
      <Tab.Screen name="Posts" component={PostsFeed} />
      <Tab.Screen name="Events" component={EventsFeed} />
    </Tab.Navigator>
  );
}