import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import CreatePickerScreen   from '../screens/CreatePickerScreen';
import CreateEventScreen    from '../screens/CreateEventScreen';
import CreatePostScreen     from '../screens/CreatePostScreen';   // ← your multi-step flow
import PostPublishedScreen  from '../screens/PostPublishedScreen';

const Stack = createStackNavigator();

export default function CreateStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="CreatePicker"   component={CreatePickerScreen}  options={{ headerShown:false }} />
      <Stack.Screen name="CreateEvent"    component={CreateEventScreen}   options={{ title:'New event' }} />
      <Stack.Screen name="CreatePost"     component={CreatePostScreen}    options={{ headerShown:false }} />
      <Stack.Screen name="PostPublished"  component={PostPublishedScreen} options={{ headerShown:false, gestureEnabled:false }} />
    </Stack.Navigator>
  );
}