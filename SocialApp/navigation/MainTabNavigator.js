// navigation/MainTabNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import FeedStack         from './FeedStack';      // Home
import CreateStack       from './CreateStack';    // Big (+) button
import ChatStack         from './ChatStack';
import NotificationStack from './NotificationStack';
import ProfileStack      from './ProfileStack';
import { Ionicons }      from '@expo/vector-icons';
import { palette }       from '../theme';

const Tab = createBottomTabNavigator();

function make(icon) {
  return ({ color, size, focused }) => (
    <Ionicons
      name={focused ? icon : `${icon}-outline`}
      size={size}
      color={color}
    />
  );
}

export default function MainTabNavigator({ onLogout }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.brandBlue,
      }}
    >
      <Tab.Screen
        name="Home"
        component={FeedStack}
        options={{ tabBarIcon: make('home') }}
      />

      <Tab.Screen
        name="ChatTab"
        component={ChatStack}
        options={{ tabBarIcon: make('chatbubbles') }}
      />

      <Tab.Screen
        name="Create"
        component={CreateStack}
        options={{
          tabBarIcon: make('add-circle'),
          tabBarLabel: '',
        }}
      />

      <Tab.Screen
        name="Notifications"
        component={NotificationStack}
        options={{ tabBarIcon: make('notifications') }}
      />

      {/* Profile has to be a render-prop so we can inject onLogout */}
      <Tab.Screen name="Profile">
        {(props) => <ProfileStack {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}