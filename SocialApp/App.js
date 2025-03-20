// App.js
import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { AuthContext, AuthProvider } from './services/AuthContext';
import LoginScreen from './screens/Auth/LoginScreen';
import RegisterScreen from './screens/Auth/RegisterScreen';
import MainTabNavigator from './navigation/MainTabNavigator';

const Stack = createStackNavigator();

function RootNavigator() {
  const { isAuthenticated, loadingToken, logout } = useContext(AuthContext);

  if (loadingToken) {
    return null; // Show nothing while we check token
  }

  return (
    <Stack.Navigator>
      {!isAuthenticated ? (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ headerShown: false }}
          />
        </>
      ) : (
        <Stack.Screen
          name="Main"
          options={{ headerShown: false }}
        >
          {(props) => (
            <MainTabNavigator
              {...props}
              onLogout={logout}
            />
          )}
        </Stack.Screen>
      )}
    </Stack.Navigator>
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