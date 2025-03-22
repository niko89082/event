// App.js
import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { AuthContext, AuthProvider } from './services/AuthContext';

// Auth screens
import LoginScreen from './screens/Auth/LoginScreen';
import RegisterScreen from './screens/Auth/RegisterScreen';

// Main tabs (which includes your sub-stacks)
import MainTabNavigator from './navigation/MainTabNavigator';

// Common “global” screens used by entire app:
import ProfileScreen from './screens/ProfileScreen';
import CommentsScreen from './screens/CommentsScreen';
import FollowListScreen from './screens/FollowListScreen';
import UserSettingsScreen from './screens/UserSettingsScreen';

const RootStack = createStackNavigator();

function RootNavigator() {
  const { isAuthenticated, loadingToken, logout } = useContext(AuthContext);

  // Show nothing while checking token
  if (loadingToken) {
    return null;
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
        // If authenticated => main tabs + all “global” screens
        <>
          {/*
            NOTE: We set headerShown: false for the main tabs route
            so the tab bar can handle the UI, but we can also
            push other screens with headers on top.
          */}
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
            options={{ headerShown: true, title: 'Profile' }}
          />
          <RootStack.Screen
            name="CommentsScreen"
            component={CommentsScreen}
            options={{ headerShown: true, title: 'Comments' }}
          />
          <RootStack.Screen
            name="FollowListScreen"
            component={FollowListScreen}
            options={{ headerShown: true, title: 'Followers/Following' }}
          />
          <RootStack.Screen
            name="UserSettingsScreen"
            component={UserSettingsScreen}
            options={{ headerShown: true, title: 'Settings' }}
          />
        </>
      )}
    </RootStack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}