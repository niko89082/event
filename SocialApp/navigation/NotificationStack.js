import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import NotificationScreen from '../screens/NotificationScreen';
import NotificationExamplesScreen from '../screens/NotificationExamplesScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createStackNavigator();

export default function NotificationStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="Notifications"
        component={NotificationScreen}
      />
      <Stack.Screen 
        name="NotificationExamples"
        component={NotificationExamplesScreen}
        options={{
          headerShown: false,
          title: 'Notification Examples'
        }}
      />
      <Stack.Screen 
        name="ProfileScreen"
        component={ProfileScreen}
      />
    </Stack.Navigator>
  );
}