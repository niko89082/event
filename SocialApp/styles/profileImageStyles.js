// styles/profileImageStyles.js - Global profile image styles for consistent square with curved edges
import { StyleSheet } from 'react-native';

export const profileImageStyles = StyleSheet.create({
  // Small profile images (24x24)
  small: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  
  // Medium profile images (32x32)
  medium: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  
  // Regular profile images (48x48)
  regular: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  
  // Large profile images (64x64)
  large: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  
  // Extra large profile images (96x96)
  extraLarge: {
    width: 96,
    height: 96,
    borderRadius: 24,
  },
  
  // Profile header images (120x120)
  header: {
    width: 120,
    height: 120,
    borderRadius: 30,
  },
});

// Helper function to get profile image style by size
export const getProfileImageStyle = (size = 'regular') => {
  return profileImageStyles[size] || profileImageStyles.regular;
};

// Component wrapper for consistent profile images
import React from 'react';
import { Image } from 'react-native';
import { API_BASE_URL } from '@env';

export const ProfileImage = ({ 
  user, 
  size = 'regular', 
  style = {},
  ...props 
}) => {
  const imageUri = user?.profilePicture
    ? `http://${API_BASE_URL}:3000${user.profilePicture}`
    : 'https://placehold.co/120x120.png?text=👤';

  return (
    <Image
      source={{ uri: imageUri }}
      style={[getProfileImageStyle(size), style]}
      {...props}
    />
  );
};

export default profileImageStyles;