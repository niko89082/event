// services/AuthContext.js - Fixed for Expo with better token management
import React, { createContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from './api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadingToken, setLoadingToken] = useState(true);

  useEffect(() => {
    console.log('🟡 AuthProvider: Starting token check...');
    checkToken();
  }, []);

  const checkToken = async () => {
    try {
      console.log('🟡 AuthProvider: Checking stored token...');
      const token = await SecureStore.getItemAsync('auth_token');
      const userData = await SecureStore.getItemAsync('user_data');
      
      console.log('🟡 AuthProvider: Token exists:', !!token);
      console.log('🟡 AuthProvider: User data exists:', !!userData);
      
      if (token && userData) {
        try {
          const user = JSON.parse(userData);
          console.log('🟡 AuthProvider: Found user:', user.username);
          
          // IMPORTANT: Set the token in API headers BEFORE setting state
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          console.log('🟡 AuthProvider: Token set in API headers');
          
          // Test the token by making a simple API call
          try {
            const testResponse = await api.get('/api/profile');
            console.log('🟢 AuthProvider: Token is valid');
            
            setCurrentUser(user);
            setIsAuthenticated(true);
            console.log('🟢 AuthProvider: User authenticated successfully');
          } catch (apiError) {
            console.log('❌ AuthProvider: Token invalid, clearing stored data');
            // Token is invalid, clear it
            await clearStoredAuth();
            setIsAuthenticated(false);
            setCurrentUser(null);
          }
        } catch (parseError) {
          console.error('❌ AuthProvider: Error parsing user data:', parseError);
          await clearStoredAuth();
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } else {
        console.log('🟡 AuthProvider: No stored credentials found');
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('❌ AuthProvider: Error checking token:', error);
      setIsAuthenticated(false);
      setCurrentUser(null);
      await clearStoredAuth();
    } finally {
      console.log('🟢 AuthProvider: Token check complete');
      setLoadingToken(false);
    }
  };

  const clearStoredAuth = async () => {
    try {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('user_data');
      delete api.defaults.headers.common['Authorization'];
      console.log('🟡 AuthProvider: Cleared stored auth data');
    } catch (error) {
      console.error('❌ Error clearing stored auth:', error);
    }
  };

  const setTokenAndUser = async (token, user) => {
    try {
      console.log('🟡 AuthProvider: Setting token and user:', user.username);
      
      // IMPORTANT: Set the token in API headers FIRST
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      console.log('🟡 AuthProvider: Token set in API headers');
      
      // Store in SecureStore
      await SecureStore.setItemAsync('auth_token', token);
      await SecureStore.setItemAsync('user_data', JSON.stringify(user));
      console.log('🟡 AuthProvider: Token and user data stored securely');
      
      // Update state
      setCurrentUser(user);
      setIsAuthenticated(true);
      
      console.log('🟢 AuthProvider: User logged in successfully');
    } catch (error) {
      console.error('❌ AuthProvider: Error setting token:', error);
      // If storage fails, at least set the API header for this session
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setCurrentUser(user);
      setIsAuthenticated(true);
    }
  };

  const logout = async () => {
    try {
      console.log('🟡 AuthProvider: Logging out...');
      
      // Clear SecureStore
      await clearStoredAuth();
      
      // Update state
      setCurrentUser(null);
      setIsAuthenticated(false);
      
      console.log('🟢 AuthProvider: Logout successful');
    } catch (error) {
      console.error('❌ AuthProvider: Error during logout:', error);
      // Force logout even if clearing storage fails
      delete api.defaults.headers.common['Authorization'];
      setCurrentUser(null);
      setIsAuthenticated(false);
    }
  };

  // Add method to refresh token if needed
  const refreshAuth = async () => {
    await checkToken();
  };

  const value = {
    currentUser,
    isAuthenticated,
    loadingToken,
    setTokenAndUser,
    logout,
    checkToken,
    refreshAuth,
  };

  console.log('🟡 AuthProvider: Rendering with state:', {
    isAuthenticated,
    loadingToken,
    hasUser: !!currentUser,
    username: currentUser?.username,
    hasAuthHeader: !!api.defaults.headers.common['Authorization']
  });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};