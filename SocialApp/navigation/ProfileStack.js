// navigation/ProfileStack.js - FIXED NAVIGATION SETUP
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import ProfileScreen                 from '../screens/ProfileScreen';
import FollowListScreen              from '../screens/FollowListScreen';
import UserSettingsScreen            from '../screens/UserSettingsScreen';
import SelectShareableEventsScreen   from '../screens/SelectShareableEventsScreen';
import EditProfileScreen             from '../screens/EditProfileScreen';
import PostDetailsScreen             from '../screens/PostDetailsScreen';
import QrScreen                      from '../screens/QrScreen';

const Stack = createStackNavigator();

export default function ProfileStack({ onLogout }) {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        // FIXED: Always show header, ProfileScreen will handle its own header setup
        headerShown: true,
        headerStyle: {
          backgroundColor: '#FFFFFF',
          shadowOpacity: 0,
          elevation: 0,
          borderBottomWidth: 0.5,
          borderBottomColor: '#E1E1E1',
        },
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
          color: '#000000',
        },
        headerTintColor: '#000000',
        headerBackTitleVisible: false,
      }}
    >
      {/* Main Profile Screen - Let it handle its own header */}
      <Stack.Screen
        name="ProfileScreen"
        options={{
          // FIXED: Let ProfileScreen handle its own header completely
          headerShown: true,
        }}
      >
        {(props) => <ProfileScreen {...props} onLogout={onLogout} />}
      </Stack.Screen>

      {/* People & Settings Screens */}
      <Stack.Screen 
        name="FollowListScreen" 
        component={FollowListScreen}
        options={{
          title: 'Connections',
          headerShown: true,
        }}
      />
      
      <Stack.Screen 
        name="UserSettingsScreen" 
        component={UserSettingsScreen}
        options={{
          title: 'Settings',
          headerShown: true,
        }}
      />
      
      <Stack.Screen 
        name="SelectShareableEventsScreen" 
        component={SelectShareableEventsScreen}
        options={{
          title: 'Share Events',
          headerShown: true,
        }}
      />
      
      <Stack.Screen 
        name="EditProfileScreen" 
        component={EditProfileScreen}
        options={{
          title: 'Edit Profile',
          headerShown: true,
        }}
      />

      {/* Content Detail Screens */}
      <Stack.Screen 
        name="PostDetailsScreen" 
        component={PostDetailsScreen}
        options={{
          title: 'Post',
          headerShown: true,
        }}
      />
      
      <Stack.Screen 
        name="QrScreen" 
        component={QrScreen}
        options={{
          // QrScreen has its own custom header
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}