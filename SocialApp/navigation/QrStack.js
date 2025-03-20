import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import QrScreen from '../screens/QrScreen';
import QrScanScreen from '../screens/QrScanScreen';

const Stack = createStackNavigator();

export default function QrStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="QrDisplay"
        component={QrScreen}
        options={{ title: 'My QR Code' }}
      />
      <Stack.Screen
        name="QrScan"
        component={QrScanScreen}
        options={{ title: 'Scan a Code' }}
      />
    </Stack.Navigator>
  );
}