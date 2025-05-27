// navigation/MainTabNavigator.js - Fixed version
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, TouchableOpacity } from 'react-native';

// Import your screens
import FeedScreen from '../screens/FeedScreen';
import ConversationListScreen from '../screens/ConversationListScreen';
import ChatScreen from '../screens/ChatScreen';
import CreatePickerScreen from '../screens/CreatePickerScreen';
import NotificationScreen from '../screens/NotificationScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();
const FeedStack = createStackNavigator();
const ChatStack = createStackNavigator();
const NotificationStack = createStackNavigator();
const ProfileStack = createStackNavigator();

// Feed Stack Navigator
function FeedStackNavigator() {
  return (
    <FeedStack.Navigator>
      <FeedStack.Screen 
        name="FeedMain" 
        component={FeedScreen}
        options={{ headerShown: false }}
      />
    </FeedStack.Navigator>
  );
}

// Chat Stack Navigator
function ChatStackNavigator() {
  return (
    <ChatStack.Navigator>
      <ChatStack.Screen 
        name="ConversationList" 
        component={ConversationListScreen}
        options={{ headerShown: false }}
      />
      <ChatStack.Screen 
        name="ChatScreen" 
        component={ChatScreen}
        options={{ headerShown: false }}
      />
    </ChatStack.Navigator>
  );
}

// Notification Stack Navigator
function NotificationStackNavigator() {
  return (
    <NotificationStack.Navigator>
      <NotificationStack.Screen 
        name="NotificationMain" 
        component={NotificationScreen}
        options={{ headerShown: false }}
      />
    </NotificationStack.Navigator>
  );
}

// Profile Stack Navigator
function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen 
        name="ProfileMain" 
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
    </ProfileStack.Navigator>
  );
}

// Custom Create Button
function CreateButton({ onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#3797EF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
      }}
    >
      <Ionicons name="add" size={28} color="white" />
    </TouchableOpacity>
  );
}

export default function MainTabNavigator({ navigation, onLogout }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Messages') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Create') {
            return null; // We'll handle this separately
          } else if (route.name === 'Notifications') {
            iconName = focused ? 'heart' : 'heart-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3797EF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0.5,
          borderTopColor: '#E1E1E1',
          height: 80,
          paddingBottom: 20,
          paddingTop: 10,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={FeedStackNavigator}
      />
      <Tab.Screen 
        name="Messages" 
        component={ChatStackNavigator}
      />
      <Tab.Screen 
        name="Create" 
        component={CreatePickerScreen}
        options={{
          tabBarButton: (props) => (
            <View style={{ flex: 1, alignItems: 'center' }}>
              <CreateButton 
                onPress={() => navigation.navigate('Create')}
              />
            </View>
          ),
        }}
      />
      <Tab.Screen 
        name="Notifications" 
        component={NotificationStackNavigator}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileStackNavigator}
      />
    </Tab.Navigator>
  );
}