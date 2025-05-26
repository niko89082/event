// navigation/EventStack.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import EventListScreen from '../screens/EventListScreen';
import EventDetailsScreen from '../screens/EventDetailsScreen';
import CreateEventScreen from '../screens/CreateEventScreen';
import QrScanScreen from '../screens/QrScanScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditEventScreen from '../screens/EditEventScreen';
import AttendeeListScreen from '../screens/AttendeeListScreen'; 
import CheckinListScreen from '../screens/CheckinListScreen';     

import CalendarScreen from '../screens/CalendarScreen';
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
      <Stack.Screen
        name="QrScanScreen"
        component={QrScanScreen}
        options={{ title: 'Scan' }}
      />
      <Stack.Screen
        name="ProfileScreen"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
      <Stack.Screen
        name="EditEventScreen"
        component={EditEventScreen}
        options={{ title: 'Edit Event' }}
      />
      <Stack.Screen
        name="AttendeeListScreen"
        component={AttendeeListScreen}
        options={{ title: 'Attendees' }}
      />
      <Stack.Screen
        name="CheckinListScreen"
        component={CheckinListScreen}
        options={{ title: 'Checked In' }}
      />
      <Stack.Screen
      name="CalendarScreen"
      component={CalendarScreen}
      options={{ title: 'My Calendar' }}
    />
    </Stack.Navigator>
  );
}