import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import PostsFeed   from './PostsFeed';
import EventsFeed  from './EventsFeed';

const Tab = createMaterialTopTabNavigator();

export default function HomeFeedTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Posts"  component={PostsFeed} />
      <Tab.Screen name="Events" component={EventsFeed} />
    </Tab.Navigator>
  );
}