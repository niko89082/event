// navigation/EventStack.js

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Import your event screens
import EventListScreen from '../screens/EventListScreen';
import EventDetailsScreen from '../screens/EventDetailsScreen';
import CreateEventScreen from '../screens/CreateEventScreen';

// If you want to handle event-based scanning here too:
import QrScanScreen from '../screens/QrScanScreen';

// If you want user profile from inside events:
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createStackNavigator();

export default function EventStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="EventList"
        component={EventListScreen}
        options={{ title: 'Events' }}
      />
      <Stack.Screen
        name="EventDetails"
        component={EventDetailsScreen}
        options={{ title: 'Event Details' }}
      />
      <Stack.Screen
        name="CreateEventScreen"
        component={CreateEventScreen}
        options={{ title: 'Create Event' }}
      />
      {/* If you want scanning from within the events stack */}
      <Stack.Screen
        name="QrScanScreen"
        component={QrScanScreen}
        options={{ title: 'Scan' }}
      />
      {/* If you want user profiles from within events */}
      <Stack.Screen
        name="ProfileScreen"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Stack.Navigator>
  );
}