// navigation/MainTabNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import FeedStack from './FeedStack';
import QrStack from './QrStack';
import ChatStack from './ChatStack';
import SearchStack from './SearchStack';
import ProfileStack from './ProfileStack';
import EventStack from './EventStack'; // <-- import your new stack
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator({ onLogout }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          switch (route.name) {
            case 'FeedTab':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'SearchTab':
              iconName = focused ? 'search' : 'search-outline';
              break;
            case 'QRTab':
              iconName = focused ? 'qr-code' : 'qr-code-outline';
              break;
            case 'ChatTab':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'ProfileTab':
              iconName = focused ? 'person' : 'person-outline';
              break;
            case 'EventsTab':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      {/* Existing tabs */}
      <Tab.Screen
        name="FeedTab"
        component={FeedStack}
        options={{ title: 'Feed' }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchStack}
        options={{ title: 'Search' }}
      />
      <Tab.Screen
        name="QRTab"
        component={QrStack}
        options={{ title: 'QR' }}
      />
      <Tab.Screen
        name="ChatTab"
        component={ChatStack}
        options={{ title: 'Chat' }}
      />
      <Tab.Screen
        name="EventsTab"
        component={EventStack} // <-- add your new stack here
        options={{ title: 'Events' }}
      />
      {/* For "ProfileTab", pass onLogout */}
      <Tab.Screen
        name="ProfileTab"
        options={{ title: 'Profile' }}
      >
        {() => <ProfileStack onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}