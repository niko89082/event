// navigation/MainTabNavigator.js - Reverted to correct 5-tab structure
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

// Screen imports
import FeedScreen from '../screens/FeedScreen';
import ConversationListScreen from '../screens/ConversationListScreen';
import CreatePickerScreen from '../screens/CreatePickerScreen';
import NotificationScreen from '../screens/NotificationScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Home Stack
function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="FeedMain" 
        component={FeedScreen} 
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// Chat Stack
function ChatStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="ConversationList" 
        component={ConversationListScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// Create Stack
function CreateStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="CreatePicker" 
        component={CreatePickerScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// Notifications Stack
function NotificationsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="NotificationMain" 
        component={NotificationScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// Profile Stack
function ProfileStack({ onLogout }) {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="ProfileMain" 
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

export default function MainTabNavigator({ onLogout }) {
  console.log('🟡 MainTabNavigator: Rendering 5 tabs (Home, Chat, Create, Notifications, Profile)');

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Chat':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'Create':
              iconName = focused ? 'add-circle' : 'add-circle-outline';
              size = focused ? 32 : 28; // Make create button slightly larger
              break;
            case 'Notifications':
              iconName = focused ? 'notifications' : 'notifications-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'circle';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3797EF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0.33,
          borderTopColor: '#E1E1E1',
          paddingTop: 6,
          paddingBottom: 6,
          height: 54, // Reduced height to bring navigation up
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
          marginBottom: 2,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeStack}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      
      <Tab.Screen 
        name="Chat" 
        component={ChatStack}
        options={{
          tabBarLabel: 'Chat',
        }}
      />
      
      <Tab.Screen 
        name="Create" 
        component={CreateStack}
        options={{
          tabBarLabel: 'Create',
        }}
      />
      
      <Tab.Screen 
        name="Notifications" 
        component={NotificationsStack}
        options={{
          tabBarLabel: 'Notifications',
        }}
      />
      
      <Tab.Screen 
        name="Profile" 
        options={{
          tabBarLabel: 'Profile',
        }}
      >
        {(props) => <ProfileStack {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}