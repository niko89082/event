// navigation/RootNavigator.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import MainTabNavigator from './MainTabNavigator';

const RootStack = createStackNavigator();

export default function RootNavigator({ onLogout }) {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen
        name="MainTabs"
        children={(props) => <MainTabNavigator {...props} onLogout={onLogout} />}
      />
      {/* If you want global routes visible app-wide, put them here, 
          e.g. <RootStack.Screen name="SomeGlobalScreen" component={...} />
      */}
    </RootStack.Navigator>
  );
}