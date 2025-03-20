// services/api.js
import axios from 'axios';
import { API_BASE_URL } from '@env';

let onUnauthorized = null; // We'll store a callback for handling 401

const api = axios.create({
  baseURL: `http://${API_BASE_URL}:3000/api`,
});

// Interceptor for responses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Check if we got a 401 from the server
    if (error.response?.status === 401) {
      // If there's a logout callback, call it
      if (onUnauthorized) {
        onUnauthorized();
      }
    }
    return Promise.reject(error);
  }
);

/**
 * setAuthToken
 * If we have a token, attach to default headers; else remove it
 */
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

/**
 * setOnUnauthorized
 * Allows the AuthContext to register a logout callback
 */
export const setOnUnauthorized = (logoutCallback) => {
  onUnauthorized = logoutCallback;
};

export default api;