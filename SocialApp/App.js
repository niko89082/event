
import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StripeProvider } from '@stripe/stripe-react-native';
import { AuthContext, AuthProvider } from './services/AuthContext';

import LoginScreen from './screens/Auth/LoginScreen';
import RegisterScreen from './screens/Auth/RegisterScreen';

import MainTabNavigator from './navigation/MainTabNavigator';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import ProfileScreen from './screens/ProfileScreen';
import FollowListScreen from './screens/FollowListScreen';
import UserSettingsScreen from './screens/UserSettingsScreen';
import { PUBLISHABLE_KEY } from '@env';
import { palette } from './theme'; 
const RootStack = createStackNavigator();

function RootNavigator() {
  const { isAuthenticated, loadingToken, logout } = useContext(AuthContext);

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
            options={{ headerShown:false }}
          />
          <RootStack.Screen
            name="FollowListScreen"
            component={FollowListScreen}
            options={{ headerShown:false }}
          />
          <RootStack.Screen
            name="UserSettingsScreen"
            component={UserSettingsScreen}
            options={{ headerShown: false}}
          />
        </>
      )}
    </RootStack.Navigator>
  );
}

export default function App() {
  return (
    <StripeProvider
      publishableKey={PUBLISHABLE_KEY}
      merchantDisplayName="MyApp"
      returnURL="myapp://stripe-redirect"  // Ensure this matches your app's URL scheme
    >
      <AuthProvider>
        <SafeAreaProvider>
        <SafeAreaView style={{ flex:1, backgroundColor:palette.bg }}>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
        </SafeAreaView>
        </SafeAreaProvider>
      </AuthProvider>
    </StripeProvider>
  );
}