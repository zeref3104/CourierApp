import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import uiReducer from './slices/uiSlice';
import packageReducer from './slices/packageSlice';
import customerReducer from './slices/customerSlice';
import notificationReducer from './slices/notificationSlice';
import { clearClientRefreshToken } from '../utils/clientAuthStorage';
import { clearApiCache } from '../utils/apiCache';

// Load persisted auth from localStorage
function loadPersistedAuth() {
  try {
    const raw = localStorage.getItem('auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.accessToken && parsed.user) {
        return { user: parsed.user, accessToken: parsed.accessToken };
      }
    }
  } catch {}
  return null;
}

const persisted = loadPersistedAuth();

const preloadedState = persisted
  ? {
      auth: {
        user: persisted.user,
        accessToken: persisted.accessToken,
        isAuthenticated: true,
      },
    }
  : undefined;

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    packages: packageReducer,
    customers: customerReducer,
    notifications: notificationReducer,
  },
  preloadedState,
});

// Persist auth on every change
let previousAuth: string | null = null;
// Tracks the authenticated -> unauthenticated transition so one-time logout
// side effects (the api-cache purge) don't run on every dispatch while logged
// out. Initialized from the same persisted payload as preloadedState so a
// logout right after page load (before any other dispatch) still counts.
let wasAuthenticated = persisted !== null;
store.subscribe(() => {
  const { auth } = store.getState();
  if (auth.isAuthenticated) {
    wasAuthenticated = true;
    const current = JSON.stringify({ user: auth.user, accessToken: auth.accessToken });
    if (current !== previousAuth) {
      localStorage.setItem('auth', current);
      previousAuth = current;
    }
  } else {
    localStorage.removeItem('auth');
    // Every logout path (Navbar, ClientLayout, ChangePasswordPage, axios
    // refresh failure) funnels through this subscriber, so the client refresh
    // token is wiped here and — on the actual logout transition — the service
    // worker's api-cache is purged. Workbox keys that cache by URL only, so
    // without this an offline session could replay the previous user's
    // authenticated API responses to the next user.
    clearClientRefreshToken();
    if (wasAuthenticated) {
      wasAuthenticated = false;
      clearApiCache();
    }
    previousAuth = null;
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;