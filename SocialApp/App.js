// App.js - Add new memory screens to navigation
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
import EditMemoryScreen from './screens/EditMemoryScreen'; // NEW
import MemoryParticipantsScreen from './screens/MemoryParticipantsScreen'; // NEW
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={{ marginTop: 16, color: palette.textSecondary }}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator 
        screenOptions={{
          headerShown: false,
          gestureEnabled: false,
          animation: 'slide_from_right',
        }}
      >
        {currentUser ? (
          <>
            {/* Main App Stack */}
            <RootStack.Screen 
              name="MainApp" 
              component={MainTabNavigator}
              options={{ headerShown: false }}
            />
            
            {/* Global Screens */}
            <RootStack.Screen 
              name="CreateMemoryScreen" 
              component={CreateMemoryScreen}
              options={{ headerShown: true, title: 'Create Memory' }}
            />
            <RootStack.Screen 
              name="ProfileScreen" 
              component={ProfileScreen}
              options={{ headerShown: true, title: 'Profile' }}
            />
            <RootStack.Screen 
              name="FollowListScreen" 
              component={FollowListScreen}
              options={{ headerShown: true }}
            />
            <RootStack.Screen 
              name="UserSettingsScreen" 
              component={UserSettingsScreen}
              options={{ headerShown: true, title: 'Settings' }}
            />
            <RootStack.Screen 
              name="EditProfileScreen" 
              component={EditProfileScreen}
              options={{ headerShown: true, title: 'Edit Profile' }}
            />
            <RootStack.Screen 
              name="SearchScreen" 
              component={SearchScreen}
              options={{ headerShown: true, title: 'Search' }}
            />
            <RootStack.Screen 
              name="EventDetailsScreen" 
              component={EventDetailsScreen}
              options={{ headerShown: true, title: 'Event Details' }}
            />
            <RootStack.Screen 
              name="PostDetailsScreen" 
              component={PostDetailsScreen}
              options={{ headerShown: true, title: 'Post' }}
            />
            <RootStack.Screen 
              name="CreateEventScreen" 
              component={CreateEventScreen}
              options={{ headerShown: true, title: 'Create Event' }}
            />
            <RootStack.Screen 
              name="CreatePostScreen" 
              component={CreatePostScreen}
              options={{ headerShown: true, title: 'New Post' }}
            />
            <RootStack.Screen 
              name="CreatePickerScreen" 
              component={CreatePickerScreen}
              options={{ headerShown: true, title: 'Create' }}
            />
            <RootStack.Screen 
              name="PostPublishedScreen" 
              component={PostPublishedScreen}
              options={{ headerShown: false }}
            />
            <RootStack.Screen 
              name="QrScreen" 
              component={QrScreen}
              options={{ headerShown: false }}
            />
            <RootStack.Screen 
              name="QrScanScreen" 
              component={QrScanScreen}
              options={{ headerShown: true, title: 'Scan QR Code' }}
            />
            <RootStack.Screen 
              name="AttendeeListScreen" 
              component={AttendeeListScreen}
              options={{ headerShown: true, title: 'Attendees' }}
            />
            <RootStack.Screen 
              name="EditEventScreen" 
              component={EditEventScreen}
              options={{ headerShown: true, title: 'Edit Event' }}
            />
            <RootStack.Screen 
              name="CalendarScreen" 
              component={CalendarScreen}
              options={{ headerShown: true, title: 'Calendar' }}
            />
            <RootStack.Screen 
              name="MemoryDetailsScreen" 
              component={MemoryDetailsScreen}
              options={{ headerShown: true, title: 'Memory' }}
            />
            {/* NEW: Memory management screens */}
            <RootStack.Screen 
              name="EditMemoryScreen" 
              component={EditMemoryScreen}
              options={{ headerShown: true, title: 'Edit Memory' }}
            />
            <RootStack.Screen 
              name="MemoryParticipantsScreen" 
              component={MemoryParticipantsScreen}
              options={{ headerShown: true, title: 'Participants' }}
            />
            <RootStack.Screen 
              name="InviteUsersScreen" 
              component={InviteUsersScreen}
              options={{ headerShown: true, title: 'Invite Users' }}
            />
            <RootStack.Screen 
              name="NotificationScreen" 
              component={NotificationScreen}
              options={{ headerShown: true, title: 'Notifications' }}
            />
          </>
        ) : (
          <>
            {/* Auth Stack */}
            <RootStack.Screen 
              name="LoginScreen" 
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <RootStack.Screen 
              name="RegisterScreen" 
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
  useEffect(() => {
    console.log('🟢 App: Component mounted');
  }, []);

  const handleLogout = () => {
    console.log('🔴 App: Logout requested');
  };

  return (
    <ErrorBoundary>
      <StripeProvider publishableKey={PUBLISHABLE_KEY}>
        <SafeAreaProvider>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
          <AuthProvider>
            <AppNavigator onLogout={handleLogout} />
          </AuthProvider>
        </SafeAreaProvider>
      </StripeProvider>
    </ErrorBoundary>
  );
}