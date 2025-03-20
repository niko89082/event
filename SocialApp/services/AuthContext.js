
import React, { createContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import api, { setAuthToken, setOnUnauthorized } from './api';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadingToken, setLoadingToken] = useState(true);

  useEffect(() => {
    setOnUnauthorized(logout);

    checkForSavedToken();
  }, []);

  const checkForSavedToken = async () => {
    try {
      const savedToken = await SecureStore.getItemAsync('token');
      if (savedToken) {
        setAuthToken(savedToken);
        try {
          const res = await api.get('/profile');
          setCurrentUser(res.data);
          setIsAuthenticated(true);
        } catch (verifyErr) {
          console.log('Token invalid, logging out immediately...');
          // If token is invalid, remove it
          await SecureStore.deleteItemAsync('token');
          setAuthToken('');
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      }
    } catch (err) {
      console.log('Error reading token from store:', err);
    } finally {
      setLoadingToken(false);
    }
  };

  const setTokenAndUser = async (token, user) => {
    try {
      await SecureStore.setItemAsync('token', token);
      setAuthToken(token);
      setIsAuthenticated(true);
      setCurrentUser(user);
    } catch (err) {
      console.log('Error storing token:', err);
    }
  };

  // This will be called from the interceptor if any request fails with 401
  const logout = async () => {
    console.log('AuthContext => logout => forcibly removing token...');
    try {
      await SecureStore.deleteItemAsync('token');
      setAuthToken('');
      setIsAuthenticated(false);
      setCurrentUser(null);
    } catch (err) {
      console.log('Error removing token:', err);
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      isAuthenticated,
      loadingToken,
      setTokenAndUser,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}