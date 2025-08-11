// SocialApp/hooks/useCurrentUser.js - Simple version without AuthContext
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Hook to get current user from AsyncStorage
 * @returns {object} Current user object and auth state
 */
export const useCurrentUser = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userStr = await AsyncStorage.getItem('currentUser');
        if (userStr) {
          const user = JSON.parse(userStr);
          setCurrentUser(user);
        }
      } catch (error) {
        console.error('Failed to load user from storage:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadUser();
  }, []);
  
  return {
    currentUser,
    isAuthenticated: !!currentUser,
    loading
  };
};