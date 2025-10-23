// navigation/SearchStack.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import SearchScreen from '../screens/SearchScreen';
import ProfileScreen from '../screens/ProfileScreen'; // Use the universal ProfileScreen
import FollowListScreen from '../screens/FollowListScreen';
import CategoryEventsScreen from '../screens/CategoryEventsScreen'; // ✅ Added for View More
import EventDetailsScreen from '../screens/EventDetailsScreen'; // ✅ Added for event navigation
const Stack = createStackNavigator();

export default function SearchStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="SearchScreen"
        component={SearchScreen}
        options={{ title: 'Search' }}
      />
      <Stack.Screen
        name="ProfileScreen"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
      <Stack.Screen name="FollowListScreen" component={FollowListScreen} />
      {/* ✅ Added CategoryEventsScreen for "View More" functionality */}
      <Stack.Screen 
        name="CategoryEventsScreen" 
        component={CategoryEventsScreen}
        options={{ headerShown: true }}
      />
      {/* ✅ Added EventDetailsScreen for event navigation */}
      <Stack.Screen 
        name="EventDetailsScreen" 
        component={EventDetailsScreen}
        options={{ headerShown: true }}
      />
    </Stack.Navigator>
  );
}