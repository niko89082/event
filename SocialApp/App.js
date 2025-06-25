// App.js - Fixed with proper NotificationScreen navigation
import React, { useContext, useEffect } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StripeProvider } from '@stripe/stripe-react-native';
import { AuthContext, AuthProvider } from './services/AuthContext';

import LoginScreen from './screens/Auth/LoginScreen';
import RegisterScreen from './screens/Auth/RegisterScreen';

import MainTabNavigator from './navigation/MainTabNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Global Screens (accessible from anywhere)
import CreateMemoryScreen from './screens/CreateMemoryScreen';
import ProfileScreen from './screens/ProfileScreen';
import FollowListScreen from './screens/FollowListScreen';
import UserSettingsScreen from './screens/UserSettingsScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import SearchScreen from './screens/SearchScreen';
import EventDetailsScreen from './screens/EventDetailsScreen';
import PostDetailsScreen from './screens/PostDetailsScreen';
import CreateEventScreen from './screens/CreateEventScreen';
import CreatePostScreen from './screens/CreatePostScreen';
import CreatePickerScreen from './screens/CreatePickerScreen';
import PostPublishedScreen from './screens/PostPublishedScreen';
import QrScreen from './screens/QrScreen';
import QrScanScreen from './screens/QrScanScreen';
import AttendeeListScreen from './screens/AttendeeListScreen';
import EditEventScreen from './screens/EditEventScreen';
import CalendarScreen from './screens/CalendarScreen';
import MemoryDetailsScreen from './screens/MemoryDetailsScreen';
import InviteUsersScreen from './screens/InviteUsersScreen';
import NotificationScreen from './screens/NotificationScreen';

import ErrorBoundary from './components/ErrorBoundary';
import { PUBLISHABLE_KEY, API_BASE_URL } from '@env';
import { palette } from './theme'; 
import { StatusBar } from 'react-native';

// Environment check
if (!API_BASE_URL) {
  console.error('❌ API_BASE_URL is not defined in .env file');
}
if (!PUBLISHABLE_KEY) {
  console.error('❌ PUBLISHABLE_KEY is not defined in .env file');
}

console.log('🟡 App: Environment loaded', {
  API_BASE_URL,
  hasPublishableKey: !!PUBLISHABLE_KEY
});

const RootStack = createStackNavigator();

function AppNavigator({ onLogout }) {
  const { currentUser, loading } = useContext(AuthContext);

  console.log('🟡 App: Current user state', { 
    hasUser: !!currentUser, 
    loading,
    userId: currentUser?._id 
  });

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#666' }}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {currentUser ? (
          // Authenticated Stack
          <>
            <RootStack.Screen
              name="MainTabs"
              children={(props) => <MainTabNavigator {...props} onLogout={onLogout} />}
            />
            
            {/* Global Screens - accessible from anywhere in the app */}
            <RootStack.Screen 
              name="ProfileScreen" 
              component={ProfileScreen}
              options={{ 
                headerShown: true,
                title: 'Profile',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#000000'
              }}
            />
            <RootStack.Screen 
              name="NotificationScreen" 
              component={NotificationScreen}
              options={{ 
                headerShown: true,
                title: 'Notifications',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#000000'
              }}
            />
            <RootStack.Screen 
              name="SearchScreen" 
              component={SearchScreen}
              options={{ 
                headerShown: true,
                title: 'Search',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#000000'
              }}
            />
            <RootStack.Screen 
              name="EventDetailsScreen" 
              component={EventDetailsScreen}
              options={{ headerShown: false }}
            />
            <RootStack.Screen 
              name="PostDetailsScreen" 
              component={PostDetailsScreen}
              options={{ 
                headerShown: true,
                title: 'Post',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#000000'
              }}
            />
            <RootStack.Screen 
              name="CreateEventScreen" 
              component={CreateEventScreen}
              options={{ 
                headerShown: true,
                title: 'Create Event',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#000000'
              }}
            />
            <RootStack.Screen 
              name="EditEventScreen" 
              component={EditEventScreen}
              options={{ 
                headerShown: true,
                title: 'Edit Event',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#000000'
              }}
            />
            <RootStack.Screen 
              name="CreatePostScreen" 
              component={CreatePostScreen}
              options={{ headerShown: false }}
            />
            <RootStack.Screen 
              name="CreatePickerScreen" 
              component={CreatePickerScreen}
              options={{ headerShown: false }}
            />
            <RootStack.Screen 
              name="PostPublishedScreen" 
              component={PostPublishedScreen}
              options={{ headerShown: false, gestureEnabled: false }}
            />
            <RootStack.Screen 
              name="CreateMemoryScreen" 
              component={CreateMemoryScreen}
              options={{ 
                headerShown: true,
                title: 'Create Memory',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#000000'
              }}
            />
            <RootStack.Screen 
              name="MemoryDetailsScreen" 
              component={MemoryDetailsScreen}
              options={{ 
                headerShown: true,
                title: 'Memory',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#000000'
              }}
            />
            <RootStack.Screen 
              name="QrScreen" 
              component={QrScreen}
              options={{ 
                headerShown: true,
                title: 'My QR Code',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#000000'
              }}
            />
            <RootStack.Screen 
              name="QrScanScreen" 
              component={QrScanScreen}
              options={{ 
                headerShown: true,
                title: 'Scan QR',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#000000'
              }}
            />
            <RootStack.Screen 
              name="AttendeeListScreen" 
              component={AttendeeListScreen}
              options={{ 
                headerShown: true,
                title: 'Attendees',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#000000'
              }}
            />
            <RootStack.Screen 
              name="InviteUsersScreen" 
              component={InviteUsersScreen}
              options={{ 
                headerShown: true,
                title: 'Invite Friends',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#000000'
              }}
            />
            <RootStack.Screen 
              name="CalendarScreen" 
              component={CalendarScreen}
              options={{ 
                headerShown: true,
                title: 'Calendar',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#000000'
              }}
            />
            <RootStack.Screen 
              name="FollowListScreen" 
              component={FollowListScreen}
              options={{ 
                headerShown: true,
                title: 'Connections',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#000000'
              }}
            />
            <RootStack.Screen 
              name="UserSettingsScreen" 
              component={UserSettingsScreen}
              options={{ 
                headerShown: true,
                title: 'Settings',
                headerStyle: { backgroundColor: '#FFFFFF' },
                headerTintColor: '#000000'
              }}
            />
            <RootStack.Screen 
              name="EditProfileScreen" 
              component={EditProfileScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          // Unauthenticated Stack
          <>
            <RootStack.Screen 
              name="Login" 
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <RootStack.Screen 
              name="Register" 
              component={RegisterScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StripeProvider publishableKey={PUBLISHABLE_KEY}>
          <AuthProvider>
            <AppNavigator onLogout={() => console.log('Logout requested')} />
          </AuthProvider>
        </StripeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}