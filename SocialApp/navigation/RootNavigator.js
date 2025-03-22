// navigation/RootNavigator.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import MainTabNavigator from './MainTabNavigator';

// Import “common” screens only once here:
import ProfileScreen from '../screens/ProfileScreen';
import CommentsScreen from '../screens/CommentsScreen';
import FollowListScreen from '../screens/FollowListScreen';
import UserSettingsScreen from '../screens/UserSettingsScreen';

const RootStack = createStackNavigator();

export default function RootNavigator({ onLogout }) {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {/* 1) MainTabNavigator is the default “home” route */}
      <RootStack.Screen
        name="MainTabs"
        // pass onLogout if your tabs need it
        children={(props) => <MainTabNavigator {...props} onLogout={onLogout} />}
      />

      {/* 2) Common screens that ANY stack can navigate to directly */}
      <RootStack.Screen
        name="ProfileScreen"
        component={ProfileScreen}
        options={{ headerShown: true, title: 'Profile' }}
      />
      <RootStack.Screen
        name="CommentsScreen"
        component={CommentsScreen}
        options={{ headerShown: true, title: 'Comments' }}
      />
      <RootStack.Screen
        name="FollowListScreen"
        component={FollowListScreen}
        options={{ headerShown: true, title: 'Followers/Following' }}
      />
      <RootStack.Screen
        name="UserSettingsScreen"
        component={UserSettingsScreen}
        options={{ headerShown: true, title: 'Settings' }}
      />

      {/* Add more “global” screens here if you want */}
    </RootStack.Navigator>
  );
}