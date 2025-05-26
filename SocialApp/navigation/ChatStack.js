// navigation/ChatStack.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Existing imports...
import ConversationListScreen from '../screens/ConversationListScreen';
import NewChatScreen from '../screens/NewChatScreen';
import ChatScreen from '../screens/ChatScreen';
import ChatInfoScreen from '../screens/ChatInfoScreen';
import ProfileScreen from '../screens/ProfileScreen'; 
import SelectChatScreen from '../screens/SelectChatScreen';

// 1) Import the MemoryDetailsScreen
import MemoryDetailsScreen from '../screens/MemoryDetailsScreen';

const Stack = createStackNavigator();

export default function ChatStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ConversationList"
        component={ConversationListScreen}
        options={{ title: 'Messages' }}
      />
      <Stack.Screen
        name="NewChatScreen"
        component={NewChatScreen}
        options={{ title: 'New Chat' }}
      />
      <Stack.Screen
        name="ChatScreen"
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
      <Stack.Screen
        name="ChatInfoScreen"
        component={ChatInfoScreen}
        options={{ title: 'Chat Info' }}
      />
      <Stack.Screen
        name="ProfileScreen"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
      <Stack.Screen
        name="SelectChatScreen"
        component={SelectChatScreen}
        options={{ title: 'Share...' }}
      />

      {/* 2) Add MemoryDetailsScreen so we can navigate to it */}
      <Stack.Screen
        name="MemoryDetailsScreen"
        component={MemoryDetailsScreen}
        options={{ title: 'Memory Details' }}
      />
    </Stack.Navigator>
  );
}