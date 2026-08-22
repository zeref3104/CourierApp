import axios from 'axios';
import { store } from '../store';
import { setAccessToken, logout } from '../store/slices/authSlice';
import {
  clearClientRefreshToken,
  loadClientRefreshToken,
  saveClientRefreshToken,
} from '../utils/clientAuthStorage';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://api.charmeurexpress.us/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor
api.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - refresh token rotation
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: any, token: string | null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Client sessions have no refresh cookie — they rotate via
        // POST /auth/client/refresh with the token in the body (same
        // contract the mobile app uses). Staff keeps the cookie flow.
        const clientRefreshToken = store.getState().auth.user?.isClient
          ? loadClientRefreshToken()
          : null;

        let newToken: string;
        if (clientRefreshToken) {
          const { data } = await axios.post(`${api.defaults.baseURL}/auth/client/refresh`, {
            refreshToken: clientRefreshToken,
          });
          newToken = data.data.accessToken;
          saveClientRefreshToken(data.data.refreshToken);
        } else {
          const { data } = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            {},
            { withCredentials: true }
          );
          newToken = data.data.accessToken;
        }

        store.dispatch(setAccessToken(newToken));
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearClientRefreshToken();
        store.dispatch(logout());
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;