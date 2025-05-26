// navigation/FeedStack.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import FeedScreen        from '../screens/FeedScreen';
import PostDetailsScreen from '../screens/PostDetailsScreen';
import CreateEventScreen from '../screens/CreateEventScreen';
import CreatePostScreen  from '../screens/CreatePostScreen';
import ProfileScreen     from '../screens/ProfileScreen';
import EventDetailsScreen  from '../screens/EventDetailsScreen'; 
const Stack = createStackNavigator();

export default function FeedStack() {
  return (
    <Stack.Navigator initialRouteName="Feed"  screenOptions={{ headerShown:false }}>
      <Stack.Screen
        name="Feed"                   // ← initial route
        component={FeedScreen}
      />
      <Stack.Screen name="EventDetails" component={EventDetailsScreen} />
      <Stack.Screen
        name="PostDetailsScreen"
        component={PostDetailsScreen}
      />
      <Stack.Screen
        name="CreateEvent"
        component={CreateEventScreen}
      />
      <Stack.Screen
        name="CreatePostScreen"
        component={CreatePostScreen}
      />
      <Stack.Screen
        name="ProfileScreen"
        component={ProfileScreen}
      />
    </Stack.Navigator>
  );
}