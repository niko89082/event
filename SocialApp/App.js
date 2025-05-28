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
import ProfileScreen from './screens/ProfileScreen';
import FollowListScreen from './screens/FollowListScreen';
import UserSettingsScreen from './screens/UserSettingsScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import SearchScreen from './screens/SearchScreen';
import EventDetailsScreen from './screens/EventDetailsScreen';
import PostDetailsScreen from './screens/PostDetailsScreen';
import CreateEventScreen from './screens/CreateEventScreen';
import CreatePostScreen from './screens/CreatePostScreen';
import CreatePickerScreen from './screens/CreatePickerScreen'; // FIXED: Added this import
import PostPublishedScreen from './screens/PostPublishedScreen';
import ChatScreen from './screens/ChatScreen';
import NewChatScreen from './screens/NewChatScreen';
import SelectChatScreen from './screens/SelectChatScreen';
import ChatInfoScreen from './screens/ChatInfoScreen';
import QrScreen from './screens/QrScreen';
import QrScanScreen from './screens/QrScanScreen';
import AttendeeListScreen from './screens/AttendeeListScreen';
import EditEventScreen from './screens/EditEventScreen';
import CalendarScreen from './screens/CalendarScreen';
import MemoryDetailsScreen from './screens/MemoryDetailsScreen';

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

function RootNavigator() {
  const { isAuthenticated, loadingToken, logout } = useContext(AuthContext);

  console.log('🟡 RootNavigator: Rendering with state:', { isAuthenticated, loadingToken });

  if (loadingToken) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF'
      }}>
        <Text style={{
          fontSize: 24,
          fontWeight: '700',
          color: '#3797EF',
          marginBottom: 20
        }}>Social</Text>
        <ActivityIndicator size="large" color="#3797EF" />
        <Text style={{
          marginTop: 16,
          fontSize: 16,
          color: '#8E8E93'
        }}>Loading...</Text>
      </View>
    );
  }

  return (
    <RootStack.Navigator>
      {/* If not authenticated => show login/register */}
      {!isAuthenticated ? (
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
      ) : (
        // If authenticated => main tabs + all global screens
        <>
          <RootStack.Screen
            name="MainTabs"
            options={{ headerShown: false }}
          >
            {(props) => (
              <MainTabNavigator
                {...props}
                onLogout={logout}
              />
            )}
          </RootStack.Screen>

          {/* GLOBAL SCREENS => can be navigated to from ANYWHERE */}
          <RootStack.Screen
            name="ProfileScreen"
            component={ProfileScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="FollowListScreen"
            component={FollowListScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="UserSettingsScreen"
            component={UserSettingsScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="EditProfileScreen"
            component={EditProfileScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="SearchScreen"
            component={SearchScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="EventDetailsScreen"
            component={EventDetailsScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="EventDetails"
            component={EventDetailsScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="PostDetailsScreen"
            component={PostDetailsScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="CreateEventScreen"
            component={CreateEventScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="CreateEvent"
            component={CreateEventScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="CreatePostScreen"
            component={CreatePostScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="CreatePost"
            component={CreatePostScreen}
            options={{ headerShown: false }}
          />
          {/* FIXED: Added CreatePickerScreen routes */}
          <RootStack.Screen
            name="CreatePickerScreen"
            component={CreatePickerScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="CreatePicker"
            component={CreatePickerScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="PostPublishedScreen"
            component={PostPublishedScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="PostPublished"
            component={PostPublishedScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="ChatScreen"
            component={ChatScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="NewChatScreen"
            component={NewChatScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="SelectChatScreen"
            component={SelectChatScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="ChatInfoScreen"
            component={ChatInfoScreen}
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
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="AttendeeListScreen"
            component={AttendeeListScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="EditEventScreen"
            component={EditEventScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="CalendarScreen"
            component={CalendarScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen
            name="MemoryDetailsScreen"
            component={MemoryDetailsScreen}
            options={{ headerShown: false }}
          />
        </>
      )}
    </RootStack.Navigator>
  );
}

export default function App() {
  console.log('🟡 App: Starting application...');

  // Handle environment errors
  if (!API_BASE_URL || !PUBLISHABLE_KEY) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#FF3B30', textAlign: 'center' }}>
          Configuration Error
        </Text>
        <Text style={{ marginTop: 16, textAlign: 'center' }}>
          {!API_BASE_URL && 'API_BASE_URL is missing from .env file\n'}
          {!PUBLISHABLE_KEY && 'PUBLISHABLE_KEY is missing from .env file'}
        </Text>
        <Text style={{ marginTop: 16, fontSize: 12, color: '#8E8E93', textAlign: 'center' }}>
          Please check your .env file and restart the app
        </Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <StripeProvider
        publishableKey={PUBLISHABLE_KEY}
        merchantDisplayName="MyApp"
        returnURL="myapp://stripe-redirect"
      >
        <AuthProvider>
          <SafeAreaProvider>
            <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
            <NavigationContainer
              onStateChange={(state) => {
                console.log('🟡 Navigation state changed:', state?.routes?.[0]?.name);
              }}
              fallback={
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#3797EF" />
                  <Text style={{ marginTop: 16 }}>Loading Navigation...</Text>
                </View>
              }
            >
              <RootNavigator />
            </NavigationContainer>
          </SafeAreaProvider>
        </AuthProvider>
      </StripeProvider>
    </ErrorBoundary>
  );
}