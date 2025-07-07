// App.js - Complete file with deep link handling
import React, { useContext, useEffect } from 'react';
import { View, Text, ActivityIndicator, Alert, Linking } from 'react-native';
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
import EditMemoryScreen from './screens/EditMemoryScreen';
import MemoryParticipantsScreen from './screens/MemoryParticipantsScreen';
import InviteUsersScreen from './screens/InviteUsersScreen';
import NotificationScreen from './screens/NotificationScreen';
import PaymentSettingsScreen from './screens/PaymentSettingsScreen';
import ErrorBoundary from './components/ErrorBoundary';
import FormBuilderScreen from './screens/FormBuilderScreen';
import FormLibraryScreen from './screens/FormLibraryScreen';
import PostLikesScreen from './screens/PostsLikesScreen';
import FormSubmissionScreen from './screens/FormSubmissionScreen';
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

  // 🔧 ADD: Deep link handling for payment returns
  useEffect(() => {
    const handleDeepLink = (url) => {
      console.log('🔗 Deep link received:', url);
      
      if (url.includes('/payment/success')) {
        console.log('✅ Payment success detected from deep link');
        // Store payment success state for EventDetailsScreen to pick up
        // You can use AsyncStorage or a global state manager for this
        Alert.alert(
          'Payment Successful!',
          'Your payment has been processed successfully. Returning to event...',
          [{ text: 'OK' }]
        );
      } else if (url.includes('/payment/cancel')) {
        console.log('❌ Payment cancelled detected from deep link');
        Alert.alert(
          'Payment Cancelled',
          'Your payment was cancelled.',
          [{ text: 'OK' }]
        );
      }
    };

    // Listen for deep links when app is already open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('🔗 App opened with deep link:', url);
        handleDeepLink(url);
      }
    });

    return () => subscription?.remove();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={palette.primary || '#3797EF'} />
        <Text style={{ marginTop: 16, color: palette.textSecondary || '#8E8E93' }}>Loading...</Text>
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
            <RootStack.Screen 
              name="PostLikesScreen" 
              component={PostLikesScreen}
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
              name="FormSubmissionScreen" 
              component={FormSubmissionScreen}
              options={{ headerShown: true, title: 'Form' }}
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
            <RootStack.Screen 
              name="EditMemoryScreen" 
              component={EditMemoryScreen}
              options={{ headerShown: true, title: 'Edit Memory' }}
            />
            <RootStack.Screen 
              name="FormBuilderScreen" 
              component={FormBuilderScreen}
              options={{ headerShown: true, title: 'Create Form' }}
            />
            <RootStack.Screen 
              name="FormLibraryScreen" 
              component={FormLibraryScreen}
              options={{ headerShown: true, title: 'Select Form' }}
            />
            <RootStack.Screen 
              name="PaymentSettings" 
              component={PaymentSettingsScreen}
              options={{
                headerTitle: 'Payment Settings',
                headerBackTitleVisible: false,
              }}
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