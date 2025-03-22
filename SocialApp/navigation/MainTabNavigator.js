// navigation/MainTabNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Import your sub‐stacks
import FeedStack from './FeedStack';
import SearchStack from './SearchStack';
import QrStack from './QrStack';
import ChatStack from './ChatStack';
import ProfileStack from './ProfileStack';
import EventStack from './EventStack';

import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator({ onLogout }) {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="FeedTab"
        component={FeedStack}
        options={{ title: 'Feed', tabBarIcon: makeIcon('home') }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchStack}
        options={{ title: 'Search', tabBarIcon: makeIcon('search') }}
      />
      <Tab.Screen
        name="QRTab"
        component={QrStack}
        options={{ title: 'QR', tabBarIcon: makeIcon('qr-code') }}
      />
      <Tab.Screen
        name="ChatTab"
        component={ChatStack}
        options={{ title: 'Chat', tabBarIcon: makeIcon('chatbubbles') }}
      />
      <Tab.Screen
        name="EventsTab"
        component={EventStack}
        options={{ title: 'Events', tabBarIcon: makeIcon('calendar') }}
      />
      <Tab.Screen
        name="ProfileTab"
        // pass onLogout if needed
        children={(props) => <ProfileStack {...props} onLogout={onLogout} />}
        options={{ title: 'Profile', tabBarIcon: makeIcon('person') }}
      />
    </Tab.Navigator>
  );
}

function makeIcon(iconName) {
  return ({ color, size, focused }) => {
    return <Ionicons name={focused ? iconName : iconName + '-outline'} size={size} color={color} />;
  };
}