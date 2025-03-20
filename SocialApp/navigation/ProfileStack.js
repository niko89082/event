// navigation/ProfileStack.js

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ProfileScreen from '../screens/ProfileScreen';
import FollowListScreen from '../screens/FollowListScreen';
import UserSettingsScreen from '../screens/UserSettingsScreen';

const Stack = createStackNavigator();

export default function ProfileStack({ onLogout }) {
  return (
    <Stack.Navigator>
      {/* Use a single route name "ProfileScreen" */}
      <Stack.Screen
        name="ProfileScreen"
        // pass onLogout if needed
        children={(props) => <ProfileScreen {...props} onLogout={onLogout} />}
      />

      <Stack.Screen name="FollowListScreen" component={FollowListScreen} />
      <Stack.Screen name="UserSettingsScreen" component={UserSettingsScreen} />

      {/* Remove or comment out the old line:
         <Stack.Screen name="UserProfileScreen" component={UserProfileScreen} />
       */}
    </Stack.Navigator>
  );
}