// navigation/MainTabNavigator.js - Updated with only 3 tabs
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

// Tab Screens
import FeedScreen from '../screens/FeedScreen';
import ProfileScreen from '../screens/ProfileScreen';

// Create Screens
import CreatePickerScreen from '../screens/CreatePickerScreen';
import CreateEventScreen from '../screens/CreateEventScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import CreateMemoryScreen from '../screens/CreateMemoryScreen';
import PostPublishedScreen from '../screens/PostPublishedScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Profile Stack Navigator (for the Profile tab)
function ProfileStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen 
        name="MyProfile" 
        component={ProfileScreen}
        // Pass no userId to ProfileScreen to show current user's profile
        initialParams={{ userId: null }}
      />
    </Stack.Navigator>
  );
}

// Create Stack Navigator
function CreateStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CreatePicker" component={CreatePickerScreen} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ headerShown: true, title: 'New Event' }} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} />
      <Stack.Screen name="CreateMemory" component={CreateMemoryScreen} options={{ headerShown: true }} />
      <Stack.Screen name="PostPublished" component={PostPublishedScreen} options={{ gestureEnabled: false }} />
    </Stack.Navigator>
  );
}

export default function MainTabNavigator({ onLogout }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Feed':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Create':
              iconName = focused ? 'add-circle' : 'add-circle-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3797EF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0.33,
          borderTopColor: '#E1E1E1',
          paddingTop: 8,
          paddingBottom: 8,
          height: 84, // Proper height for iPhone with home indicator
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
        },
        headerShown: false, // Individual screens handle their own headers
      })}
    >
      <Tab.Screen 
        name="Feed" 
        component={FeedScreen}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      
      <Tab.Screen 
        name="Create" 
        component={CreateStackNavigator}
        options={{
          tabBarLabel: 'Create',
        }}
      />
      
      <Tab.Screen 
        name="Profile" 
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}