// screens/FeedScreen.js
import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import PostsFeed  from '../components/PostsFeed';
import EventsFeed from '../components/EventsFeed';

const Tab = createMaterialTopTabNavigator();

export default function FeedScreen() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Posts"  component={PostsFeed}/>
      <Tab.Screen name="Events" component={EventsFeed}/>
    </Tab.Navigator>
  );
}