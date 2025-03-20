import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ConversationListScreen from '../screens/ConversationListScreen';
import NewChatScreen from '../screens/NewChatScreen';
import ChatScreen from '../screens/ChatScreen';
import ChatInfoScreen from '../screens/ChatInfoScreen';
import ProfileScreen from '../screens/ProfileScreen'; // <-- Add this

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
        component={ProfileScreen}  // <-- So we can do navigation.navigate('ProfileScreen', ...)
        options={{ title: 'Profile' }}
      />
    </Stack.Navigator>
  );
}