// navigation/FeedStack.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import FeedScreen        from '../screens/FeedScreen';
import FeedTemplateScreen from '../screens/FeedTemplateScreen';
import PostDetailsScreen from '../screens/PostDetailsScreen';
import CreateEventScreen from '../screens/CreateEventScreen';
import CreatePostScreen  from '../screens/CreatePostScreen';
import ProfileScreen     from '../screens/ProfileScreen';
import EventDetailsScreen  from '../screens/EventDetailsScreen';
import MoviePageScreen   from '../screens/MoviePageScreen';
import SongPageScreen    from '../screens/SongPageScreen';
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
      <Stack.Screen
        name="MoviePageScreen"
        component={MoviePageScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SongPageScreen"
        component={SongPageScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="FeedTemplateScreen"
        component={FeedTemplateScreen}
        options={{ 
          headerShown: true,
          title: 'Feed Post Types Template',
          headerBackTitle: 'Back'
        }}
      />
    </Stack.Navigator>
  );
}