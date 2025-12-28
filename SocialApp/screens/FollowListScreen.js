// screens/FollowListScreen.js - Wrapper for FriendsListScreen to maintain compatibility
import React from 'react';
import FriendsListScreen from './FriendsListScreen';

// This screen is a compatibility wrapper for the old "FollowListScreen" name
// It maps the old "followers"/"following" modes to the new friends system
export default function FollowListScreen({ route, navigation }) {
  // Map old mode names to new ones if needed
  const { mode, userId } = route.params || {};
  
  // If mode is 'followers' or 'following', map to 'friends' mode
  // The FriendsListScreen will handle displaying the appropriate list
  const mappedMode = mode === 'followers' || mode === 'following' 
    ? 'friends' 
    : mode || 'friends';
  
  return (
    <FriendsListScreen 
      route={{
        ...route,
        params: {
          ...route.params,
          userId,
          mode: mappedMode,
        }
      }}
      navigation={navigation}
    />
  );
}

