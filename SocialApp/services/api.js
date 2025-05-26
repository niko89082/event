// services/api.js
import axios from 'axios';
import { API_BASE_URL } from '@env';

let onUnauthorized = null;

const api = axios.create({
  baseURL: `http://${API_BASE_URL}:3000/api`,
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (onUnauthorized) {
        onUnauthorized();
      }
    }
    return Promise.reject(error);
  }
);


export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};


export const setOnUnauthorized = (logoutCallback) => {
  onUnauthorized = logoutCallback;
};

export default api;