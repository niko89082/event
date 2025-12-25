// navigation/CreateStack.js - Updated to remove CreatePickerScreen
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import CreateEventScreen    from '../screens/CreateEventScreen';
import CreatePostScreen     from '../screens/CreatePostScreen';
import CreateMemoryScreen   from '../screens/CreateMemoryScreen';
import PostPublishedScreen  from '../screens/PostPublishedScreen';

const Stack = createStackNavigator();

export default function CreateStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="CreatePost"     component={CreatePostScreen}    options={{ headerShown:false }} />
      <Stack.Screen name="CreateEvent"    component={CreateEventScreen}   options={{ title:'New event' }} />
      <Stack.Screen name="CreateMemory"   component={CreateMemoryScreen}  options={{ headerShown:false }} />
      <Stack.Screen name="PostPublished"  component={PostPublishedScreen} options={{ headerShown:false, gestureEnabled:false }} />
    </Stack.Navigator>
  );
}