// App.js - Updated with enhanced navigation support
import React, { useContext, useEffect } from 'react';
import { View, Text, ActivityIndicator, Alert, Linking, TextInput  } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StripeProvider } from '@stripe/stripe-react-native';
import { AuthContext, AuthProvider } from './services/AuthContext';
import EventQRDisplayScreen from './screens/EventQrDisplayScreen';
import LoginScreen from './screens/Auth/LoginScreen';
import RegisterScreen from './screens/Auth/RegisterScreen';

import MainTabNavigator from './navigation/MainTabNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Global Screens (accessible from anywhere)
import CreateMemoryScreen from './screens/CreateMemoryScreen';
import ProfileScreen from './screens/ProfileScreen';
import FriendsListScreen from './screens/FriendsListScreen';
import FriendRequestsScreen from './screens/FriendRequestsScreen';
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
import UnifiedDetailsScreen from './screens/UnifiedDetailsScreen';
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
import PostLikesScreen from './screens/PostsLikesScreen'; 
import ErrorBoundary from './components/ErrorBoundary';
import { PUBLISHABLE_KEY, API_BASE_URL } from '@env';
import { palette } from './theme'; 
import { StatusBar } from 'react-native';

Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.allowFontScaling = false;

TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.allowFontScaling = false;

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

  // Enhanced deep link handling for payment returns
  useEffect(() => {
    const handleDeepLink = (url) => {
      console.log('🔗 Deep link received:', url);
      
      if (url.includes('/payment/success')) {
        console.log('✅ Payment success detected from deep link');
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' }}>
        <ActivityIndicator size="large" color={palette.primary || '#000'} />
        <Text style={{ 
          marginTop: 16, 
          color: palette.textSecondary || '#8E8E93',
          fontSize: 16,
          fontWeight: '500' 
        }}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator 
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          animation: 'slide_from_right',
          cardStyle: { backgroundColor: '#FAFAFA' },
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
            
            {/* Enhanced Global Screens with improved headers */}
            <RootStack.Screen 
              name="CreateMemoryScreen" 
              component={CreateMemoryScreen}
              options={{ 
                headerShown: true, 
                title: 'Create Memory',
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="ProfileScreen" 
              component={ProfileScreen}
              options={{ 
                headerShown: true, 
                title: 'Profile',
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="EventQRDisplayScreen" 
              component={EventQRDisplayScreen}
              options={{
                title: 'Event QR Code',
                headerShown: false
              }}
            />
            <RootStack.Screen 
              name="PostLikesScreen" 
              component={PostLikesScreen}
              options={{ 
                headerShown: true, 
                title: 'Likes',
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="FriendRequestsScreen" 
              component={FriendRequestsScreen}
              options={{ 
                headerShown: true,
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="FriendsListScreen" 
              component={FriendsListScreen}
              options={{ 
                headerShown: true,
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="UserSettingsScreen" 
              component={UserSettingsScreen}
              options={{ 
                headerShown: true, 
                title: 'Settings',
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="EditProfileScreen" 
              component={EditProfileScreen}
              options={{ 
                headerShown: false,
              }}
            />
            
            <RootStack.Screen 
              name="SearchScreen" 
              component={SearchScreen}
              options={{ 
                headerShown: true, 
                title: 'Search',
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="EventDetailsScreen" 
              component={EventDetailsScreen}
              options={{ 
                headerShown: true, 
                title: 'Event Details',
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="UnifiedDetailsScreen" 
              component={UnifiedDetailsScreen}
              options={{ headerShown: true, title: 'Post' }}
            />

            <RootStack.Screen 
              name="PostDetailsScreen" 
              component={PostDetailsScreen}
              options={{ 
                headerShown: true, 
                title: 'Post',
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="CreateEventScreen" 
              component={CreateEventScreen}
              options={{ 
                headerShown: true, 
                title: 'New Event',
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="CreatePostScreen" 
              component={CreatePostScreen}
              options={{ 
                headerShown: false, 
                title: 'New Post',
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="CreatePickerScreen" 
              component={CreatePickerScreen}
              options={{ 
                headerShown: true, 
                title: 'Create',
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="PostPublishedScreen" 
              component={PostPublishedScreen}
              options={{ 
                headerShown: false,
                gestureEnabled: false,
              }}
            />
            <RootStack.Screen 
              name="QrScreen" 
              component={QrScreen}
              options={{ 
                headerShown: true, 
                title: 'QR Code',
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            
            <RootStack.Screen 
              name="QrScanScreen" 
              component={QrScanScreen}
              options={{ 
                headerShown: true, 
                title: 'Scan QR',
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="AttendeeListScreen" 
              component={AttendeeListScreen}
              options={{ 
                headerShown: true, 
                title: 'Attendees',
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="EditEventScreen" 
              component={EditEventScreen}
              options={{ 
                headerShown: true, 
                title: 'Edit Event',
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="CalendarScreen" 
              component={CalendarScreen}
              options={{ 
                headerShown: true, 
                title: 'Calendar',
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="MemoryDetailsScreen" 
              component={MemoryDetailsScreen}
              options={{ 
                headerShown: true, 
                title: 'Memory',
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="EditMemoryScreen" 
              component={EditMemoryScreen}
              options={{ 
                headerShown: true, 
                title: 'Edit Memory',
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="PaymentSettingsScreen" 
              component={PaymentSettingsScreen}
              options={{
                headerTitle: 'Payment Settings',
                headerBackTitleVisible: false,
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
              }}
            />
            <RootStack.Screen 
              name="MemoryParticipantsScreen" 
              component={MemoryParticipantsScreen}
              options={{ 
                headerShown: true, 
                title: 'Participants',
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="InviteUsersScreen" 
              component={InviteUsersScreen}
              options={{ 
                headerShown: true, 
                title: 'Invite Users',
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
            <RootStack.Screen 
              name="NotificationScreen" 
              component={NotificationScreen}
              options={{ 
                headerShown: true, 
                title: 'Notifications',
                headerStyle: {
                  backgroundColor: '#FFFFFF',
                  shadowOpacity: 0.1,
                  elevation: 2,
                },
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            />
          </>
        ) : (
          <>
            {/* Auth Stack with enhanced styling */}
            <RootStack.Screen 
              name="LoginScreen" 
              component={LoginScreen}
              options={{ 
                headerShown: false,
                cardStyle: { backgroundColor: '#FFFFFF' }
              }}
            />
            <RootStack.Screen 
              name="RegisterScreen" 
              component={RegisterScreen}
              options={{ 
                headerShown: false,
                cardStyle: { backgroundColor: '#FFFFFF' }
              }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    console.log('🟢 App: Component mounted with enhanced UI');
  }, []);

  const handleLogout = () => {
    console.log('🔴 App: Logout requested');
  };

  return (
    <ErrorBoundary>
      <StripeProvider publishableKey={PUBLISHABLE_KEY}>
        <SafeAreaProvider>
          <StatusBar 
            barStyle="dark-content" 
            backgroundColor="transparent" 
            translucent 
          />
          <AuthProvider>
            <AppNavigator onLogout={handleLogout} />
          </AuthProvider>
        </SafeAreaProvider>
      </StripeProvider>
    </ErrorBoundary>
  );
}