// navigation/ProfileStack.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import ProfileScreen                 from '../screens/ProfileScreen';
import FollowListScreen              from '../screens/FollowListScreen';
import UserSettingsScreen            from '../screens/UserSettingsScreen';
import SelectShareableEventsScreen   from '../screens/SelectShareableEventsScreen';
import EditProfileScreen             from '../screens/EditProfileScreen';
import PostDetailsScreen             from '../screens/PostDetailsScreen';
import QrScreen                      from '../screens/QrScreen';   // <- keeps QR button working

const Stack = createStackNavigator();

export default function ProfileStack({ onLogout }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {[
        /* ---- main profile ---- */
        <Stack.Screen
          key="ProfileScreen"
          name="ProfileScreen"
          // we need render-prop style here to pass onLogout if you require it later
          children={(props) => <ProfileScreen {...props} onLogout={onLogout} />}
        />,

        /* ---- people & settings ---- */
        <Stack.Screen key="FollowList"        name="FollowListScreen"         component={FollowListScreen}        />,
        <Stack.Screen key="UserSettings"      name="UserSettingsScreen"       component={UserSettingsScreen}      />,
        <Stack.Screen key="ShareableEvents"   name="SelectShareableEventsScreen" component={SelectShareableEventsScreen} />,
        <Stack.Screen key="EditProfile"       name="EditProfileScreen"        component={EditProfileScreen}       />,

        /* ---- content drill-downs ---- */
        <Stack.Screen key="PostDetails"       name="PostDetailsScreen"        component={PostDetailsScreen}       />,
        <Stack.Screen key="QrScreen"          name="QrScreen"                 component={QrScreen}                />,
      ]}
    </Stack.Navigator>
  );
}